import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { supabase } from "../supabaseClient";

function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("All"); // "All" | "Active" | "Deactivated"
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const emptyUser = { name: "", email: "", phone: "", password: "", role: "Operator", status: "Active" };
  const [newUser, setNewUser] = useState(emptyUser);

  function mapFromDb(row) {
    return {
      id: row.id,
      name: row.full_name,
      email: row.email,
      phone: row.phone || "",
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
      deactivationRequested: row.deactivation_requested || false,
    };
  }

  async function fetchUsers() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      setError("Could not load users. " + error.message);
    } else {
      setUsers(data.map(mapFromDb));
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const statusColor = (s) =>
    s === "Active" ? "bg-accentTeal/20 text-accentTeal" : "bg-gray-500/20 text-gray-300";

  const activeCount = users.filter((u) => u.status === "Active").length;
  const deactivatedCount = users.filter((u) => u.status === "Deactivated").length;

  const filteredUsers = users
    .filter((u) => (filter === "All" ? true : u.status === filter))
    .filter(
      (u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

  // Section 8.4: email format + uniqueness check before create
  function validateUser() {
    const errs = {};
    if (!newUser.name) errs.name = "Name is required.";
    if (!newUser.email) {
      errs.email = "Email is required.";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newUser.email)) {
        errs.email = "Enter a valid email address.";
      } else if (!editingId && users.some((u) => u.email.toLowerCase() === newUser.email.toLowerCase())) {
        errs.email = "A user with this email already exists.";
      }
    }
    if (!newUser.phone) {
      errs.phone = "Phone number is required.";
    } else {
      const phoneRegex = /^[0-9+\-\s()]{7,20}$/;
      if (!phoneRegex.test(newUser.phone)) {
        errs.phone = "Enter a valid phone number.";
      }
    }
    if (!editingId) {
      if (!newUser.password) {
        errs.password = "Password is required.";
      } else if (newUser.password.length < 6) {
        errs.password = "Password must be at least 6 characters.";
      }
    }
    return errs;
  }

  async function handleSaveUser(e) {
    e.preventDefault();
    setFieldErrors({});

    const errs = validateUser();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: newUser.name,
          phone: newUser.phone,
          role: newUser.role,
          status: newUser.status,
        })
        .eq("id", editingId);

      if (error) {
        setFieldErrors({ form: "Failed to save changes. " + error.message });
        setSaving(false);
        return;
      }
    } else {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.name,
          phone: newUser.phone,
          role: newUser.role,
        },
        headers: {
          Authorization: `Bearer ${sessionData?.session?.access_token || ""}`,
        },
      });

      if (error || data?.error) {
        setFieldErrors({ form: "Failed to create user. " + (data?.error || error.message) });
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setNewUser(emptyUser);
    setEditingId(null);
    setShowForm(false);
    fetchUsers();
  }

  function handleEdit(user) {
    setNewUser({ ...user, password: "" });
    setEditingId(user.id);
    setFieldErrors({});
    setShowForm(true);
  }

  async function handleApproveDeactivation(user) {
    if (!window.confirm(`Deactivate ${user.name}'s account?`)) return;

    const { error } = await supabase
      .from("profiles")
      .update({ status: "Deactivated", deactivation_requested: false })
      .eq("id", user.id);

    if (error) {
      setError("Failed to deactivate user. " + error.message);
    } else {
      fetchUsers();
    }
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold mb-4">Users & Roles</h1>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {[
          { key: "All", label: `All (${users.length})` },
          { key: "Active", label: `Active (${activeCount})` },
          { key: "Deactivated", label: `Deactivated (${deactivatedCount})` },
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

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="relative w-full max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-textBody" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded bg-cardDark border border-gray-700 text-white outline-none focus:border-accentTeal text-sm"
          />
        </div>

        <button
          onClick={() => {
            setNewUser(emptyUser);
            setEditingId(null);
            setFieldErrors({});
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + Add User
        </button>
      </div>

      <div className="bg-cardDark p-4 rounded overflow-x-auto">
        {loading ? (
          <p className="text-textBody text-center py-8">Loading users...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-textBody text-center py-8">No Users Found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-textBody text-left">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Phone</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Added</th>
                <th className="pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-t border-gray-700">
                  <td className="py-3 pr-4 font-semibold">{u.name}</td>
                  <td className="py-3 pr-4 text-textBody">{u.email}</td>
                  <td className="py-3 pr-4 text-textBody">{u.phone || "—"}</td>
                  <td className="py-3 pr-4">{u.role}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(u.status)}`}>
                      {u.status}
                    </span>
                    {u.deactivationRequested && (
                      <span className="ml-2 px-2 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">
                        Deactivation Requested
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-textBody text-xs">
                    {u.createdAt ? new Date(u.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <button onClick={() => handleEdit(u)} className="text-accentTeal font-semibold mr-3">
                      Edit
                    </button>
                    {u.deactivationRequested && (
                      <button
                        onClick={() => handleApproveDeactivation(u)}
                        className="text-red-400 font-semibold"
                      >
                        Approve Deactivation
                      </button>
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
            onSubmit={handleSaveUser}
            className="bg-cardDark p-6 rounded-xl w-full max-w-md flex flex-col gap-4 relative max-h-[90vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-textBody hover:text-white text-lg"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold mb-2">
              {editingId ? "Edit User" : "Add New User"}
            </h2>

            <div>
              <label className="text-textBody text-sm">Name</label>
              <input
                placeholder="e.g. Zarnab Ahmed"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
              />
              {fieldErrors.name && <p className="text-red-400 text-xs mt-1">{fieldErrors.name}</p>}
            </div>

            <div>
              <label className="text-textBody text-sm">Email</label>
              <input
                type="email"
                placeholder="e.g. name@uavlab.com"
                value={newUser.email}
                disabled={!!editingId}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal disabled:opacity-50"
              />
              {fieldErrors.email && <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>}
            </div>

            <div>
              <label className="text-textBody text-sm">Phone Number</label>
              <input
                type="tel"
                placeholder="e.g. +92 300 1234567"
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
              />
              {fieldErrors.phone && <p className="text-red-400 text-xs mt-1">{fieldErrors.phone}</p>}
            </div>

            {!editingId && (
              <div>
                <label className="text-textBody text-sm">Password</label>
                <input
                  type="password"
                  placeholder="Set a password for this user"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                />
                {fieldErrors.password && <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>}
              </div>
            )}

            <div>
              <label className="text-textBody text-sm">Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
              >
                <option>Administrator</option>
                <option>Operator</option>
                <option>Technician</option>
                <option>Viewer</option>
              </select>
            </div>

            <div>
              <label className="text-textBody text-sm">Status</label>
              <select
                value={newUser.status}
                onChange={(e) => setNewUser({ ...newUser, status: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
              >
                <option>Active</option>
                <option>Deactivated</option>
              </select>
            </div>

            {fieldErrors.form && <p className="text-red-400 text-sm">{fieldErrors.form}</p>}

            <div className="flex justify-end mt-3">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving..." : editingId ? "Save Changes" : "Add User"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Users;