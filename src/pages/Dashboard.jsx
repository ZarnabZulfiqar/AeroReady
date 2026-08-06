import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { SkeletonCards, SkeletonTable } from "../components/Skeleton";

const CYCLE_THRESHOLD = 150;

function Dashboard() {
  const navigate = useNavigate();
  const [missions, setMissions] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [stats, setStats] = useState({
    activeDrones: 0,
    groundedDrones: 0,
    batteriesToInspect: 0,
    criticalBatteries: 0,
    upcomingMissions: 0,
    nextMissionDate: null,
    openMaintenance: 0,
    unresolvedCritical: 0,
    pendingApprovals: 0,
    highRiskApprovals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      setError("");

      const today = new Date().toISOString().split("T")[0];

      const { data: missionsData, error: missionsError } = await supabase
        .from("missions")
        .select("*, drones(model)")
        .order("scheduled_date", { ascending: true });
      if (missionsError) throw missionsError;

      const { data: dronesData, error: dronesError } = await supabase
        .from("drones")
        .select("status");
      if (dronesError) throw dronesError;

      const { data: batteriesData, error: batteriesError } = await supabase
        .from("batteries")
        .select("health_status, cycle_count");
      if (batteriesError) throw batteriesError;

      const { data: faultData, error: faultError } = await supabase
        .from("fault_reports")
        .select("status, severity");
      if (faultError) throw faultError;

      const upcomingMissionsData = (missionsData || []).filter(
        (m) => m.scheduled_date >= today && m.status !== "Completed"
      );
      const approvalsData = (missionsData || [])
        .filter((m) => m.decision)
        .sort((a, b) => new Date(b.decided_at) - new Date(a.decided_at));

      setMissions(upcomingMissionsData);
      setApprovals(approvalsData);

      setStats({
        activeDrones: dronesData?.filter((d) => d.status === "Available").length || 0,
        groundedDrones: dronesData?.filter((d) => d.status === "Maintenance" || d.status === "Damaged").length || 0,
        batteriesToInspect:
          batteriesData?.filter(
            (b) =>
              Number(b.cycle_count) > CYCLE_THRESHOLD ||
              b.health_status === "Weak" ||
              b.health_status === "Damaged"
          ).length || 0,
        criticalBatteries: batteriesData?.filter((b) => b.health_status === "Damaged").length || 0,
        upcomingMissions: upcomingMissionsData.length,
        nextMissionDate: upcomingMissionsData[0]?.scheduled_date || null,
        openMaintenance: faultData?.filter((f) => f.status === "Open").length || 0,
        unresolvedCritical: faultData?.filter((f) => f.status === "Open" && f.severity === "High").length || 0,
        pendingApprovals: (missionsData || []).filter((m) => m.status === "Pending Approval").length || 0,
        highRiskApprovals: (missionsData || []).filter((m) => m.status === "Pending Approval" && m.risk_level === "High").length || 0,
      });
    } catch (err) {
      console.error("Error fetching dashboard data:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const statusColor = (s) =>
    s === "Approved" ? "text-accentTeal" :
    s === "Rejected" ? "text-red-400" :
    s === "Draft" ? "text-gray-400" :
    "text-orange-400";

  // Har card ka apna target route
  const statCards = [
    {
      key: "drones",
      label: "Active Drones",
      value: stats.activeDrones,
      sub: `${stats.groundedDrones} grounded`,
      path: "/drones",
    },
    {
      key: "batteries",
      label: "Batteries to Inspect",
      value: stats.batteriesToInspect,
      sub: `${stats.criticalBatteries} critical`,
      path: "/batteries",
    },
    {
      key: "missions",
      label: "Upcoming Missions",
      value: stats.upcomingMissions,
      sub: stats.nextMissionDate ? `Next: ${stats.nextMissionDate}` : "No upcoming missions",
      path: "/missions",
    },
    {
      key: "maintenance",
      label: "Open Maintenance Items",
      value: stats.openMaintenance,
      sub: `${stats.unresolvedCritical} unresolved critical`,
      path: "/maintenance",
    },
    {
      key: "approvals",
      label: "Pending Approvals",
      value: stats.pendingApprovals,
      sub: `${stats.highRiskApprovals} high-risk`,
      path: "/risk-approval",
    },
  ];

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
  <>
    <div className="mb-6">
      <SkeletonCards count={5} />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SkeletonTable rows={4} columns={4} />
      <SkeletonTable rows={4} columns={4} />
    </div>
  </>
) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {statCards.map((card) => (
              <button
                key={card.key}
                onClick={() => navigate(card.path)}
                className="bg-cardDark p-4 rounded text-left w-full hover:border hover:border-accentTeal transition-colors cursor-pointer"
              >
                <p className="text-textBody text-sm">{card.label}</p>
                <p className="text-2xl font-bold text-accentTeal">{card.value}</p>
                <p className="text-textBody text-xs mt-1">{card.sub}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-cardDark p-4 rounded">
              <h2 className="font-bold mb-3">Upcoming Missions</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-textBody text-left">
                      <th className="pb-2 pr-4">Mission</th>
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4">Drone</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missions.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="py-4 text-center text-textBody">No missions found</td>
                      </tr>
                    ) : (
                      missions.map((m) => (
                        <tr key={m.id} className="border-t border-gray-700">
                          <td className="py-2 pr-4">{m.name}</td>
                          <td className="py-2 pr-4 text-textBody">{m.scheduled_date}</td>
                          <td className="py-2 pr-4 text-textBody">
                            {m.drones ? `${m.drone_id} (${m.drones.model})` : m.drone_id || "—"}
                          </td>
                          <td className={`py-2 font-semibold ${statusColor(m.status)}`}>{m.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-cardDark p-4 rounded">
              <h2 className="font-bold mb-3">Recent Approvals</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-textBody text-left">
                      <th className="pb-2 pr-4">Request</th>
                      <th className="pb-2 pr-4">Submitted</th>
                      <th className="pb-2 pr-4">Approver</th>
                      <th className="pb-2">Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvals.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="py-4 text-center text-textBody">No approvals found</td>
                      </tr>
                    ) : (
                      approvals.map((a) => (
                        <tr key={a.id} className="border-t border-gray-700">
                          <td className="py-2 pr-4">{a.name}</td>
                          <td className="py-2 pr-4 text-textBody">
                            {a.decided_at ? new Date(a.decided_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-2 pr-4 text-textBody">{a.decided_by || "—"}</td>
                          <td className={`py-2 font-semibold ${statusColor(a.decision)}`}>{a.decision}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;