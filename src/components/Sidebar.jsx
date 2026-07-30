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
  LogOut,
  X,
} from "lucide-react";

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { key: "drones", label: "Drones", icon: Plane, path: "/drones" },
  { key: "batteries", label: "Batteries", icon: BatteryFull, path: "/batteries" },
  { key: "missions", label: "Missions", icon: MapPin, path: "/missions" },
  { key: "checklist-templates", label: "Checklist Templates", icon: ClipboardCheck, path: "/checklist-templates" },
];

const bottomNavItems = [
  { key: "risk-approval", label: "Risk & Approval", icon: ShieldAlert, path: "/risk-approval" },
  { key: "maintenance", label: "Maintenance", icon: Wrench, path: "/maintenance" },
  { key: "reports", label: "Reports", icon: FileText, path: "/reports" },
  { key: "traceability", label: "Traceability", icon: GitBranch, path: "/traceability" },
  { key: "users", label: "Users", icon: Users, path: "/users" },
  { key: "settings", label: "Settings", icon: SettingsIcon, path: "/settings" },
];

function Sidebar({ onLogout, isOpen = false, onClose = () => {} }) {
  const location = useLocation();
  const currentPath = location.pathname;

  const isChecklistRelated =
    currentPath === "/checklist-templates" || currentPath.startsWith("/checklists/");

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`w-64 h-screen fixed top-0 left-0 bg-cardDark border-r border-gray-700 flex flex-col z-50 transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="flex items-center justify-between gap-2.5 px-6 h-14 shrink-0 border-b border-gray-700">
          <div className="flex items-center gap-2.5">
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

          <button
            type="button"
            onClick={onClose}
            className="md:hidden text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-2 px-3 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.key === "checklist-templates"
                ? isChecklistRelated
                : currentPath === item.path;
            return (
              <Link
                key={item.key}
                to={item.path}
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

          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <Link
                key={item.key}
                to={item.path}
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
    </>
  );
}

export default Sidebar;