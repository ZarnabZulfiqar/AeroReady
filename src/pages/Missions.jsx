import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, X, ClipboardCheck } from "lucide-react";
import { supabase } from "../supabaseClient";

// FR-016 / BR-003: minimum safe charge threshold — constant for now,
// move to Settings/config table once Administrator needs to adjust it.
const MIN_SAFE_CHARGE = 30;
const CYCLE_THRESHOLD = 150;

function Missions() {
  const navigate = useNavigate();

  const [missions, setMissions] = useState([]);
  const [drones, setDrones] = useState([]);
  const [batteries, setBatteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const longPressTimer = useRef(null);

  const emptyMission = {
    id: "", name: "", droneId: "", batteryId: "", pilot: "",
    location: "", date: "", duration: "", payloadRequired: false, status: "Draft",
  };
  const [newMission, setNewMission] = useState(emptyMission);

  const statuses = ["Draft", "Pending Checklist", "Pending Approval", "Approved", "Rejected", "Completed"];
  const filters = ["All", ...statuses];

  const statusColor = (s) =>
    s === "Completed" ? "text-accentTeal" :
    s === "Approved" ? "text-accentTeal" :
    s === "Rejected" ? "text-red-400" :
    s === "Pending Approval" ? "text-orange-400" :
    s === "Pending Checklist" ? "text-blue-400" :
    "text-gray-400";

  const isDeletable = (m) => m.status === "Draft";

  function mapFromDb(row) {
    const droneLabel = row.drones ? `${row.drone_id} (${row.drones.model})` : (row.drone_id || "");
    return {
      id: row.id,
      name: row.name,
      droneId: row.drone_id || "",
      drone: droneLabel,
      batteryId: row.battery_id || "",
      battery: row.battery_id || "",
      pilot: row.pilot || "",
      location: row.location || "",
      date: row.scheduled_date,
      duration: row.duration_minutes ?? "",
      payloadRequired: row.payload_required,
      status: row.status,
    };
  }

  async function fetchMissions() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("missions")
      .select("*, drones(model)")
      .order("created_at", { ascending: true });

    if (error) {
      setError("Could not load missions. " + error.message);
    } else {
      setMissions(data.map(mapFromDb));
    }
    setLoading(false);
  }

  // BR-002 / FR-012: disabled, Maintenance-status, or faulty drones must not
  // be assignable to a new mission.
  // BR-003 / FR-016: inspection-flagged or low-charge batteries must not be
  // assignable to a new mission.
  async function fetchOptions() {
    const [{ data: droneData }, { data: batteryData }] = await Promise.all([
      supabase.from("drones").select("drone_id, model, status, active"),
      supabase.from("batteries").select("battery_id, health_status, cycle_count, charge_percentage, active"),
    ]);

    if (droneData) {
      const assignable = droneData.filter((d) => d.active && d.status === "Available");
      setDrones(assignable);
    }

    if (batteryData) {
      const assignable = batteryData.filter((b) => {
        const flaggedForInspection =
          Number(b.cycle_count) > CYCLE_THRESHOLD ||
          b.health_status === "Weak" ||
          b.health_status === "Damaged";
        const lowCharge = Number(b.charge_percentage) < MIN_SAFE_CHARGE;
        return b.active && !flaggedForInspection && !lowCharge;
      });
      setBatteries(assignable);
    }
  }

  useEffect(() => {
    fetchMissions();
    fetchOptions();
  }, []);

  const filteredMissions = missions.filter((m) => {
    const matchesSearch =
      m.id.toLowerCase().includes(search.toLowerCase()) ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.pilot.toLowerCase().includes(search.toLowerCase()) ||
      m.location.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "All" || m.status === filter;
    return matchesSearch && matchesFilter;
  });

  async function handleSaveMission(e) {
    e.preventDefault();
    setFieldErrors({});

    if (!newMission.id || !newMission.name || !newMission.droneId || !newMission.batteryId || !newMission.pilot || !newMission.date) {
      setFieldErrors({ form: "Please fill in all required fields." });
      return;
    }

    if (!editingId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(newMission.date);
      if (selectedDate < today) {
        setFieldErrors({ date: "Mission date cannot be in the past." });
        return;
      }
    }

    setSaving(true);

    const payload = {
      name: newMission.name,
      location: newMission.location,
      scheduled_date: newMission.date,
      duration_minutes: newMission.duration === "" ? null : Number(newMission.duration),
      payload_required: newMission.payloadRequired,
      status: newMission.status,
      drone_id: newMission.droneId,
      battery_id: newMission.batteryId,
      pilot: newMission.pilot,
    };

    if (editingId) {
      const { error } = await supabase.from("missions").update(payload).eq("id", editingId);
      if (error) {
        setFieldErrors({ form: "Failed to save changes. " + error.message });
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("missions").insert({ id: newMission.id, ...payload });
      if (error) {
        setFieldErrors({ form: "Failed to add mission. " + error.message });
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setNewMission(emptyMission);
    setEditingId(null);
    setShowForm(false);
    fetchMissions();
  }

  function handleEdit(mission) {
    setNewMission(mission);
    setEditingId(mission.id);
    setFieldErrors({});
    setShowForm(true);
  }

  function toggleSelect(id) {
    const mission = missions.find((m) => m.id === id);
    if (!isDeletable(mission)) return;
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function confirmDeleteOne(id) { setConfirmDelete({ type: "single", id }); }
  function confirmDeleteSelected() { setConfirmDelete({ type: "bulk", id: null }); }

  async function executeDelete() {
    if (confirmDelete.type === "single") {
      const { error } = await supabase.from("missions").delete().eq("id", confirmDelete.id);
      if (error) {
        setError("Failed to delete mission. " + error.message);
      } else {
        setSelected(selected.filter((x) => x !== confirmDelete.id));
      }
    } else {
      const { error } = await supabase.from("missions").delete().in("id", selected);
      if (error) {
        setError("Failed to delete missions. " + error.message);
      } else {
        setSelected([]);
      }
    }
    setConfirmDelete(null);
    fetchMissions();
  }

  function enterSelectMode(id) {
    const mission = missions.find((m) => m.id === id);
    if (!isDeletable(mission)) return;
    setSelectMode(true);
    setSelected((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected([]);
  }

  function handleTouchStart(id) {
    longPressTimer.current = setTimeout(() => {
      enterSelectMode(id);
    }, 500);
  }
  function handleTouchEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleContextMenu(e, id) {
    e.preventDefault();
    enterSelectMode(id);
  }

  function handleRowClick(m) {
    if (selectMode) {
      toggleSelect(m.id);
    }
  }

  function toggleSelectAll() {
    const deletableIds = filteredMissions.filter(isDeletable).map((m) => m.id);
    if (selected.length === deletableIds.length) {
      setSelected([]);
    } else {
      setSelected(deletableIds);
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Mission Management</h1>
        <div className="flex gap-2 items-center">
          {selectMode ? (
            <>
              <span className="text-textBody text-sm">{selected.length} selected</span>
              {selected.length > 0 && (
                <button onClick={confirmDeleteSelected} className="px-4 py-2 rounded-full bg-red-500/20 text-red-400 text-sm font-semibold flex items-center gap-1">
                  <Trash2 size={16} /> Remove ({selected.length})
                </button>
              )}
              <button onClick={exitSelectMode} className="px-3 py-2 rounded-full border border-gray-600 text-textBody hover:border-accentTeal flex items-center gap-1 text-sm">
                <X size={16} /> Cancel
              </button>
            </>
          ) : (
            <button onClick={() => { setNewMission(emptyMission); setEditingId(null); setFieldErrors({}); setShowForm(true); }} className="btn-primary">
              + Add Mission
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <input
        type="text"
        placeholder="Search missions..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md mb-4 p-2 rounded bg-cardDark border border-gray-700 text-white outline-none focus:border-accentTeal"
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={filter === f
              ? "px-4 py-1 rounded-full bg-accentTeal text-bgDark text-sm font-semibold"
              : "px-4 py-1 rounded-full border border-gray-600 text-textBody text-sm hover:border-accentTeal"}>
            {f}
          </button>
        ))}
      </div>

      <div className="bg-cardDark p-4 rounded overflow-x-auto">
        {loading ? (
          <p className="text-textBody text-center py-8">Loading missions...</p>
        ) : filteredMissions.length === 0 ? (
          <p className="text-textBody text-center py-8">No {filter === "All" ? "" : filter} Missions{filter === "All" ? " Found" : ""}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-textBody text-left">
                {selectMode && (
                  <th className="pb-2 w-8">
                    <input
                      type="checkbox"
                      checked={
                        filteredMissions.filter(isDeletable).length > 0 &&
                        selected.length === filteredMissions.filter(isDeletable).length
                      }
                      onChange={toggleSelectAll}
                      className="accent-accentTeal"
                    />
                  </th>
                )}
                <th className="pb-2">ID</th>
                <th className="pb-2">Mission</th>
                <th className="pb-2">Drone</th>
                <th className="pb-2">Battery</th>
                <th className="pb-2">Pilot</th>
                <th className="pb-2">Location</th>
                <th className="pb-2">Date</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMissions.map((m) => (
                <tr
                  key={m.id}
                  className={`border-t border-gray-700 select-none ${selected.includes(m.id) ? "bg-accentTeal/10" : ""} ${selectMode && isDeletable(m) ? "cursor-pointer" : ""}`}
                  onClick={() => handleRowClick(m)}
                  onContextMenu={(e) => handleContextMenu(e, m.id)}
                  onTouchStart={() => handleTouchStart(m.id)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchEnd}
                >
                  {selectMode && (
                    <td className="py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.includes(m.id)}
                        disabled={!isDeletable(m)}
                        onChange={() => toggleSelect(m.id)}
                        className="accent-accentTeal disabled:opacity-30"
                      />
                    </td>
                  )}
                  <td className="py-3 font-semibold">{m.id}</td>
                  <td className="py-3 text-textBody">{m.name}</td>
                  <td className="py-3 text-textBody">{m.drone}</td>
                  <td className="py-3 text-textBody">{m.battery}</td>
                  <td className="py-3 text-textBody">{m.pilot}</td>
                  <td className="py-3 text-textBody">{m.location}</td>
                  <td className="py-3 text-textBody">{m.date}</td>
                  <td className={`py-3 font-semibold ${statusColor(m.status)}`}>{m.status}</td>
                  <td className="py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {!selectMode && (
                      <>
                        <button onClick={() => navigate(`/checklists/${m.id}`)} className="text-accentTeal mr-3"><ClipboardCheck size={16} /></button>
                        <button onClick={() => handleEdit(m)} className="text-accentTeal mr-3"><Pencil size={16} /></button>
                        {isDeletable(m) && (
                          <button onClick={() => confirmDeleteOne(m.id)} className="text-red-400"><Trash2 size={16} /></button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-textBody text-xs mt-3">
        Only Draft missions can be deleted. Once a mission enters the checklist/approval workflow, its history is preserved for audit purposes.
      </p>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form onSubmit={handleSaveMission} className="bg-cardDark p-6 rounded-xl w-full max-w-2xl flex flex-col gap-4 relative max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-textBody hover:text-white text-lg">✕</button>
            <h2 className="text-lg font-bold mb-2">{editingId ? "Edit Mission" : "Add New Mission"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-textBody text-sm">Mission ID</label>
                <input placeholder="e.g. MS-104" value={newMission.id} disabled={!!editingId}
                  onChange={(e) => setNewMission({ ...newMission, id: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal disabled:opacity-50" />
              </div>
              <div>
                <label className="text-textBody text-sm">Mission Objective / Name</label>
                <input placeholder="e.g. Site Survey" value={newMission.name}
                  onChange={(e) => setNewMission({ ...newMission, name: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal" />
              </div>
              <div>
                <label className="text-textBody text-sm">Assigned Drone</label>
                <select value={newMission.droneId}
                  onChange={(e) => setNewMission({ ...newMission, droneId: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal">
                  <option value="">Select drone</option>
                  {drones.map((d) => (
                    <option key={d.drone_id} value={d.drone_id}>{d.drone_id} ({d.model})</option>
                  ))}
                </select>
                {drones.length === 0 && (
                  <p className="text-textBody text-xs mt-1">No available drones to assign.</p>
                )}
              </div>
              <div>
                <label className="text-textBody text-sm">Assigned Battery</label>
                <select value={newMission.batteryId}
                  onChange={(e) => setNewMission({ ...newMission, batteryId: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal">
                  <option value="">Select battery</option>
                  {batteries.map((b) => (
                    <option key={b.battery_id} value={b.battery_id}>{b.battery_id}</option>
                  ))}
                </select>
                {batteries.length === 0 && (
                  <p className="text-textBody text-xs mt-1">No available batteries to assign.</p>
                )}
              </div>
              <div>
                <label className="text-textBody text-sm">Pilot / Operator</label>
                <input placeholder="e.g. Zain Ahmed" value={newMission.pilot}
                  onChange={(e) => setNewMission({ ...newMission, pilot: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal" />
              </div>
              <div>
                <label className="text-textBody text-sm">Location</label>
                <input placeholder="e.g. Lahore, PK" value={newMission.location}
                  onChange={(e) => setNewMission({ ...newMission, location: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal" />
              </div>
              <div>
                <label className="text-textBody text-sm">Date</label>
                <input type="date" value={newMission.date}
                  onChange={(e) => setNewMission({ ...newMission, date: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal" />
                {fieldErrors.date && <p className="text-red-400 text-xs mt-1">{fieldErrors.date}</p>}
              </div>
              <div>
                <label className="text-textBody text-sm">Expected Duration (minutes)</label>
                <input type="number" placeholder="e.g. 45" value={newMission.duration}
                  onChange={(e) => setNewMission({ ...newMission, duration: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal" />
              </div>
              <div>
                <label className="text-textBody text-sm">Status</label>
                <select value={newMission.status}
                  onChange={(e) => setNewMission({ ...newMission, status: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal">
                  {statuses.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  id="payloadRequired"
                  checked={newMission.payloadRequired}
                  onChange={(e) => setNewMission({ ...newMission, payloadRequired: e.target.checked })}
                  className="accent-accentTeal w-4 h-4"
                />
                <label htmlFor="payloadRequired" className="text-textBody text-sm">Payload / camera required</label>
              </div>
            </div>

            {fieldErrors.form && <p className="text-red-400 text-sm">{fieldErrors.form}</p>}

            <div className="flex justify-end gap-2 mt-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 rounded border border-gray-600 text-textBody hover:border-accentTeal">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? "Saving..." : editingId ? "Save Changes" : "Add Mission"}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-cardDark p-6 rounded-xl w-full max-w-sm text-center">
            <h2 className="text-lg font-bold mb-2">{confirmDelete.type === "single" ? "Delete this item?" : `Delete ${selected.length} items?`}</h2>
            <p className="text-textBody text-sm mb-6">Are you sure you want to delete {confirmDelete.type === "single" ? "this item" : "these items"}? This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 rounded border border-gray-600 text-textBody hover:border-accentTeal">Cancel</button>
              <button onClick={executeDelete} className="flex-1 py-2 rounded bg-red-500 text-white font-semibold hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Missions;