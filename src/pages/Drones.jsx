import { useState, useEffect, useRef } from "react";
import { Pencil, Ban, RotateCcw, X } from "lucide-react";
import { supabase } from "../supabaseClient";
import { SkeletonTable } from "../components/Skeleton";

function Drones() {
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

  const emptyDrone = { id: "", model: "", type: "Quadcopter", payload: "", status: "Available", active: true };
  const [newDrone, setNewDrone] = useState(emptyDrone);

  const filters = ["All", "Available", "In Mission", "Maintenance", "Damaged"];

  const statusColor = (s) =>
    s === "Available"
      ? "bg-accentTeal/20 text-accentTeal"
      : s === "Damaged"
      ? "bg-red-400/20 text-red-400"
      : s === "In Mission"
      ? "bg-blue-400/20 text-blue-400"
      : "bg-orange-400/20 text-orange-400";

  function mapFromDb(row) {
    return {
      id: row.drone_id,
      model: row.model,
      type: row.type || "",
      payload: row.payload_camera || "",
      status: row.status,
      active: row.active,
    };
  }

  async function fetchDrones() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("drones")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      setError("Could not load drones. " + error.message);
    } else {
      setDrones(data.map(mapFromDb));
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchDrones();
  }, []);

  const filteredDrones = drones.filter((d) => {
    const matchesSearch =
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.model.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "All" || d.status === filter;
    return matchesSearch && matchesFilter;
  });

  // Section 8.4: required fields, per-field messages
  function validateDrone() {
    const errs = {};
    if (!newDrone.id) errs.id = "Drone ID is required.";
    if (!newDrone.model) errs.model = "Model is required.";
    return errs;
  }

  async function handleSaveDrone(e) {
    e.preventDefault();
    setFieldErrors({});

    const errs = validateDrone();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);

    const payload = {
      model: newDrone.model,
      type: newDrone.type,
      payload_camera: newDrone.payload,
      status: newDrone.status,
      active: newDrone.active,
    };

    if (editingId) {
      const { error } = await supabase.from("drones").update(payload).eq("drone_id", editingId);
      if (error) {
        setFieldErrors({ form: "Failed to save changes. " + error.message });
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("drones").insert({ drone_id: newDrone.id, ...payload });
      if (error) {
        setFieldErrors({ form: "Failed to add drone. " + error.message });
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setNewDrone(emptyDrone);
    setEditingId(null);
    setShowForm(false);
    fetchDrones();
  }

  function handleEdit(drone) {
    setNewDrone(drone);
    setEditingId(drone.id);
    setFieldErrors({});
    setShowForm(true);
  }

  function toggleSelect(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function confirmDisableOne(id) {
    setConfirmDisable({ type: "single", id });
  }

  function confirmDisableSelected() {
    setConfirmDisable({ type: "bulk", id: null });
  }

  async function executeDisable() {
    if (confirmDisable.type === "single") {
      const current = drones.find((d) => d.id === confirmDisable.id);
      const { error } = await supabase
        .from("drones")
        .update({ active: !current.active })
        .eq("drone_id", confirmDisable.id);
      if (error) {
        setError("Failed to update drone. " + error.message);
      } else {
        setSelected(selected.filter((x) => x !== confirmDisable.id));
      }
    } else {
      const { error } = await supabase
        .from("drones")
        .update({ active: false })
        .in("drone_id", selected);
      if (error) {
        setError("Failed to disable drones. " + error.message);
      } else {
        setSelected([]);
      }
    }
    setConfirmDisable(null);
    fetchDrones();
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

  function handleRowClick(d) {
    if (selectMode) {
      toggleSelect(d.id);
    }
  }

  function toggleSelectAll() {
    if (selected.length === filteredDrones.length) {
      setSelected([]);
    } else {
      setSelected(filteredDrones.map((d) => d.id));
    }
  }

  return (
    <div className="w-full">
      {/* Header row: stacks on mobile, side-by-side on larger screens */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Drone Inventory</h1>
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
                setNewDrone(emptyDrone);
                setEditingId(null);
                setFieldErrors({});
                setShowForm(true);
              }}
              className="btn-primary"
            >
              + Add Drone
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <input
        type="text"
        placeholder="Search drones..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md mb-4 p-2 rounded bg-cardDark border border-gray-700 text-white outline-none focus:border-accentTeal"
      />

      {/* Filter pills: allowed to wrap on small screens instead of overflowing */}
      <div className="flex flex-wrap gap-2 mb-4">
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

      <div className="bg-cardDark p-4 rounded">
     {loading ? (
  <SkeletonTable rows={6} columns={6} />
) : filteredDrones.length === 0 ? (
          <p className="text-textBody text-center py-8">
            No {filter === "All" ? "" : filter} Drones{filter === "All" ? " Found" : ""}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-textBody text-left">
                  {selectMode && (
                    <th className="pb-2 w-8">
                      <input
                        type="checkbox"
                        checked={selected.length === filteredDrones.length && filteredDrones.length > 0}
                        onChange={toggleSelectAll}
                        className="accent-accentTeal"
                      />
                    </th>
                  )}
                  <th className="pb-2">ID</th>
                  <th className="pb-2">Model</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Payload</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrones.map((d) => (
                  <tr
                    key={d.id}
                    className={`border-t border-gray-700 select-none ${selected.includes(d.id) ? "bg-accentTeal/10" : ""} ${!d.active ? "opacity-50" : ""} ${selectMode ? "cursor-pointer" : ""}`}
                    onClick={() => handleRowClick(d)}
                    onContextMenu={(e) => handleContextMenu(e, d.id)}
                    onTouchStart={() => handleTouchStart(d.id)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchEnd}
                  >
                    {selectMode && (
                      <td className="py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.includes(d.id)}
                          onChange={() => toggleSelect(d.id)}
                          className="accent-accentTeal"
                        />
                      </td>
                    )}
                    <td className="py-3 font-semibold">{d.id}</td>
                    <td className="py-3 text-textBody">{d.model}</td>
                    <td className="py-3 text-textBody">{d.type}</td>
                    <td className="py-3 text-textBody">{d.payload}</td>
                    <td className="py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(d.status)}`}>
                        {d.status}
                      </span>
                      {!d.active && (
                        <span className="ml-2 px-2 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400">
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {!selectMode && (
                        <>
                          <button onClick={() => handleEdit(d)} className="text-accentTeal mr-3">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => confirmDisableOne(d.id)} className="text-orange-400">
                            {d.active ? <Ban size={16} /> : <RotateCcw size={16} />}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSaveDrone}
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
              {editingId ? "Edit Drone" : "Add New Drone"}
            </h2>

            {/* Form fields: 1 column on mobile, 2 columns from small screens up */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-textBody text-sm">Drone ID</label>
                <input
                  placeholder="e.g. DR-020"
                  value={newDrone.id}
                  disabled={!!editingId}
                  onChange={(e) => setNewDrone({ ...newDrone, id: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal disabled:opacity-50"
                />
                {fieldErrors.id && <p className="text-red-400 text-xs mt-1">{fieldErrors.id}</p>}
              </div>

              <div>
                <label className="text-textBody text-sm">Model</label>
                <input
                  placeholder="e.g. Aeris X4"
                  value={newDrone.model}
                  onChange={(e) => setNewDrone({ ...newDrone, model: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                />
                {fieldErrors.model && <p className="text-red-400 text-xs mt-1">{fieldErrors.model}</p>}
              </div>

              <div>
                <label className="text-textBody text-sm">Payload</label>
                <input
                  placeholder="e.g. RGB Camera"
                  value={newDrone.payload}
                  onChange={(e) => setNewDrone({ ...newDrone, payload: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                />
              </div>

              <div>
                <label className="text-textBody text-sm">Type</label>
                <select
                  value={newDrone.type}
                  onChange={(e) => setNewDrone({ ...newDrone, type: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                >
                  <option>Quadcopter</option>
                  <option>Fixed-Wing VTOL</option>
                  <option>Micro Quad</option>
                </select>
              </div>

              <div>
                <label className="text-textBody text-sm">Status</label>
                <select
                  value={newDrone.status}
                  onChange={(e) => setNewDrone({ ...newDrone, status: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                >
                  <option>Available</option>
                  <option>Maintenance</option>
                  <option>Damaged</option>
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
                {saving ? "Saving..." : editingId ? "Save Changes" : "Add Drone"}
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
                ? "Toggle status of this drone?"
                : `Disable ${selected.length} drones?`}
            </h2>
            <p className="text-textBody text-sm mb-6">
              Disabling keeps the drone's fault and maintenance history intact,
              but prevents it from being assigned to new missions.
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

export default Drones;