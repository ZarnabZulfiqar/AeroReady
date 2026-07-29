import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { supabase } from "../supabaseClient";

function Traceability() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function mapFromDb(row) {
    return {
      frId: row.fr_id,
      design: row.design,
      impl: row.implementation,
      testCase: row.test_case,
      status: row.status,
    };
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

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold mb-1">Requirements Traceability Register</h1>
      <p className="text-accentTeal text-sm mb-4">
        Read-only · updated weekly during supervisor review
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
                <th className="pb-2">FR ID</th>
                <th className="pb-2">Design Reference</th>
                <th className="pb-2">Implementation</th>
                <th className="pb-2">Test Case</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => (
                <tr key={r.frId} className="border-t border-gray-700">
                  <td className="py-3 font-semibold text-accentTeal">{r.frId}</td>
                  <td className="py-3">{r.design}</td>
                  <td className="py-3 text-textBody font-mono text-xs">{r.impl}</td>
                  <td className="py-3 text-textBody">{r.testCase}</td>
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
        This register is read-only. Contact your supervisor to request changes.
      </p>
    </div>
  );
}

export default Traceability;