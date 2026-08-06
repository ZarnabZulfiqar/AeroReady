import { useState, useEffect, useRef } from "react";
import { Pencil, RotateCcw, X } from "lucide-react";
import { supabase } from "../supabaseClient";
import { SkeletonTable } from "../components/Skeleton";

function ChecklistTemplates() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState([]);
  const [confirmRetire, setConfirmRetire] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const longPressTimer = useRef(null);

  const emptyItem = { id: "", item: "", category: "Mission Readiness", criticality: "Critical", condition: "", evidence: "Yes", status: "Active" };
  const [newItem, setNewItem] = useState(emptyItem);

  const categories = [
    "Mission Readiness",
    "UAV Airworthiness",
    "Battery Readiness",
    "Communication & Control",
    "Payload / Camera",
    "Post-Flight",
    "Software Release",
  ];

  const filters = ["All", "Critical", "Conditional", "Non-critical"];

  const criticalityColor = (c) =>
    c === "Critical" ? "bg-red-400/20 text-red-400" :
    c === "Conditional" ? "bg-orange-400/20 text-orange-400" :
    "bg-gray-500/20 text-gray-300";

  const statusColor = (s) =>
    s === "Active" ? "bg-accentTeal/20 text-accentTeal" : "bg-gray-500/20 text-gray-400";

  function mapFromDb(row) {
    return {
      id: row.item_id,
      item: row.template_name,
      category: row.category,
      criticality: row.criticality,
      condition: row.condition_rule || "",
      evidence: row.evidence_required ? "Yes" : "No",
      status: row.retired_flag ? "Retired" : "Active",
    };
  }

  async function fetchItems() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("checklist_templates")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      setError("Could not load checklist items. " + error.message);
    } else {
      setItems(data.map(mapFromDb));
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchItems();
  }, []);

  const filteredItems = items.filter((i) => {
    const matchesSearch =
      i.item.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "All" || i.criticality === filter;
    return matchesSearch && matchesFilter;
  });

  // Section 8.4: required fields, per-field messages
  function validateItem() {
    const errs = {};
    if (!newItem.id) errs.id = "Item ID is required.";
    if (!newItem.item) errs.item = "Item description is required.";
    if (newItem.criticality === "Conditional" && !newItem.condition) {
      errs.condition = "Condition is required for a conditional item.";
    }
    return errs;
  }

  async function handleSaveItem(e) {
    e.preventDefault();
    setFieldErrors({});

    const errs = validateItem();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);

    const payload = {
      template_name: newItem.item,
      category: newItem.category,
      criticality: newItem.criticality,
      condition_rule: newItem.criticality === "Conditional" ? newItem.condition : null,
      evidence_required: newItem.evidence === "Yes",
      retired_flag: newItem.status === "Retired",
    };

    if (editingId) {
      const { error } = await supabase.from("checklist_templates").update(payload).eq("item_id", editingId);
      if (error) {
        setFieldErrors({ form: "Failed to save changes. " + error.message });
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("checklist_templates").insert({ item_id: newItem.id, ...payload });
      if (error) {
        setFieldErrors({ form: "Failed to add item. " + error.message });
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setNewItem(emptyItem);
    setEditingId(null);
    setShowForm(false);
    fetchItems();
  }

  function handleEdit(item) {
    setNewItem(item);
    setEditingId(item.id);
    setFieldErrors({});
    setShowForm(true);
  }

  function toggleSelect(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function confirmRetireOne(id) {
    setConfirmRetire({ type: "single", id });
  }

  function confirmRetireSelected() {
    setConfirmRetire({ type: "bulk", id: null });
  }

  async function executeRetire() {
    if (confirmRetire.type === "single") {
      const current = items.find((i) => i.id === confirmRetire.id);
      const { error } = await supabase
        .from("checklist_templates")
        .update({ retired_flag: current.status === "Active" })
        .eq("item_id", confirmRetire.id);
      if (error) {
        setError("Failed to update item. " + error.message);
      } else {
        setSelected(selected.filter((x) => x !== confirmRetire.id));
      }
    } else {
      const { error } = await supabase
        .from("checklist_templates")
        .update({ retired_flag: true })
        .in("item_id", selected);
      if (error) {
        setError("Failed to retire items. " + error.message);
      } else {
        setSelected([]);
      }
    }
    setConfirmRetire(null);
    fetchItems();
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

  function handleRowClick(i) {
    if (selectMode) {
      toggleSelect(i.id);
    }
  }

  function toggleSelectAll() {
    if (selected.length === filteredItems.length) {
      setSelected([]);
    } else {
      setSelected(filteredItems.map((i) => i.id));
    }
  }

  return (
    <div className="w-full">
      {/* Header row: stacks on mobile, side-by-side on larger screens */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Checklist Templates</h1>
        <div className="flex flex-wrap gap-2 items-center">
          {selectMode ? (
            <>
              <span className="text-textBody text-sm">{selected.length} selected</span>
              {selected.length > 0 && (
                <button
                  onClick={confirmRetireSelected}
                  className="px-4 py-2 rounded-full bg-orange-500/20 text-orange-400 text-sm font-semibold flex items-center gap-1"
                >
                  <RotateCcw size={16} /> Retire ({selected.length})
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
                setNewItem(emptyItem);
                setEditingId(null);
                setFieldErrors({});
                setShowForm(true);
              }}
              className="btn-primary"
            >
              + Add Item
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <input
        type="text"
        placeholder="Search template items..."
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

      <div className="bg-cardDark p-4 rounded overflow-x-auto">
    {loading ? (
  <SkeletonTable rows={6} columns={7} />
) : filteredItems.length === 0 ? (
          <p className="text-textBody text-center py-8">
            No {filter === "All" ? "" : filter} Items{filter === "All" ? " Found" : ""}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-textBody text-left">
                {selectMode && (
                  <th className="pb-2 w-8">
                    <input
                      type="checkbox"
                      checked={selected.length === filteredItems.length && filteredItems.length > 0}
                      onChange={toggleSelectAll}
                      className="accent-accentTeal"
                    />
                  </th>
                )}
                <th className="pb-2">Item</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">Criticality</th>
                <th className="pb-2">Condition</th>
                <th className="pb-2">Evidence Required</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((i) => (
                <tr
                  key={i.id}
                  className={`border-t border-gray-700 select-none ${selected.includes(i.id) ? "bg-accentTeal/10" : ""} ${selectMode ? "cursor-pointer" : ""}`}
                  onClick={() => handleRowClick(i)}
                  onContextMenu={(e) => handleContextMenu(e, i.id)}
                  onTouchStart={() => handleTouchStart(i.id)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchEnd}
                >
                  {selectMode && (
                    <td className="py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.includes(i.id)}
                        onChange={() => toggleSelect(i.id)}
                        className="accent-accentTeal"
                      />
                    </td>
                  )}
                  <td className="py-3 font-semibold">{i.item}</td>
                  <td className="py-3 text-textBody">{i.category}</td>
                  <td className="py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${criticalityColor(i.criticality)}`}>
                      {i.criticality}
                    </span>
                  </td>
                  <td className="py-3 text-textBody text-xs max-w-[160px]">
                    {i.criticality === "Conditional" ? (i.condition || "—") : "—"}
                  </td>
                  <td className="py-3 text-textBody">{i.evidence}</td>
                  <td className="py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(i.status)}`}>
                      {i.status}
                    </span>
                  </td>
                  <td className="py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {!selectMode && (
                      <>
                        <button onClick={() => handleEdit(i)} className="text-accentTeal mr-3">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => confirmRetireOne(i.id)} className="text-orange-400">
                          <RotateCcw size={16} />
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
            onSubmit={handleSaveItem}
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
              {editingId ? "Edit Checklist Item" : "Add New Checklist Item"}
            </h2>

            {/* Form fields: 1 column on mobile, 2 columns from small screens up */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-textBody text-sm">Item ID</label>
                <input
                  placeholder="e.g. CI-005"
                  value={newItem.id}
                  disabled={!!editingId}
                  onChange={(e) => setNewItem({ ...newItem, id: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal disabled:opacity-50"
                />
                {fieldErrors.id && <p className="text-red-400 text-xs mt-1">{fieldErrors.id}</p>}
              </div>

              <div>
                <label className="text-textBody text-sm">Item Description</label>
                <input
                  placeholder="e.g. Propellers free of cracks"
                  value={newItem.item}
                  onChange={(e) => setNewItem({ ...newItem, item: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                />
                {fieldErrors.item && <p className="text-red-400 text-xs mt-1">{fieldErrors.item}</p>}
              </div>

              <div>
                <label className="text-textBody text-sm">Category</label>
                <select
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-textBody text-sm">Criticality</label>
                <select
                  value={newItem.criticality}
                  onChange={(e) => setNewItem({ ...newItem, criticality: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                >
                  <option>Critical</option>
                  <option>Conditional</option>
                  <option>Non-critical</option>
                </select>
              </div>

              {newItem.criticality === "Conditional" && (
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-textBody text-sm">Condition (applies when...)</label>
                  <input
                    placeholder="e.g. Applies when payload/camera is assigned"
                    value={newItem.condition}
                    onChange={(e) => setNewItem({ ...newItem, condition: e.target.value })}
                    className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                  />
                  {fieldErrors.condition && <p className="text-red-400 text-xs mt-1">{fieldErrors.condition}</p>}
                </div>
              )}

              <div>
                <label className="text-textBody text-sm">Evidence Required</label>
                <select
                  value={newItem.evidence}
                  onChange={(e) => setNewItem({ ...newItem, evidence: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                >
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>

              <div>
                <label className="text-textBody text-sm">Status</label>
                <select
                  value={newItem.status}
                  onChange={(e) => setNewItem({ ...newItem, status: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                >
                  <option>Active</option>
                  <option>Retired</option>
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
                {saving ? "Saving..." : editingId ? "Save Changes" : "Add Item"}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmRetire && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-cardDark p-6 rounded-xl w-full max-w-sm text-center">
            <h2 className="text-lg font-bold mb-2">
              {confirmRetire.type === "single"
                ? "Toggle status of this item?"
                : `Retire ${selected.length} items?`}
            </h2>
            <p className="text-textBody text-sm mb-6">
              Retiring keeps the item's history intact for any checklist that already
              referenced it, but stops it from being used in new checklists.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setConfirmRetire(null)}
                className="flex-1 py-2 rounded border border-gray-600 text-textBody hover:border-accentTeal"
              >
                Cancel
              </button>
              <button
                onClick={executeRetire}
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

export default ChecklistTemplates;