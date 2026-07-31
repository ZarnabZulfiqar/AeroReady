import { useState, useEffect, useRef } from "react";
import { Pencil, Ban, RotateCcw, X, AlertTriangle } from "lucide-react";
import { supabase } from "../supabaseClient";

// FR-014 / BR-012: configured threshold — currently a constant, move to
// Settings/config table once needed so Administrator can adjust it.
const CYCLE_THRESHOLD = 150;

function Batteries() {
  const [batteries, setBatteries] = useState([]);
  const [drones, setDrones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState([]);
  const [confirmDisable, setConfirmDisable] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const longPressTimer = useRef(null);

  const emptyBattery = { id: "", capacity: "", voltage: "", charge: "", cycles: "", health: "Good", droneId: "", active: true };
  const [newBattery, setNewBattery] = useState(emptyBattery);

  const filters = ["All", "Good", "Weak", "Damaged", "Flagged for Inspection"];

  const healthColor = (h) =>
    h === "Good" ? "text-accentTeal" : h === "Weak" ? "text-orange-400" : "text-red-400";

  // FR-014 / BR-012: automatic flag, not manually set
  const needsInspection = (b) =>
    Number(b.cycles) > CYCLE_THRESHOLD || b.health === "Weak" || b.health === "Damaged";

  function mapFromDb(row) {
    const droneLabel = row.drones ? `${row.assigned_drone_id} (${row.drones.model})` : "Unassigned";
    return {
      id: row.battery_id,
      capacity: row.capacity || "",
      voltage: row.voltage || "",
      charge: row.charge_percentage ?? "",
      cycles: row.cycle_count ?? "",
      health: row.health_status || "Good",
      droneId: row.assigned_drone_id || "",
      drone: droneLabel,
      active: row.active,
    };
  }

  async function fetchBatteries() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("batteries")
      .select("*, drones(model)")
      .order("created_at", { ascending: true });

    if (error) {
      setError("Could not load batteries. " + error.message);
    } else {
      setBatteries(data.map(mapFromDb));
    }
    setLoading(false);
  }

  async function fetchDrones() {
    const { data } = await supabase.from("drones").select("drone_id, model");
    if (data) setDrones(data);
  }

  useEffect(() => {
    fetchBatteries();
    fetchDrones();
  }, []);

  const filteredBatteries = batteries.filter((b) => {
    const matchesSearch =
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      b.drone.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "All"
        ? true
        : filter === "Flagged for Inspection"
        ? needsInspection(b)
        : b.health === filter;
    return matchesSearch && matchesFilter;
  });

  // Section 8.4: required fields + charge_percentage range 0–100
  function validateBattery() {
    const errs = {};
    if (!newBattery.id) errs.id = "Battery ID is required.";
    if (!newBattery.capacity) errs.capacity = "Capacity is required.";
    if (newBattery.charge !== "") {
      const c = Number(newBattery.charge);
      if (c < 0 || c > 100) errs.charge = "Charge % must be between 0 and 100.";
    }
    return errs;
  }

  async function handleSaveBattery(e) {
    e.preventDefault();
    setFieldErrors({});

    const errs = validateBattery();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);

    const payload = {
      capacity: newBattery.capacity,
      voltage: newBattery.voltage,
      charge_percentage: newBattery.charge === "" ? null : Number(newBattery.charge),
      cycle_count: newBattery.cycles === "" ? null : Number(newBattery.cycles),
      health_status: newBattery.health,
      assigned_drone_id: newBattery.droneId || null,
      active: newBattery.active,
    };

    if (editingId) {
      const { error } = await supabase.from("batteries").update(payload).eq("battery_id", editingId);
      if (error) {
        setFieldErrors({ form: "Failed to save changes. " + error.message });
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("batteries").insert({ battery_id: newBattery.id, ...payload });
      if (error) {
        setFieldErrors({ form: "Failed to add battery. " + error.message });
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setNewBattery(emptyBattery);
    setEditingId(null);
    setShowForm(false);
    fetchBatteries();
  }

  function handleEdit(battery) {
    setNewBattery(battery);
    setEditingId(battery.id);
    setFieldErrors({});
    setShowForm(true);
  }

  function toggleSelect(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Section 5.6: deactivating a battery must not delete its historical records
  function confirmDisableOne(id) {
    setConfirmDisable({ type: "single", id });
  }

  function confirmDisableSelected() {
    setConfirmDisable({ type: "bulk", id: null });
  }

  async function executeDisable() {
    if (confirmDisable.type === "single") {
      const current = batteries.find((b) => b.id === confirmDisable.id);
      const { error } = await supabase
        .from("batteries")
        .update({ active: !current.active })
        .eq("battery_id", confirmDisable.id);
      if (error) {
        setError("Failed to update battery. " + error.message);
      } else {
        setSelected(selected.filter((x) => x !== confirmDisable.id));
      }
    } else {
      const { error } = await supabase
        .from("batteries")
        .update({ active: false })
        .in("battery_id", selected);
      if (error) {
        setError("Failed to disable batteries. " + error.message);
      } else {
        setSelected([]);
      }
    }
    setConfirmDisable(null);
    fetchBatteries();
  }

  function enterSelectMode(id) {
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

  function handleRowClick(b) {
    if (selectMode) {
      toggleSelect(b.id);
    }
  }

  function toggleSelectAll() {
    if (selected.length === filteredBatteries.length) {
      setSelected([]);
    } else {
      setSelected(filteredBatteries.map((b) => b.id));
    }
  }

  return (
    <div className="w-full">
      {/* Header row: stacks on mobile, side-by-side on larger screens */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Battery Management</h1>
        <div className="flex flex-wrap gap-2 items-center">
          {selectMode ? (
            <>
              <span className="text-textBody text-sm">{selected.length} selected</span>
              {selected.length > 0 && (
                <button
                  onClick={confirmDisableSelected}
                  className="px-4 py-2 rounded-full bg-orange-500/20 text-orange-400 text-sm font-semibold flex items-center gap-1"
                >
                  <Ban size={16} /> Disable ({selected.length})
                </button>
              )}
              <button
                onClick={exitSelectMode}
                className="px-3 py-2 rounded-full border border-gray-600 text-textBody hover:border-accentTeal flex items-center gap-1 text-sm"
              >
                <X size={16} /> Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setNewBattery(emptyBattery);
                setEditingId(null);
                setFieldErrors({});
                setShowForm(true);
              }}
              className="btn-primary"
            >
              + Add Battery
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <input
        type="text"
        placeholder="Search batteries..."
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

      {/* No forced min-width on the table, so a scrollbar only shows up
          if the content genuinely doesn't fit — stays invisible on
          desktop when everything fits normally. */}
      <div className="bg-cardDark p-4 rounded overflow-x-auto">
        {loading ? (
          <p className="text-textBody text-center py-8">Loading batteries...</p>
        ) : filteredBatteries.length === 0 ? (
          <p className="text-textBody text-center py-8">
            No {filter === "All" ? "" : filter} Batteries{filter === "All" ? " Found" : ""}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-textBody text-left">
                {selectMode && (
                  <th className="pb-2 pr-4 w-8">
                    <input
                      type="checkbox"
                      checked={selected.length === filteredBatteries.length && filteredBatteries.length > 0}
                      onChange={toggleSelectAll}
                      className="accent-accentTeal"
                    />
                  </th>
                )}
                <th className="pb-2 pr-4">ID</th>
                <th className="pb-2 pr-4">Capacity</th>
                <th className="pb-2 pr-4">Voltage</th>
                <th className="pb-2 pr-4">Charge %</th>
                <th className="pb-2 pr-4">Cycle Count</th>
                <th className="pb-2 pr-4">Health</th>
                <th className="pb-2 pr-4">Assigned Drone</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatteries.map((b) => (
                <tr
                  key={b.id}
                  className={`border-t border-gray-700 select-none ${selected.includes(b.id) ? "bg-accentTeal/10" : ""} ${!b.active ? "opacity-50" : ""} ${selectMode ? "cursor-pointer" : ""}`}
                  onClick={() => handleRowClick(b)}
                  onContextMenu={(e) => handleContextMenu(e, b.id)}
                  onTouchStart={() => handleTouchStart(b.id)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchEnd}
                >
                  {selectMode && (
                    <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.includes(b.id)}
                        onChange={() => toggleSelect(b.id)}
                        className="accent-accentTeal"
                      />
                    </td>
                  )}
                  <td className="py-3 pr-4 font-semibold">{b.id}</td>
                  <td className="py-3 pr-4 text-textBody">{b.capacity}</td>
                  <td className="py-3 pr-4 text-textBody">{b.voltage}</td>
                  <td className="py-3 pr-4 text-textBody">{b.charge}%</td>
                  <td className="py-3 pr-4 text-textBody">{b.cycles}</td>
                  <td className="py-3 pr-4">
                    <span className={`font-semibold ${healthColor(b.health)}`}>{b.health}</span>
                    {needsInspection(b) && (
                      <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-400/20 text-red-400">
                        <AlertTriangle size={12} /> Inspection Required
                      </span>
                    )}
                    {!b.active && (
                      <span className="ml-2 px-2 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-textBody">{b.drone}</td>
                  <td className="py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {!selectMode && (
                      <>
                        <button onClick={() => handleEdit(b)} className="text-accentTeal mr-3">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => confirmDisableOne(b.id)} className="text-orange-400">
                          {b.active ? <Ban size={16} /> : <RotateCcw size={16} />}
                        </button>
                      </>
                    )}
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
            onSubmit={handleSaveBattery}
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
              {editingId ? "Edit Battery" : "Add New Battery"}
            </h2>

            {/* Form fields: 1 column on mobile, 2 columns from small screens up */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-textBody text-sm">Battery ID</label>
                <input
                  placeholder="e.g. BT-020"
                  value={newBattery.id}
                  disabled={!!editingId}
                  onChange={(e) => setNewBattery({ ...newBattery, id: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal disabled:opacity-50"
                />
                {fieldErrors.id && <p className="text-red-400 text-xs mt-1">{fieldErrors.id}</p>}
              </div>

              <div>
                <label className="text-textBody text-sm">Capacity</label>
                <input
                  placeholder="e.g. 5200 mAh"
                  value={newBattery.capacity}
                  onChange={(e) => setNewBattery({ ...newBattery, capacity: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                />
                {fieldErrors.capacity && <p className="text-red-400 text-xs mt-1">{fieldErrors.capacity}</p>}
              </div>

              <div>
                <label className="text-textBody text-sm">Voltage</label>
                <input
                  placeholder="e.g. 22.2V"
                  value={newBattery.voltage}
                  onChange={(e) => setNewBattery({ ...newBattery, voltage: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                />
              </div>

              <div>
                <label className="text-textBody text-sm">Charge %</label>
                <input
                  type="number"
                  placeholder="e.g. 85"
                  value={newBattery.charge}
                  onChange={(e) => setNewBattery({ ...newBattery, charge: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                />
                {fieldErrors.charge && <p className="text-red-400 text-xs mt-1">{fieldErrors.charge}</p>}
              </div>

              <div>
                <label className="text-textBody text-sm">Cycle Count</label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={newBattery.cycles}
                  onChange={(e) => setNewBattery({ ...newBattery, cycles: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                />
              </div>

              <div>
                <label className="text-textBody text-sm">Health</label>
                <select
                  value={newBattery.health}
                  onChange={(e) => setNewBattery({ ...newBattery, health: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                >
                  <option>Good</option>
                  <option>Weak</option>
                  <option>Damaged</option>
                </select>
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="text-textBody text-sm">Assigned Drone</label>
                <select
                  value={newBattery.droneId}
                  onChange={(e) => setNewBattery({ ...newBattery, droneId: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                >
                  <option value="">Unassigned</option>
                  {drones.map((d) => (
                    <option key={d.drone_id} value={d.drone_id}>{d.drone_id} ({d.model})</option>
                  ))}
                </select>
              </div>
            </div>

            {fieldErrors.form && <p className="text-red-400 text-sm">{fieldErrors.form}</p>}

            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded border border-gray-600 text-textBody hover:border-accentTeal"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? "Saving..." : editingId ? "Save Changes" : "Add Battery"}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDisable && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-cardDark p-6 rounded-xl w-full max-w-sm text-center">
            <h2 className="text-lg font-bold mb-2">
              {confirmDisable.type === "single"
                ? "Toggle status of this battery?"
                : `Disable ${selected.length} batteries?`}
            </h2>
            <p className="text-textBody text-sm mb-6">
              Disabling keeps the battery's inspection and assignment history
              intact, but stops it from being assigned to new missions.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setConfirmDisable(null)}
                className="flex-1 py-2 rounded border border-gray-600 text-textBody hover:border-accentTeal"
              >
                Cancel
              </button>
              <button
                onClick={executeDisable}
                className="flex-1 py-2 rounded bg-orange-500 text-white font-semibold hover:bg-orange-600"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Batteries;