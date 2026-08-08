import { useState, useEffect } from "react";
import { Search, Download } from "lucide-react";
import { supabase } from "../supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SkeletonTable } from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";

// Columns jo report mein nahi dikhani (internal/technical fields)
const HIDDEN_FIELDS = ["id", "created_at", "updated_at", "user_id"];

function prettyLabel(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function Reports() {
  const { profile } = useAuth();
  const role = profile?.role ?? null;

  const [reportType, setReportType] = useState("Mission Readiness Report");
  const [dateRange, setDateRange] = useState("");
  const [mission, setMission] = useState("");
  const [exportFormat, setExportFormat] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [fieldErrors, setFieldErrors] = useState({});
  const [generating, setGenerating] = useState(false);

  const [missionOptions, setMissionOptions] = useState([]);
  const [generatedReports, setGeneratedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function mapFromDb(row) {
    return {
      id: row.id,
      name: row.name,
      format: row.format,
      date: row.date,
      by: row.by,
      status: row.status,
      mission_id: row.mission_id,
      report_type: row.report_type,
    };
  }

  async function fetchReports() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError("Could not load reports. " + error.message);
    } else {
      setGeneratedReports(data.map(mapFromDb));
    }
    setLoading(false);
  }

  async function fetchMissionOptions() {
    const { data } = await supabase.from("missions").select("id, name").order("created_at", { ascending: false });
    if (data) setMissionOptions(data);
  }

  useEffect(() => {
    fetchReports();
    fetchMissionOptions();
  }, []);

  const formatColor = (f) =>
    f === "PDF" ? "bg-red-400/20 text-red-400" : "bg-accentTeal/20 text-accentTeal";

  const statusColor = (s) =>
    s === "Active" ? "bg-accentTeal/20 text-accentTeal" : "bg-gray-500/20 text-gray-300";

  const activeCount = generatedReports.filter((r) => r.status === "Active").length;
  const archivedCount = generatedReports.filter((r) => r.status === "Archived").length;

  const filteredReports = generatedReports
    .filter((r) => (filter === "All" ? true : r.status === filter))
    .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));

  // Mission ka poora row fetch karke generic key/value rows banata hai —
  // isse chahe missions table mein jo bhi columns hon, sab report mein aayenge
  async function getMissionRows(missionId) {
    const { data, error } = await supabase
      .from("missions")
      .select("*")
      .eq("id", missionId)
      .single();

    if (error || !data) return [["Mission", "Data not found"]];

    return Object.entries(data)
      .filter(([key]) => !HIDDEN_FIELDS.includes(key))
      .map(([key, value]) => [prettyLabel(key), value === null || value === "" ? "-" : String(value)]);
  }

  function buildCsvBlob(rows) {
    const csvContent =
      "Field,Value\n" + rows.map(([k, v]) => `"${k}","${String(v).replace(/"/g, '""')}"`).join("\n");
    return new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  }

  function buildPdfBlob(title, rows) {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(title, 14, 18);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
    autoTable(doc, {
      startY: 32,
      head: [["Field", "Value"]],
      body: rows,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [20, 184, 166] },
    });
    return doc.output("blob");
  }

  function openPrintableView(title, rows) {
    const win = window.open("", "_blank");
    if (!win) {
      alert("Popup blocked. Please allow popups to use Printable view.");
      return;
    }
    const rowsHtml = rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:8px;border:1px solid #ccc;font-weight:600;">${k}</td><td style="padding:8px;border:1px solid #ccc;">${v}</td></tr>`
      )
      .join("");
    win.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: sans-serif; padding: 24px; }
            h1 { font-size: 20px; }
            table { border-collapse: collapse; width: 100%; margin-top: 16px; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <table>${rowsHtml}</table>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Format ke hisaab se sahi output produce karta hai
  async function produceAndDeliver(missionId, format, title) {
    const rows = await getMissionRows(missionId);

    if (format === "CSV") {
      downloadBlob(buildCsvBlob(rows), `${title}.csv`);
    } else if (format === "Printable view") {
      openPrintableView(title, rows);
    } else {
      // default: PDF
      downloadBlob(buildPdfBlob(title, rows), `${title}.pdf`);
    }
  }

  async function handleGenerate(e) {
    e.preventDefault();
    setFieldErrors({});

    if (!mission) {
      setFieldErrors({ mission: "Please select a mission to generate this report against." });
      return;
    }
    if (!exportFormat) {
      setFieldErrors({ exportFormat: "Please select an export format before generating." });
      return;
    }

    setGenerating(true);

    const selectedMission = missionOptions.find((m) => m.id === mission);
    const reportName = `${reportType} — ${selectedMission ? selectedMission.name : mission}`;

    const { error } = await supabase.from("reports").insert({
      name: reportName,
      format: exportFormat,
      date: new Date().toISOString().split("T")[0],
      by: "Current User",
      status: "Active",
      mission_id: mission,
      report_type: reportType,
    });

    if (error) {
      setFieldErrors({ form: "Failed to generate report. " + error.message });
      setGenerating(false);
      return;
    }

    try {
      await produceAndDeliver(mission, exportFormat, reportName);
    } catch (err) {
      console.error("Report file generation failed", err);
      setFieldErrors({ form: "Report saved, but file generation failed. Try downloading it again below." });
    }

    setGenerating(false);
    setMission("");
    setExportFormat("");
    setDateRange("");
    fetchReports();
  }

  async function handleDownload(r) {
    try {
      await produceAndDeliver(r.mission_id, r.format, r.name);
    } catch (err) {
      setError("Failed to download report. " + err.message);
    }
  }

  async function toggleArchive(id) {
    const current = generatedReports.find((r) => r.id === id);
    const newStatus = current.status === "Active" ? "Archived" : "Active";

    const { error } = await supabase
      .from("reports")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      setError("Failed to update report status. " + error.message);
    } else {
      setGeneratedReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
    }
  }

  const canGenerate = role !== "Viewer";

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold mb-4">
        {canGenerate ? "Generate Report" : "Reports"}
      </h1>

      {canGenerate && (
        <form
          onSubmit={handleGenerate}
          className="bg-cardDark p-6 rounded-xl mb-6 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div>
            <label className="text-textBody text-sm">Report type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
            >
              <option>Mission Readiness Report</option>
              <option>Fleet Battery Health</option>
              <option>Maintenance Summary</option>
              <option>Compliance Audit</option>
            </select>
          </div>

          <div>
            <label className="text-textBody text-sm">Date range</label>
            <input
              type="text"
              placeholder="Select date range..."
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
            />
          </div>

          <div>
            <label className="text-textBody text-sm">Mission</label>
            <select
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
            >
              <option value="">Select mission...</option>
              {missionOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            {fieldErrors.mission && <p className="text-red-400 text-xs mt-1">{fieldErrors.mission}</p>}
          </div>

          <div>
            <label className="text-textBody text-sm">Export format</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
            >
              <option value="">PDF / Printable view / CSV</option>
              <option>PDF</option>
              <option>Printable view</option>
              <option>CSV</option>
            </select>
            {fieldErrors.exportFormat && <p className="text-red-400 text-xs mt-1">{fieldErrors.exportFormat}</p>}
          </div>

          {fieldErrors.form && (
            <p className="md:col-span-2 text-red-400 text-sm">{fieldErrors.form}</p>
          )}

          <div className="md:col-span-2">
            <button type="submit" disabled={generating} className="btn-primary disabled:opacity-50">
              {generating ? "Generating..." : "Generate Report"}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
        <h2 className="text-lg font-bold">Generated Reports</h2>
        <div className="relative w-full sm:w-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-textBody" />
          <input
            type="text"
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-auto pl-9 pr-3 py-2 rounded bg-cardDark border border-gray-700 text-white outline-none focus:border-accentTeal text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {[
          { key: "All", label: `All (${generatedReports.length})` },
          { key: "Active", label: `Active (${activeCount})` },
          { key: "Archived", label: `Archived (${archivedCount})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              filter === tab.key
                ? "bg-accentTeal text-bgDark"
                : "bg-cardDark text-textBody border border-gray-700 hover:border-accentTeal"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="bg-cardDark p-4 rounded overflow-x-auto">
   {loading ? (
  <SkeletonTable rows={5} columns={6} />
) : filteredReports.length === 0 ? (
          <p className="text-textBody text-center py-8">No Reports Found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-textBody text-left">
                <th className="pb-2 pr-4">Report</th>
                <th className="pb-2 pr-4">Format</th>
                <th className="pb-2 pr-4">Generated</th>
                <th className="pb-2 pr-4">By</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => (
                <tr key={r.id} className="border-t border-gray-700">
                  <td className="py-3 pr-4 font-semibold">{r.name}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${formatColor(r.format)}`}>
                      {r.format}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-textBody">{r.date}</td>
                  <td className="py-3 pr-4 text-textBody">{r.by}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 text-right space-x-3 whitespace-nowrap">
                    <button
                      onClick={() => handleDownload(r)}
                      className="font-semibold text-accentTeal hover:underline inline-flex items-center gap-1"
                    >
                      <Download size={14} /> Download
                    </button>
                    {canGenerate && (
                      <button
                        onClick={() => toggleArchive(r.id)}
                        className={`font-semibold ${
                          r.status === "Active" ? "text-textBody hover:text-red-400" : "text-accentTeal"
                        }`}
                      >
                        {r.status === "Active" ? "Archive" : "Unarchive"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Reports;