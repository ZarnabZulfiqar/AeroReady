import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Settings() {
  const [userId, setUserId] = useState(null);
  const [originalEmail, setOriginalEmail] = useState(""); // re-auth ke liye asli email
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        if (data.full_name) setFullName(data.full_name);
        if (data.role) setRole(data.role);
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

        // Re-authenticate before allowing a password change (SEC-AUTH practice —
        // SRS doesn't define a specific FR/SEC ID for this, so no requirement
        // number is cited here).
        // originalEmail use karo, current `email` state nahi — agar email field
        // edit ho chuki ho to bhi re-auth account ke ASLI (abhi confirmed) email se ho.
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

      // Auth side: email change (Supabase confirmation email bhejega, turant apply nahi hota)
      const authUpdate = { data: { full_name: fullName } };
      if (emailChanged) authUpdate.email = email;

      const { error: authError } = await supabase.auth.updateUser(authUpdate);
      if (authError) {
        setError("Failed to update profile.");
        setLoading(false);
        return;
      }

      // profiles table bhi sync karo — Users.jsx aur Login.jsx isi table se full_name/role parhte hain
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
        // Note: naya email tab tak active nahi hoga jab tak confirmation link click na ho.
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
        <form
          onSubmit={handleSave}
          className="bg-cardDark p-6 rounded-xl w-full max-w-md flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Profile</h2>
            <span className="text-xs px-3 py-1 rounded-full bg-accentTeal/20 text-accentTeal font-semibold">
              {role}
            </span>
          </div>

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
      </div>
    </div>
  );
}

export default Settings;