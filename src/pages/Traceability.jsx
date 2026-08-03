import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { supabase } from "../supabaseClient";

function Traceability() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const emptyRecord = { frId: "", design: "", impl: "", testCase: "", status: "Planned" };
  const [newRecord, setNewRecord] = useState(emptyRecord);

  function mapFromDb(row) {
    return {
      frId: row.fr_id,
      design: row.design,
      impl: row.implementation,
      testCase: row.test_case,
      status: row.status,
    };
  }

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "Administrator") {
      setIsAdmin(true);
    }
  }

  async function fetchRecords() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("traceability")
      .select("*")
      .order("fr_id", { ascending: true });

    if (error) {
      setError("Could not load traceability records. " + error.message);
    } else {
      setRecords(data.map(mapFromDb));
    }
    setLoading(false);
  }

  useEffect(() => {
    checkAdmin();
    fetchRecords();
  }, []);

  // FR-041 / Section 11: evidence status is Planned, Passed, Failed or Blocked
  const filters = ["All", "Planned", "Passed", "Failed", "Blocked"];

  const statusColor = (s) =>
    s === "Passed"
      ? "bg-accentTeal/20 text-accentTeal"
      : s === "Failed"
      ? "bg-red-400/20 text-red-400"
      : s === "Blocked"
      ? "bg-orange-400/20 text-orange-400"
      : "bg-gray-500/20 text-gray-300";

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.frId.toLowerCase().includes(search.toLowerCase()) ||
      r.design.toLowerCase().includes(search.toLowerCase()) ||
      r.testCase.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "All" || r.status === filter;
    return matchesSearch && matchesFilter;
  });

  function validateRecord() {
    const errs = {};
    if (!newRecord.frId) errs.frId = "FR ID is required.";
    else if (records.some((r) => r.frId.toLowerCase() === newRecord.frId.toLowerCase())) {
      errs.frId = "A record with this FR ID already exists.";
    }
    if (!newRecord.design) errs.design = "Design reference is required.";
    if (!newRecord.impl) errs.impl = "Implementation is required.";
    if (!newRecord.testCase) errs.testCase = "Test case is required.";
    return errs;
  }

  async function handleAddRecord(e) {
    e.preventDefault();
    setFieldErrors({});

    const errs = validateRecord();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("traceability").insert({
      fr_id: newRecord.frId,
      design: newRecord.design,
      implementation: newRecord.impl,
      test_case: newRecord.testCase,
      status: newRecord.status,
    });

    if (error) {
      setFieldErrors({ form: "Failed to add record. " + error.message });
      setSaving(false);
      return;
    }

    setSaving(false);
    setNewRecord(emptyRecord);
    setShowForm(false);
    fetchRecords();
  }

  return (
    <div className="w-full">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-1">
        <div>
          <h1 className="text-2xl font-bold">Requirements Traceability Register</h1>
          <p className="text-accentTeal text-sm">
            {isAdmin ? "Administrator can add records" : "Read-only · updated weekly during supervisor review"}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setNewRecord(emptyRecord);
              setFieldErrors({});
              setShowForm(true);
            }}
            className="btn-primary"
          >
            + Add Record
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 mt-4">
        <div className="relative w-full max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-textBody" />
          <input
            type="text"
            placeholder="Search by FR ID, design, or test case..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded bg-cardDark border border-gray-700 text-white outline-none focus:border-accentTeal text-sm"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
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
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="bg-cardDark p-4 rounded overflow-x-auto">
        {loading ? (
          <p className="text-textBody text-center py-8">Loading records...</p>
        ) : filteredRecords.length === 0 ? (
          <p className="text-textBody text-center py-8">No Records Found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-textBody text-left">
                <th className="pb-2 pr-4">FR ID</th>
                <th className="pb-2 pr-4">Design Reference</th>
                <th className="pb-2 pr-4">Implementation</th>
                <th className="pb-2 pr-4">Test Case</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => (
                <tr key={r.frId} className="border-t border-gray-700">
                  <td className="py-3 pr-4 font-semibold text-accentTeal">{r.frId}</td>
                  <td className="py-3 pr-4">{r.design}</td>
                  <td className="py-3 pr-4 text-textBody font-mono text-xs">{r.impl}</td>
                  <td className="py-3 pr-4 text-textBody">{r.testCase}</td>
                  <td className="py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-textBody text-xs mt-4">
        {isAdmin
          ? "As Administrator, you can add new traceability records above."
          : "This register is read-only. Contact your supervisor to request changes."}
      </p>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleAddRecord}
            className="bg-cardDark p-6 rounded-xl w-full max-w-md flex flex-col gap-4 relative max-h-[90vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-textBody hover:text-white text-lg"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold mb-2">Add Traceability Record</h2>

            <div>
              <label className="text-textBody text-sm">FR ID</label>
              <input
                placeholder="e.g. FR-045"
                value={newRecord.frId}
                onChange={(e) => setNewRecord({ ...newRecord, frId: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
              />
              {fieldErrors.frId && <p className="text-red-400 text-xs mt-1">{fieldErrors.frId}</p>}
            </div>

            <div>
              <label className="text-textBody text-sm">Design Reference</label>
              <input
                placeholder="e.g. Payload checklist rule"
                value={newRecord.design}
                onChange={(e) => setNewRecord({ ...newRecord, design: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
              />
              {fieldErrors.design && <p className="text-red-400 text-xs mt-1">{fieldErrors.design}</p>}
            </div>

            <div>
              <label className="text-textBody text-sm">Implementation</label>
              <input
                placeholder="e.g. MissionChecklist.jsx"
                value={newRecord.impl}
                onChange={(e) => setNewRecord({ ...newRecord, impl: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
              />
              {fieldErrors.impl && <p className="text-red-400 text-xs mt-1">{fieldErrors.impl}</p>}
            </div>

            <div>
              <label className="text-textBody text-sm">Test Case</label>
              <input
                placeholder="e.g. TC-014"
                value={newRecord.testCase}
                onChange={(e) => setNewRecord({ ...newRecord, testCase: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
              />
              {fieldErrors.testCase && <p className="text-red-400 text-xs mt-1">{fieldErrors.testCase}</p>}
            </div>

            <div>
              <label className="text-textBody text-sm">Status</label>
              <select
                value={newRecord.status}
                onChange={(e) => setNewRecord({ ...newRecord, status: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
              >
                <option>Planned</option>
                <option>Passed</option>
                <option>Failed</option>
                <option>Blocked</option>
              </select>
            </div>

            {fieldErrors.form && <p className="text-red-400 text-sm">{fieldErrors.form}</p>}

            <div className="flex justify-end mt-3">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving..." : "Add Record"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Traceability;