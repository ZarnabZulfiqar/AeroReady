import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

function Settings() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState(null);
  const [originalEmail, setOriginalEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [memberSince, setMemberSince] = useState(null);
  const [lastSignIn, setLastSignIn] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // My Activity
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Danger Zone
  const [deactivationRequested, setDeactivationRequested] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Controls which section is expanded. null = all collapsed.
  const [openSection, setOpenSection] = useState(null);

  function toggleSection(name) {
    setOpenSection((prev) => (prev === name ? null : name));
  }

  useEffect(() => {
    async function fetchProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);
      setEmail(user.email || "");
      setOriginalEmail(user.email || "");
      setLastSignIn(user.last_sign_in_at || null);

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, role, created_at, deactivation_requested")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        if (data.full_name) setFullName(data.full_name);
        if (data.role) setRole(data.role);
        if (data.created_at) setMemberSince(data.created_at);
        setDeactivationRequested(!!data.deactivation_requested);
      }
    }
    fetchProfile();
  }, []);

  // NOTE: missions.pilot / missions.decided_by / maintenance_records.technician_id
  // are currently stored as display-name text in this schema, so activity is
  // matched by full_name. If these are ever switched to store the user's id
  // instead, update the .eq()/.ilike() calls below to match on userId.
  async function fetchActivity() {
    if (!fullName || !role) return;
    setActivityLoading(true);

    let rows = [];

    if (role === "Operator") {
      const { data } = await supabase
        .from("missions")
        .select("id, name, status, scheduled_date")
        .eq("pilot", fullName)
        .order("scheduled_date", { ascending: false });
      rows = (data || []).map((m) => ({
        id: m.id,
        label: `Submitted mission "${m.name}"`,
        status: m.status,
        date: m.scheduled_date,
      }));
    } else if (role === "Administrator") {
      const { data } = await supabase
        .from("missions")
        .select("id, name, decision, decided_at")
        .ilike("decided_by", `%${fullName}%`)
        .order("decided_at", { ascending: false });
      rows = (data || []).map((m) => ({
        id: m.id,
        label: `${m.decision === "approved" ? "Approved" : "Rejected"} mission "${m.name}"`,
        status: m.decision,
        date: m.decided_at,
      }));
    } else if (role === "Technician") {
      const { data } = await supabase
        .from("maintenance_records")
        .select("maintenance_id, asset_id, inspection_outcome, next_due_date")
        .eq("technician_id", fullName)
        .order("next_due_date", { ascending: false });
      rows = (data || []).map((m) => ({
        id: m.maintenance_id,
        label: `Resolved issue on ${m.asset_id}`,
        status: m.inspection_outcome,
        date: m.next_due_date,
      }));
    }

    setActivity(rows);
    setActivityLoading(false);
  }

  useEffect(() => {
    if (openSection === "activity" && activity.length === 0) {
      fetchActivity();
    }
  }, [openSection]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  function handleExportActivity() {
    if (activity.length === 0) return;

    const header = "Item,Status,Date\n";
    const rows = activity
      .map((a) => `"${a.label}","${a.status || ""}","${a.date || ""}"`)
      .join("\n");
    const csv = header + rows;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "my-activity.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleRequestDeactivation() {
    if (!userId) return;
    setDeactivating(true);

    const { error } = await supabase
      .from("profiles")
      .update({ deactivation_requested: true })
      .eq("id", userId);

    if (!error) {
      setDeactivationRequested(true);
    } else {
      setError("Failed to send deactivation request. " + error.message);
    }
    setDeactivating(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setLoading(true);

    try {
      const emailChanged = email !== originalEmail;

      if (newPassword) {
        if (!currentPassword) {
          setError("Please enter your current password to change it.");
          setLoading(false);
          return;
        }
        if (newPassword.length < 6) {
          setError("New password must be at least 6 characters.");
          setLoading(false);
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: originalEmail,
          password: currentPassword,
        });

        if (signInError) {
          setError("Current password is incorrect.");
          setLoading(false);
          return;
        }

        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (passwordError) {
          setError("Failed to update password. Try again.");
          setLoading(false);
          return;
        }
      }

      const authUpdate = { data: { full_name: fullName } };
      if (emailChanged) authUpdate.email = email;

      const { error: authError } = await supabase.auth.updateUser(authUpdate);
      if (authError) {
        setError("Failed to update profile.");
        setLoading(false);
        return;
      }

      if (userId) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: fullName })
          .eq("id", userId);

        if (profileError) {
          setError("Profile name saved to account but failed to sync with directory.");
          setLoading(false);
          return;
        }
      }

      if (emailChanged) {
        setOriginalEmail(email);
        setError("");
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }

      setCurrentPassword("");
      setNewPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex justify-center">
        <div className="w-full max-w-md flex flex-col gap-4">

          {/* ===== Account Info ===== */}
          <div className="bg-cardDark rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection("account")}
              className="w-full flex items-center justify-between p-6 text-left"
            >
              <h2 className="text-lg font-bold">Account</h2>
              <span className="text-textBody text-xl">
                {openSection === "account" ? "−" : "+"}
              </span>
            </button>

            {openSection === "account" && (
              <div className="px-6 pb-6 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-textBody text-sm">Role</span>
                  <span className="text-xs px-3 py-1 rounded-full bg-accentTeal/20 text-accentTeal font-semibold">
                    {role || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-textBody text-sm">Member since</span>
                  <span className="text-sm text-white">
                    {memberSince ? new Date(memberSince).toLocaleDateString() : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-textBody text-sm">Logged in at</span>
                  <span className="text-sm text-white">
                    {lastSignIn ? new Date(lastSignIn).toLocaleString() : "—"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ===== Profile + Security ===== */}
          <div className="bg-cardDark rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection("profile")}
              className="w-full flex items-center justify-between p-6 text-left"
            >
              <h2 className="text-lg font-bold">Profile & Security</h2>
              <span className="text-textBody text-xl">
                {openSection === "profile" ? "−" : "+"}
              </span>
            </button>

            {openSection === "profile" && (
              <form onSubmit={handleSave} className="px-6 pb-6 flex flex-col gap-4">
                <div>
                  <label className="text-textBody text-sm">Full name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                  />
                </div>

                <div>
                  <label className="text-textBody text-sm">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                  />
                  {email !== originalEmail && (
                    <p className="text-textBody text-xs mt-1">
                      Changing this will send a confirmation link to the new address.
                    </p>
                  )}
                </div>

                <h3 className="text-md font-bold mt-2">Security</h3>

                <div>
                  <label className="text-textBody text-sm">Current password</label>
                  <input
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                  />
                </div>

                <div>
                  <label className="text-textBody text-sm">New password</label>
                  <input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white outline-none focus:border-accentTeal"
                  />
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button type="submit" disabled={loading} className="btn-primary mt-2">
                  {loading ? "Saving..." : saved ? "Saved ✓" : "Save Changes"}
                </button>
              </form>
            )}
          </div>

          {/* ===== My Activity ===== */}
          <div className="bg-cardDark rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection("activity")}
              className="w-full flex items-center justify-between p-6 text-left"
            >
              <h2 className="text-lg font-bold">My Activity</h2>
              <span className="text-textBody text-xl">
                {openSection === "activity" ? "−" : "+"}
              </span>
            </button>

            {openSection === "activity" && (
              <div className="px-6 pb-6 flex flex-col gap-3">
                {activityLoading ? (
                  <p className="text-textBody text-sm">Loading...</p>
                ) : activity.length === 0 ? (
                  <p className="text-textBody text-sm">No activity recorded yet.</p>
                ) : (
                  <>
                    <ul className="flex flex-col gap-2">
                      {activity.map((a) => (
                        <li key={a.id} className="text-sm border-t border-gray-700 pt-2">
                          <p className="text-white">{a.label}</p>
                          <p className="text-textBody text-xs">
                            {a.status} {a.date ? `· ${new Date(a.date).toLocaleDateString()}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={handleExportActivity}
                      className="mt-2 text-accentTeal text-sm font-semibold self-start"
                    >
                      Export as CSV
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ===== Display Preferences ===== */}
          <div className="bg-cardDark rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection("preferences")}
              className="w-full flex items-center justify-between p-6 text-left"
            >
              <h2 className="text-lg font-bold">Preferences</h2>
              <span className="text-textBody text-xl">
                {openSection === "preferences" ? "−" : "+"}
              </span>
            </button>

            {openSection === "preferences" && (
              <div className="px-6 pb-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">Display</p>
                    <p className="text-textBody text-xs">Dark mode (default)</p>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-gray-600/40 text-gray-300">
                    Dark
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ===== Sign Out ===== */}
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full py-3 rounded-xl bg-cardDark text-red-400 font-semibold hover:bg-red-500/10"
          >
            Sign Out
          </button>

          {/* ===== Danger Zone ===== */}
          <div className="bg-cardDark rounded-xl overflow-hidden border border-red-500/30">
            <button
              type="button"
              onClick={() => toggleSection("danger")}
              className="w-full flex items-center justify-between p-6 text-left"
            >
              <h2 className="text-lg font-bold text-red-400">Danger Zone</h2>
              <span className="text-textBody text-xl">
                {openSection === "danger" ? "−" : "+"}
              </span>
            </button>

            {openSection === "danger" && (
              <div className="px-6 pb-6 flex flex-col gap-3">
                <p className="text-textBody text-sm">
                  Requesting deactivation notifies an Administrator to review and process your account.
                </p>
                {deactivationRequested ? (
                  <p className="text-sm text-orange-400 font-semibold">
                    Deactivation request pending Administrator review.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestDeactivation}
                    disabled={deactivating}
                    className="w-full py-3 rounded-full border border-red-400 text-red-400 font-semibold hover:bg-red-400/10"
                  >
                    {deactivating ? "Sending..." : "Request Account Deactivation"}
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default Settings;