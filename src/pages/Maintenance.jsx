import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { supabase } from "../supabaseClient";

function Maintenance() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const emptyIssue = {
    id: "", asset: "", issueType: "", severity: "Medium", reportedBy: "", status: "Open",
    actionTaken: "", inspectionOutcome: "", nextDueDate: "", closureRemarks: "",
  };
  const [newIssue, setNewIssue] = useState(emptyIssue);

  const filters = ["All", "Low", "Medium", "High"];

  const severityColor = (s) =>
    s === "High" ? "bg-red-400/20 text-red-400" :
    s === "Medium" ? "bg-orange-400/20 text-orange-400" :
    "bg-gray-500/20 text-gray-300";

  const statusColor = (s) =>
    s === "Open" ? "bg-orange-400/20 text-orange-400" : "bg-accentTeal/20 text-accentTeal";

  function assetTypeFromId(assetId) {
    if (assetId.toUpperCase().startsWith("DR")) return "drone";
    if (assetId.toUpperCase().startsWith("BT")) return "battery";
    return "other";
  }

  // FR-035 / FR-037: update the asset's own status (drones.status or
  // batteries.health_status-adjacent status) when a fault is logged/resolved
  async function updateAssetStatus(assetType, assetId, status) {
    if (assetType === "drone") {
      const { error } = await supabase.from("drones").update({ status }).eq("drone_id", assetId);
      if (error) return error;
    } else if (assetType === "battery") {
      const { error } = await supabase.from("batteries").update({ status }).eq("battery_id", assetId);
      if (error) return error;
    }
    return null;
  }

  function mapFromDb(row) {
    const record = Array.isArray(row.maintenance_records) && row.maintenance_records.length > 0
      ? row.maintenance_records[0]
      : null;
    return {
      id: row.fault_id,
      asset: row.asset_id,
      issueType: row.fault_type || "",
      severity: row.severity,
      reportedBy: row.reported_by || "",
      status: row.status,
      actionTaken: record?.action_taken || "",
      inspectionOutcome: record?.inspection_outcome || "",
      nextDueDate: record?.next_due_date || "",
      closureRemarks: record?.closure_remarks || "",
    };
  }

  async function fetchIssues() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("fault_reports")
      .select("*, maintenance_records(*)")
      .order("reported_at", { ascending: true });

    if (error) {
      setError("Could not load maintenance issues. " + error.message);
    } else {
      setIssues(data.map(mapFromDb));
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchIssues();
  }, []);

  const filteredIssues = issues.filter((i) => {
    const matchesSearch =
      i.asset.toLowerCase().includes(search.toLowerCase()) ||
      i.issueType.toLowerCase().includes(search.toLowerCase()) ||
      i.reportedBy.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "All" || i.severity === filter;
    return matchesSearch && matchesFilter;
  });

  async function handleSaveIssue(e) {
    e.preventDefault();
    setFieldErrors({});

    if (!newIssue.id || !newIssue.asset || !newIssue.issueType) {
      setFieldErrors({ form: "Please fill in all required fields." });
      return;
    }

    if (newIssue.status === "Resolved") {
      if (!newIssue.actionTaken || !newIssue.inspectionOutcome || !newIssue.nextDueDate) {
        setFieldErrors({ form: "Action taken, inspection outcome and next due date are required to mark an issue Resolved." });
        return;
      }
    }

    setSaving(true);
    const assetType = assetTypeFromId(newIssue.asset);

    if (editingId) {
      const { error: faultError } = await supabase
        .from("fault_reports")
        .update({
          asset_type: assetType,
          asset_id: newIssue.asset,
          fault_type: newIssue.issueType,
          severity: newIssue.severity,
          reported_by: newIssue.reportedBy,
          status: newIssue.status,
        })
        .eq("fault_id", editingId);

      if (faultError) {
        setFieldErrors({ form: "Failed to save changes. " + faultError.message });
        setSaving(false);
        return;
      }

      if (newIssue.status === "Resolved") {
        const { error: recError } = await supabase.from("maintenance_records").insert({
          maintenance_id: "MR-" + editingId,
          fault_id: editingId,
          asset_type: assetType,
          asset_id: newIssue.asset,
          action_taken: newIssue.actionTaken,
          inspection_outcome: newIssue.inspectionOutcome,
          next_due_date: newIssue.nextDueDate,
          closure_remarks: newIssue.closureRemarks,
        });
        if (recError && !recError.message.includes("duplicate")) {
          setFieldErrors({ form: "Failed to save resolution details. " + recError.message });
          setSaving(false);
          return;
        }

        // FR-037 / BR-008: reinstate asset to Available once issue is Resolved
        const statusError = await updateAssetStatus(assetType, newIssue.asset, "Available");
        if (statusError) {
          setFieldErrors({ form: "Resolution saved but failed to reinstate asset status. " + statusError.message });
          setSaving(false);
          return;
        }
      }
    } else {
      const { error } = await supabase.from("fault_reports").insert({
        fault_id: newIssue.id,
        asset_type: assetType,
        asset_id: newIssue.asset,
        fault_type: newIssue.issueType,
        severity: newIssue.severity,
        reported_by: newIssue.reportedBy,
        status: newIssue.status,
      });

      if (error) {
        setFieldErrors({ form: "Failed to report issue. " + error.message });
        setSaving(false);
        return;
      }

      // FR-035 / BR-007: set affected asset to Maintenance when a new
      // unresolved issue is logged against it
      if (newIssue.status !== "Resolved") {
        const statusError = await updateAssetStatus(assetType, newIssue.asset, "Maintenance");
        if (statusError) {
          setFieldErrors({ form: "Issue reported but failed to update asset status. " + statusError.message });
          setSaving(false);
          return;
        }
      }
    }

    setSaving(false);
    setNewIssue(emptyIssue);
    setEditingId(null);
    setShowForm(false);
    fetchIssues();
  }

  function handleEdit(issue) {
    setNewIssue(issue);
    setEditingId(issue.id);
    setFieldErrors({});
    setShowForm(true);
  }

  return (
    <div className="w-full">
      {/* Header row: stacks on mobile, side-by-side on larger screens */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Maintenance</h1>
        <button
          onClick={() => {
            setNewIssue(emptyIssue);
            setEditingId(null);
            setFieldErrors({});
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + Report Issue
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <input
        type="text"
        placeholder="Search open issues..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md mb-4 p-2 rounded bg-cardDark border border-gray-700 text-white outline-none focus:border-accentTeal"
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? "px-4 py-1 rounded-full bg-accentTeal text-bgDark text-sm font-semibold"
                : "px-4 py-1 rounded-full border border-gray-600 text-textBody text-sm hover:border-accentTeal"
            }
          >
            {f}
          </button>
        ))}
      </div>

      {/* No forced min-width, so a scrollbar only appears when content
          genuinely doesn't fit — stays invisible on desktop otherwise */}
      <div className="bg-cardDark p-4 rounded overflow-x-auto">
        {loading ? (
          <p className="text-textBody text-center py-8">Loading issues...</p>
        ) : filteredIssues.length === 0 ? (
          <p className="text-textBody text-center py-8">
            No {filter === "All" ? "" : filter} Issues{filter === "All" ? " Found" : ""}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-textBody text-left">
                <th className="pb-2 pr-4">Asset</th>
                <th className="pb-2 pr-4">Issue Type</th>
                <th className="pb-2 pr-4">Severity</th>
                <th className="pb-2 pr-4">Reported By</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((i) => (
                <tr key={i.id} className="border-t border-gray-700">
                  <td className="py-3 pr-4 font-semibold">{i.asset}</td>
                  <td className="py-3 pr-4 text-textBody">{i.issueType}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${severityColor(i.severity)}`}>
                      {i.severity}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-textBody">{i.reportedBy}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(i.status)}`}>
                      {i.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => handleEdit(i)} className="text-accentTeal">
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSaveIssue}
            className="bg-cardDark p-6 rounded-xl w-full max-w-2xl flex flex-col gap-4 relative max-h-[90vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-textBody hover:text-white text-lg"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold mb-2">
              {editingId ? "Edit Issue" : "Report New Issue"}
            </h2>

            {/* Form fields: 1 column on mobile, 2 columns from small screens up */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-textBody text-sm">Issue ID</label>
                <input
                  placeholder="e.g. MT-004"
                  value={newIssue.id}
                  disabled={!!editingId}
                  onChange={(e) => setNewIssue({ ...newIssue, id: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-textBody text-sm">Asset</label>
                <input
                  placeholder="e.g. DR-009 or BT-005"
                  value={newIssue.asset}
                  onChange={(e) => setNewIssue({ ...newIssue, asset: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                />
              </div>

              <div>
                <label className="text-textBody text-sm">Issue Type</label>
                <input
                  placeholder="e.g. Motor vibration"
                  value={newIssue.issueType}
                  onChange={(e) => setNewIssue({ ...newIssue, issueType: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                />
              </div>

              <div>
                <label className="text-textBody text-sm">Severity</label>
                <select
                  value={newIssue.severity}
                  onChange={(e) => setNewIssue({ ...newIssue, severity: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>

              <div>
                <label className="text-textBody text-sm">Reported By</label>
                <input
                  placeholder="e.g. H. Raza"
                  value={newIssue.reportedBy}
                  onChange={(e) => setNewIssue({ ...newIssue, reportedBy: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                />
              </div>

              <div>
                <label className="text-textBody text-sm">Status</label>
                <select
                  value={newIssue.status}
                  onChange={(e) => setNewIssue({ ...newIssue, status: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                >
                  <option>Open</option>
                  <option>Resolved</option>
                </select>
              </div>
            </div>

            {newIssue.status === "Resolved" && (
              <div className="border-t border-gray-700 pt-4 flex flex-col gap-4">
                <p className="text-textBody text-xs font-semibold">Resolution details (required)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-textBody text-sm">Action Taken</label>
                    <input
                      placeholder="e.g. Motor replaced"
                      value={newIssue.actionTaken}
                      onChange={(e) => setNewIssue({ ...newIssue, actionTaken: e.target.value })}
                      className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                    />
                  </div>
                  <div>
                    <label className="text-textBody text-sm">Inspection Outcome</label>
                    <input
                      placeholder="e.g. Pass"
                      value={newIssue.inspectionOutcome}
                      onChange={(e) => setNewIssue({ ...newIssue, inspectionOutcome: e.target.value })}
                      className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                    />
                  </div>
                  <div>
                    <label className="text-textBody text-sm">Next Maintenance Due Date</label>
                    <input
                      type="date"
                      value={newIssue.nextDueDate}
                      onChange={(e) => setNewIssue({ ...newIssue, nextDueDate: e.target.value })}
                      className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                    />
                  </div>
                  <div>
                    <label className="text-textBody text-sm">Closure Remarks</label>
                    <input
                      placeholder="e.g. Battery back in service"
                      value={newIssue.closureRemarks}
                      onChange={(e) => setNewIssue({ ...newIssue, closureRemarks: e.target.value })}
                      className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                    />
                  </div>
                </div>
              </div>
            )}

            {fieldErrors.form && <p className="text-red-400 text-sm">{fieldErrors.form}</p>}

            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded border border-gray-600 text-textBody hover:border-accentTeal"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving..." : editingId ? "Save Changes" : "Report Issue"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Maintenance;