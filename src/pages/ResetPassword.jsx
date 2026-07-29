import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase automatically parses the recovery token from the URL
    // (redirectTo link from ForgotPassword) and creates a temporary session.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setSessionReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleReset(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!newPassword || !confirmPassword) {
      setError("Please fill in both fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Password updated successfully. Redirecting to login...");
    setTimeout(() => {
      supabase.auth.signOut();
      navigate("/");
    }, 2000);
  }

  return (
    <div className="bg-bgDark min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleReset}
        className="bg-cardDark p-6 rounded-xl w-full max-w-sm text-center"
      >
        <div className="w-12 h-12 rounded-full bg-accentTeal flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-bgDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 2 L14 9 L21 12 L14 15 L12 22 L10 15 L3 12 L10 9 Z" />
          </svg>
        </div>

        <h1 className="text-xl font-bold mb-1">
          <span className="text-white">Reset</span>{" "}
          <span className="text-accentTeal">Password</span>
        </h1>
        <p className="text-textBody text-sm mb-6">
          Enter your new password below.
        </p>

        {!sessionReady && !message && (
          <p className="text-orange-400 text-xs mb-4">
            Verifying reset link... if this doesn't update, please request a
            new reset link.
          </p>
        )}

        <div className="text-left mb-3">
          <label className="text-textBody text-sm">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            required
            className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white text-sm outline-none focus:border-accentTeal"
          />
        </div>

        <div className="text-left mb-4">
          <label className="text-textBody text-sm">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white text-sm outline-none focus:border-accentTeal"
          />
        </div>

        {message && <p className="text-accentTeal text-xs mb-3">{message}</p>}
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}

export default ResetPassword;