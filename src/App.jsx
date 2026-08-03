import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./components/Sidebar";
import { supabase } from "./supabaseClient";

import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Drones from "./pages/Drones";
import Batteries from "./pages/Batteries";
import Missions from "./pages/Missions";
import MissionChecklist from "./pages/MissionChecklist";
import ChecklistTemplates from "./pages/ChecklistTemplates";
import RiskApproval from "./pages/RiskApproval";
import Maintenance from "./pages/Maintenance";
import Reports from "./pages/Reports";
import Traceability from "./pages/Traceability";
import Users from "./pages/Users";
import Settings from "./pages/Settings";

function ProtectedRoute({ children, allowedRoles }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (active) setStatus("unauthenticated");
        return;
      }

      if (!allowedRoles) {
        if (active) setStatus("allowed");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", session.user.id)
        .single();

      if (error || !profile || profile.status === "Deactivated") {
        await supabase.auth.signOut();
        if (active) setStatus("unauthenticated");
        return;
      }

      if (allowedRoles.includes(profile.role)) {
        if (active) setStatus("allowed");
      } else {
        if (active) setStatus("denied");
      }
    }

    checkAccess();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && active) setStatus("unauthenticated");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [allowedRoles]);

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center text-textBody text-sm">
        Checking access...
      </div>
    );
  }

  if (status === "unauthenticated") return <Navigate to="/" replace />;
  if (status === "denied") return <Navigate to="/dashboard" replace />;

  return children;
}

function AppLayout({ children }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#0A0E17] text-white flex">
      <Sidebar
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 min-w-0 min-h-screen flex flex-col bg-[#0A0E17] md:pl-64">
        <header className="h-14 w-full px-4 md:px-8 flex justify-between md:justify-end items-center gap-3 bg-[#0A0E17] border-b border-gray-800/80 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-slate-300 hover:text-white"
          >
            <Menu size={22} />
          </button>

          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-full bg-[#14b8a6] flex items-center justify-center text-[#0A0E17] font-bold text-xs shadow-md cursor-pointer"
            title="Setting"
          >
            ZA
          </button>
        </header>
        <div className="flex-1 min-w-0 w-full px-4 md:px-8 pt-6 pb-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/drones" element={<ProtectedRoute><AppLayout><Drones /></AppLayout></ProtectedRoute>} />
        <Route path="/batteries" element={<ProtectedRoute><AppLayout><Batteries /></AppLayout></ProtectedRoute>} />
        <Route path="/missions" element={<ProtectedRoute><AppLayout><Missions /></AppLayout></ProtectedRoute>} />
        <Route path="/checklist-templates" element={<ProtectedRoute><AppLayout><ChecklistTemplates /></AppLayout></ProtectedRoute>} />
        <Route path="/checklists/:id" element={<ProtectedRoute><AppLayout><MissionChecklist /></AppLayout></ProtectedRoute>} />
        <Route path="/risk-approval" element={<ProtectedRoute><AppLayout><RiskApproval /></AppLayout></ProtectedRoute>} />
        <Route path="/maintenance" element={<ProtectedRoute><AppLayout><Maintenance /></AppLayout></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
        <Route path="/traceability" element={<ProtectedRoute><AppLayout><Traceability /></AppLayout></ProtectedRoute>} />

        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={["Administrator"]}>
              <AppLayout><Users /></AppLayout>
            </ProtectedRoute>
          }
        />

        <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;