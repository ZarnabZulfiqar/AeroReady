import { useState, useEffect } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";


function RiskApproval() {
  const { profile } = useAuth();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [selectedMissionId, setSelectedMissionId] = useState(null);
  const [remark, setRemark] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  function mapFromDb(row) {
    return {
      id: row.id,
      name: row.name,
      droneId: row.drone_id,
      submittedBy: row.pilot || "",
      checklistStatus: "Checklist completed",
      riskScore: row.risk_score ?? 0,
      riskLevel: row.risk_level || "Low",
      conditions: row.contributing_conditions || [],
      blockingReasons: row.blocking_reasons || [],
      decision: row.decision || null,
      decidedBy: row.decided_by || null,
      decidedAt: row.decided_at || null,
    };
  }

  async function fetchMissions() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("missions")
      .select("*")
      .eq("status", "Pending Approval")
      .order("created_at", { ascending: true });

    if (error) {
      setError("Could not load missions. " + error.message);
    } else {
      const mapped = data.map(mapFromDb);
      setMissions(mapped);
      if (mapped.length > 0) {
        setSelectedMissionId((prev) => prev ?? mapped[0].id);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchMissions();
  }, []);

  const mission = missions.find((m) => m.id === selectedMissionId);

  useEffect(() => {
    setRemark("");
  }, [selectedMissionId]);

  if (loading) {
    return <p className="text-textBody text-center py-8">Loading missions...</p>;
  }

  if (error) {
    return <p className="text-red-400 text-sm">{error}</p>;
  }

  if (!mission) {
    return <p className="text-textBody text-center py-8">No missions pending risk approval.</p>;
  }

  const riskColor =
    mission.riskLevel === "High"
      ? "text-red-400"
      : mission.riskLevel === "Medium"
      ? "text-yellow-400"
      : "text-accentTeal";

  const riskBadgeColor =
    mission.riskLevel === "High"
      ? "bg-red-400/20 text-red-400"
      : mission.riskLevel === "Medium"
      ? "bg-yellow-400/20 text-yellow-300"
      : "bg-accentTeal/20 text-accentTeal";

  const riskBarColor =
    mission.riskLevel === "High"
      ? "bg-red-400"
      : mission.riskLevel === "Medium"
      ? "bg-yellow-400"
      : "bg-accentTeal";

  const isHighRiskBlocked = mission.riskLevel === "High";
  const isBlocked = mission.blockingReasons.length > 0 || isHighRiskBlocked;

  const requiresRemark = mission.decision === null && !remark.trim();

  const isLocked = mission.decision !== null;

  async function handleApprove() {
    if (isBlocked || isLocked) return;
    setSaving(true);

    const decidedBy = profile?.full_name || "Administrator";

    const { error } = await supabase
      .from("missions")
      .update({
        decision: "approved",
        decided_by: decidedBy,
        decided_at: new Date().toISOString(),
        status: "Approved",
      })
      .eq("id", mission.id);

    if (error) {
      setError("Failed to save decision. " + error.message);
    } else {
      const { error: droneError } = await supabase
        .from("drones")
        .update({ status: "In Mission" })
        .eq("drone_id", mission.droneId);

      if (droneError) {
        setError("Mission approved, but failed to update drone status. " + droneError.message);
      }

      fetchMissions();
    }
    setSaving(false);
  }

  async function handleReject() {
    if (isLocked || !remark.trim()) return;
    setSaving(true);

    const decidedBy = profile?.full_name || "Administrator";

    const { error } = await supabase
      .from("missions")
      .update({
        decision: "rejected",
        decided_by: decidedBy,
        decided_at: new Date().toISOString(),
        status: "Rejected",
      })
      .eq("id", mission.id);

    if (error) {
      setError("Failed to save decision. " + error.message);
    } else {
      fetchMissions();
    }
    setSaving(false);
  }

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">{mission.name} — Risk Result</h1>
          <p className="text-textBody text-sm">
            Submitted by {mission.submittedBy} · {mission.checklistStatus}
          </p>
        </div>

        <div className="relative w-full sm:w-auto">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-cardDark border border-gray-700 flex items-center justify-between sm:justify-start gap-2 text-sm font-semibold hover:border-accentTeal"
          >
            <span className="truncate">{mission.name}</span>
            <ChevronDown size={16} className="shrink-0" />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-full sm:w-56 bg-cardDark border border-gray-700 rounded-lg overflow-hidden z-10">
              {missions.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedMissionId(m.id);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-bgDark ${
                    m.id === selectedMissionId ? "text-accentTeal font-semibold" : "text-textBody"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-cardDark rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <span className={`text-5xl font-bold ${riskColor}`}>{mission.riskScore}</span>
            <div className="flex-1">
              <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full ${riskBarColor}`}
                  style={{ width: `${mission.riskScore}%` }}
                />
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${riskBadgeColor}`}>
                {mission.riskLevel}
              </span>
            </div>
          </div>

          <h3 className="font-bold mb-3">Contributing conditions</h3>
          <ul className="flex flex-col gap-2 mb-6">
            {mission.conditions.length === 0 ? (
              <li className="text-sm text-textBody">No contributing conditions recorded.</li>
            ) : (
              mission.conditions.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-textBody">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                  {c.label}
                </li>
              ))
            )}
          </ul>

          <h3 className="font-bold mb-2">Blocking reasons</h3>
          <p className="text-sm text-textBody">
            {mission.blockingReasons.length > 0
              ? mission.blockingReasons.join(", ")
              : isHighRiskBlocked
              ? "High-risk mission — must be corrected and re-evaluated before it can be approved."
              : "None — no critical checklist item failed."}
          </p>
        </div>

        <div className="bg-cardDark rounded-xl p-6 flex flex-col">
          <h3 className="font-bold mb-4">Decision</h3>

          <label className="text-textBody text-sm mb-1">Remark (required if rejecting)</label>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Enter remark..."
            rows={6}
            disabled={isLocked}
            className="w-full p-3 rounded-lg bg-bgDark border border-gray-700 text-white text-sm outline-none focus:border-accentTeal mb-4 disabled:opacity-60"
          />

          {requiresRemark && !isLocked && (
            <p className="text-red-400 text-xs mb-3">A remark is required to reject this mission.</p>
          )}

          <button
            onClick={handleApprove}
            disabled={isBlocked || isLocked || saving}
            className={`w-full py-3 rounded-full font-semibold mb-3 ${
              isBlocked || isLocked || saving
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-accentTeal text-bgDark hover:opacity-90"
            }`}
          >
            {saving ? "Saving..." : "Approve Mission"}
          </button>

          <button
            onClick={handleReject}
            disabled={isLocked || !remark.trim() || saving}
            className={`w-full py-3 rounded-full font-semibold mb-4 ${
              isLocked || !remark.trim() || saving
                ? "border border-gray-600 text-gray-500 cursor-not-allowed"
                : "border border-red-400 text-red-400 hover:bg-red-400/10"
            }`}
          >
            {saving ? "Saving..." : "Reject Mission"}
          </button>

          {mission.decision === "approved" && (
            <div className="text-center mb-2">
              <p className="text-accentTeal text-sm font-semibold">Mission approved.</p>
              <p className="text-textBody text-xs mt-1">
                Decided by {mission.decidedBy} · {new Date(mission.decidedAt).toLocaleString()}
              </p>
            </div>
          )}
          {mission.decision === "rejected" && (
            <div className="text-center mb-2">
              <p className="text-red-400 text-sm font-semibold">Mission rejected.</p>
              <p className="text-textBody text-xs mt-1">
                Decided by {mission.decidedBy} · {new Date(mission.decidedAt).toLocaleString()}
              </p>
            </div>
          )}

          <div className="mt-auto flex items-start gap-2 text-textBody text-xs bg-bgDark rounded-lg p-3">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <p>
              Medium-risk missions require Administrator sign-off. An Operator cannot approve
              their own or any Medium/High-risk mission. Once recorded, a decision cannot be edited or removed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RiskApproval;