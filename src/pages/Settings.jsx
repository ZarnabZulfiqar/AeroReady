import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Settings() {
  const [userId, setUserId] = useState(null);
  const [originalEmail, setOriginalEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [memberSince, setMemberSince] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Preferences — UI-only for now, not wired to a backend column yet.
  const [emailNotifications, setEmailNotifications] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);
      setEmail(user.email || "");
      setOriginalEmail(user.email || "");

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, role, created_at")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        if (data.full_name) setFullName(data.full_name);
        if (data.role) setRole(data.role);
        if (data.created_at) setMemberSince(data.created_at);
      }
    }
    fetchProfile();
  }, []);

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
        <div className="w-full max-w-md flex flex-col gap-6">

          {/* ===== Account Info (read-only) ===== */}
          <div className="bg-cardDark p-6 rounded-xl flex flex-col gap-3">
            <h2 className="text-lg font-bold">Account</h2>
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
          </div>

          {/* ===== Profile + Security (existing, working logic) ===== */}
          <form
            onSubmit={handleSave}
            className="bg-cardDark p-6 rounded-xl flex flex-col gap-4"
          >
            <h2 className="text-lg font-bold">Profile</h2>

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

            <h2 className="text-lg font-bold mt-2">Security</h2>

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

          {/* ===== Preferences ===== */}
          <div className="bg-cardDark p-6 rounded-xl flex flex-col gap-4">
            <h2 className="text-lg font-bold">Preferences</h2>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Email notifications</p>
                <p className="text-textBody text-xs">Get notified about mission approvals and maintenance alerts</p>
              </div>
              <button
                type="button"
                onClick={() => setEmailNotifications((v) => !v)}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                  emailNotifications ? "bg-accentTeal" : "bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    emailNotifications ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

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

        </div>
      </div>
    </div>
  );
}

export default Settings;