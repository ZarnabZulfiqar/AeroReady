import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ChevronUp, ChevronDown, Upload, Paperclip, Check } from "lucide-react";
import { supabase } from "../supabaseClient";

function ChecklistItem({ item, status, evidenceAttached, onStatusChange, onAttachEvidence }) {
  const statusColor = (val) => {
    if (status !== val) return "border border-gray-600 text-textBody hover:border-accentTeal";
    if (val === "Pass") return "bg-accentTeal/20 text-accentTeal border border-accentTeal";
    if (val === "Fail") return "bg-red-500 text-white border border-red-500";
    return "bg-gray-500/20 text-gray-300 border border-gray-500";
  };

  const passBlocked = item.evidenceRequired && !evidenceAttached;

  return (
    <div className="border-t border-gray-700 py-4 first:border-t-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm">{item.label}</h3>
          {item.note && <p className="text-textBody text-xs mt-1">{item.note}</p>}

          {item.evidenceRequired && (
            <button
              onClick={() => onAttachEvidence(item.id)}
              className={`mt-2 flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded ${
                evidenceAttached
                  ? "text-accentTeal bg-accentTeal/10"
                  : "text-orange-400 bg-orange-400/10 hover:bg-orange-400/20"
              }`}
            >
              {evidenceAttached ? <Check size={12} /> : <Paperclip size={12} />}
              {evidenceAttached ? "Evidence attached" : "Attach evidence"}
            </button>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex gap-2">
            {["Pass", "Fail", "N/A"].map((val) => (
              <button
                key={val}
                onClick={() => {
                  if (val === "Pass" && passBlocked) return;
                  onStatusChange(item.id, val);
                }}
                disabled={val === "Pass" && passBlocked}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${statusColor(val)} ${
                  val === "Pass" && passBlocked ? "opacity-40 cursor-not-allowed" : ""
                }`}
              >
                {val}
              </button>
            ))}
          </div>
          {passBlocked && (
            <span className="text-orange-400 text-xs">Attach evidence to mark Pass</span>
          )}
        </div>
      </div>
    </div>
  );
}

function MissionChecklist() {
  const { id: missionId } = useParams();

  const [mission, setMission] = useState(null);
  const [sections, setSections] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [evidenceMap, setEvidenceMap] = useState({});
  const [remark, setRemark] = useState("");
  const [collapsed, setCollapsed] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  async function fetchAll() {
    setLoading(true);
    setError("");

    const [{ data: missionData, error: missionErr }, { data: templateData, error: templateErr }, { data: resultData, error: resultErr }] =
      await Promise.all([
        supabase.from("missions").select("*, drones(model)").eq("id", missionId).single(),
        supabase.from("checklist_templates").select("*").eq("retired_flag", false).order("category", { ascending: true }),
        supabase.from("checklist_results").select("*").eq("mission_id", missionId),
      ]);

    if (missionErr || templateErr || resultErr) {
      setError("Could not load checklist. " + (missionErr?.message || templateErr?.message || resultErr?.message));
      setLoading(false);
      return;
    }

    setMission(missionData);

    // FR-023: present applicable checklist templates based on mission type
    // and payload/camera requirement — skip Payload/Camera items when the
    // mission doesn't require a payload/camera.
    const applicableTemplates = templateData.filter((t) => {
      if (t.category === "Payload / Camera" && !missionData.payload_required) {
        return false;
      }
      return true;
    });

    const grouped = {};
    applicableTemplates.forEach((t) => {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push({
        id: t.item_id,
        label: t.template_name,
        note: t.condition_rule || "",
        evidenceRequired: t.evidence_required,
        criticality: t.criticality,
      });
    });
    const sectionList = Object.keys(grouped).map((category) => ({
      title: category,
      critical: grouped[category].some((i) => i.criticality === "Critical"),
      items: grouped[category],
    }));
    setSections(sectionList);

    const statusMap = {};
    const evMap = {};
    resultData.forEach((r) => {
      if (r.outcome && r.outcome !== "Pending") statusMap[r.item_id] = r.outcome;
      if (r.evidence_reference) evMap[r.item_id] = true;
      if (r.remark) setRemark(r.remark);
    });
    setStatuses(statusMap);
    setEvidenceMap(evMap);

    setLoading(false);
  }

  useEffect(() => {
    if (missionId) fetchAll();
  }, [missionId]);

  const allItems = sections.flatMap((s) => s.items);
  const remainingCount = allItems.filter((item) => !statuses[item.id]).length;

  const hasCriticalFail = sections.some(
    (section) => section.critical && section.items.some((item) => statuses[item.id] === "Fail" && item.criticality === "Critical")
  );

  async function handleStatusChange(id, val) {
    const newVal = statuses[id] === val ? undefined : val;
    setStatuses((prev) => ({ ...prev, [id]: newVal }));

    const { error } = await supabase.from("checklist_results").upsert(
      {
        result_id: `${missionId}-${id}`,
        mission_id: missionId,
        item_id: id,
        outcome: newVal || "Pending",
        evidence_reference: evidenceMap[id] ? "attached" : null,
      },
      { onConflict: "result_id" }
    );
    if (error) setError("Failed to save item status. " + error.message);
  }

  async function handleAttachEvidence(id) {
    const newAttached = !evidenceMap[id];
    setEvidenceMap((prev) => ({ ...prev, [id]: newAttached }));

    const { error } = await supabase.from("checklist_results").upsert(
      {
        result_id: `${missionId}-${id}`,
        mission_id: missionId,
        item_id: id,
        outcome: statuses[id] || "Pending",
        evidence_reference: newAttached ? "attached" : null,
      },
      { onConflict: "result_id" }
    );
    if (error) setError("Failed to save evidence. " + error.message);
  }

  function toggleSection(title) {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  async function handleSubmit() {
    setSubmitMessage("");
    setError("");

    // All items must be marked Pass / Fail / N/A before submitting.
    if (remainingCount > 0) {
      setError(`${remainingCount} item(s) still need a Pass / Fail / N/A result before you can submit.`);
      return;
    }

    setSaving(true);

    const upserts = allItems.map((item) => ({
      result_id: `${missionId}-${item.id}`,
      mission_id: missionId,
      item_id: item.id,
      outcome: statuses[item.id] || "Pending",
      evidence_reference: evidenceMap[item.id] ? "attached" : null,
      remark: remark || null,
    }));

    const { error: resultErr } = await supabase.from("checklist_results").upsert(upserts, { onConflict: "result_id" });
    if (resultErr) {
      setError("Failed to submit checklist. " + resultErr.message);
      setSaving(false);
      return;
    }

    if (!hasCriticalFail) {
      const { error: missionErr } = await supabase
        .from("missions")
        .update({ status: "Pending Approval" })
        .eq("id", missionId);
      if (missionErr) {
        setError("Checklist saved, but failed to update mission status. " + missionErr.message);
        setSaving(false);
        return;
      }
      setMission((prev) => (prev ? { ...prev, status: "Pending Approval" } : prev));
      setSubmitMessage("Checklist submitted. Mission moved to Pending Approval.");
    } else {
      setSubmitMessage("Checklist saved. Mission remains blocked due to a critical item failure.");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center h-64">
        <p className="text-textBody">Loading checklist...</p>
      </div>
    );
  }

  if (error && !mission) {
    return (
      <div className="w-full flex items-center justify-center h-64">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">{mission?.name}</h1>
          <p className="text-textBody text-xs mt-1">
            Mission Readiness Checklist · {mission?.id} / {mission?.drone_id}
          </p>
        </div>
        {remainingCount > 0 && (
          <span className="text-red-400 font-semibold text-sm">
            {remainingCount} items remaining
          </span>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="flex flex-col gap-4 w-full">
        {sections.map((section) => (
          <div key={section.title} className="bg-cardDark rounded-xl overflow-hidden w-full">
            <button
              onClick={() => toggleSection(section.title)}
              className="w-full flex items-center justify-between px-5 py-3 bg-slate-800/60 hover:bg-slate-800 transition-colors"
            >
              <span className="flex items-center gap-2">
                <h2 className="font-bold text-sm">{section.title}</h2>
                {section.critical && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">
                    Critical item
                  </span>
                )}
              </span>
              {collapsed[section.title] ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>

            {!collapsed[section.title] && (
              <div className="px-5">
                {section.items.map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    status={statuses[item.id]}
                    evidenceAttached={!!evidenceMap[item.id]}
                    onStatusChange={handleStatusChange}
                    onAttachEvidence={handleAttachEvidence}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {hasCriticalFail && (
        <div className="mt-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 text-sm w-full">
          Critical item failed — this mission is blocked from approval regardless of risk score.
        </div>
      )}

      <div className="mt-6 w-full">
        <label className="text-textBody text-sm font-semibold">Remark / Evidence for failed item</label>
        <textarea
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="Describe the issue and attach evidence..."
          rows={3}
          className="w-full mt-2 p-3 rounded-lg bg-cardDark border border-gray-700 text-white text-sm outline-none focus:border-accentTeal resize-none"
        />
      </div>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button className="px-5 py-2 rounded-full border border-gray-600 text-textBody text-sm flex items-center gap-2 hover:border-accentTeal transition-colors">
          <Upload size={16} /> Upload evidence
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-5 py-2 rounded-full bg-accentTeal text-bgDark font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Submitting..." : "Submit Checklist"}
        </button>
      </div>

      {submitMessage && <p className="text-accentTeal text-sm mt-3">{submitMessage}</p>}

      <p className="text-textBody text-xs mt-4">
        All items must be marked Pass / Fail / N/A before submitting.
      </p>
    </div>
  );
}

export default MissionChecklist;