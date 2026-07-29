import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Plane,
  BatteryFull,
  MapPin,
  ClipboardCheck,
  ShieldAlert,
  Wrench,
  FileText,
  GitBranch,
  Users,
  Settings as SettingsIcon,
  ChevronDown,
  LogOut,
} from "lucide-react";

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { key: "drones", label: "Drones", icon: Plane, path: "/drones" },
  { key: "batteries", label: "Batteries", icon: BatteryFull, path: "/batteries" },
  { key: "missions", label: "Missions", icon: MapPin, path: "/missions" },
];

const bottomNavItems = [
  { key: "risk-approval", label: "Risk & Approval", icon: ShieldAlert, path: "/risk-approval" },
  { key: "maintenance", label: "Maintenance", icon: Wrench, path: "/maintenance" },
  { key: "reports", label: "Reports", icon: FileText, path: "/reports" },
  { key: "traceability", label: "Traceability", icon: GitBranch, path: "/traceability" },
  { key: "users", label: "Users", icon: Users, path: "/users" },
  { key: "settings", label: "Settings", icon: SettingsIcon, path: "/settings" },
];

const checklistSubItems = [
  { key: "checklist-templates", label: "Checklist Templates", path: "/checklist-templates" },
  { key: "mission-checklist", label: "Mission Checklist", path: "/mission-checklist" },
];

function Sidebar({ onLogout }) {
  const location = useLocation();
  const currentPath = location.pathname;

  const isChecklistRoute =
    currentPath === "/checklist-templates" ||
    currentPath === "/mission-checklist" ||
    currentPath.startsWith("/checklists/");

  const [checklistsOpen, setChecklistsOpen] = useState(isChecklistRoute);
  const [parentChecklistClicked, setParentChecklistClicked] = useState(false);

  useEffect(() => {
    if (isChecklistRoute) {
      setChecklistsOpen(true);
      setParentChecklistClicked(true);
    } else {
      setParentChecklistClicked(false);
    }
  }, [currentPath, isChecklistRoute]);

  const handleChecklistParentClick = () => {
    setChecklistsOpen((prev) => !prev);
    setParentChecklistClicked(true);
  };

  const handleOtherNavClick = () => {
    setParentChecklistClicked(false);
  };

  const isChecklistSelected = isChecklistRoute || parentChecklistClicked;

  return (
    <aside className="w-64 h-screen fixed top-0 left-0 bg-cardDark border-r border-gray-700 flex flex-col z-50">
      {/* Brand Logo Header */}
      <div className="flex items-center gap-2.5 px-6 h-14 shrink-0 border-b border-gray-700">
        <div className="w-8 h-8 rounded-full bg-[#14b8a6] flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-[#0A0E17]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2 L14 9 L21 12 L14 15 L12 22 L10 15 L3 12 L10 9 Z" />
          </svg>
        </div>
        <span className="font-bold text-xl tracking-tight">
          <span className="text-white">Aero</span>
          <span className="text-[#14b8a6]">Ready</span>
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-2 px-3 space-y-1 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path && !isChecklistSelected;
          return (
            <Link
              key={item.key}
              to={item.path}
              onClick={handleOtherNavClick}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-[#14b8a6]/15 text-[#14b8a6] border border-[#14b8a6]/20"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {/* Checklists Parent Button */}
        <div>
          <button
            type="button"
            onClick={handleChecklistParentClick}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all outline-none ${
              isChecklistSelected
                ? "bg-[#14b8a6]/15 text-[#14b8a6] border border-[#14b8a6]/20 font-semibold"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
          >
            <span className="flex items-center gap-3">
              <ClipboardCheck size={18} />
              Checklists
            </span>
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${checklistsOpen ? "rotate-180" : ""}`}
            />
          </button>

          {checklistsOpen && (
            <div className="ml-8 flex flex-col gap-1 mt-1 mb-1">
              {checklistSubItems.map((item) => {
                const isSubActive =
                  currentPath === item.path ||
                  (item.key === "mission-checklist" && currentPath.startsWith("/checklists/"));

                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    className={`text-left text-sm py-1.5 px-2 rounded-lg transition-colors ${
                      isSubActive
                        ? "text-[#14b8a6] font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Nav Items */}
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path && !isChecklistSelected;
          return (
            <Link
              key={item.key}
              to={item.path}
              onClick={handleOtherNavClick}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-[#14b8a6]/15 text-[#14b8a6] border border-[#14b8a6]/20"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout — SEC-AUTH-02: session invalidated on logout */}
      <div className="px-3 py-3 border-t border-gray-700 shrink-0">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <LogOut size={18} className="shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;