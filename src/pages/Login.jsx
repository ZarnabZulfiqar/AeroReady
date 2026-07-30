import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../supabaseClient";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Step 1: Check lock status before attempting login
    const { data: lockData } = await supabase.rpc("check_account_lock", { p_email: email });

    if (lockData && lockData.length > 0) {
      const status = lockData[0];

      if (status.is_locked) {
        setError("Your account has been locked due to multiple failed login attempts. Please contact your administrator.");
        setLoading(false);
        return;
      }

      if (status.locked_until && new Date(status.locked_until) > new Date()) {
        const waitMins = Math.ceil((new Date(status.locked_until) - new Date()) / 60000);
        setError(`Too many failed attempts. Please wait ${waitMins} minute(s) before trying again.`);
        setLoading(false);
        return;
      }
    }

    // Step 2: Normal login attempt
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Login failed — increment failed attempt count
      const { data: failData } = await supabase.rpc("register_failed_login", { p_email: email });

      if (failData && failData.length > 0) {
        const result = failData[0];
        if (result.is_locked) {
          setError("Your account has been locked due to multiple failed login attempts. Please contact your administrator.");
        } else if (result.locked_until) {
          setError("Too many failed attempts. Please wait a couple of minutes before trying again.");
        } else {
          setError("Invalid login credentials");
        }
      } else {
        setError("Invalid login credentials");
      }
      setLoading(false);
      return;
    }

    // Login successful — reset lock counters
    await supabase.rpc("reset_login_lock", { p_email: email });

    // FR-005 / BR-001: deactivated user account shall not be permitted to authenticate
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .single();

    if (profileError) {
      setError("Could not verify account status. Please try again.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (profile.status === "Deactivated") {
      // SEC-AUTH-02: session shall be invalidated on deactivation
      await supabase.auth.signOut();
      setError("This account has been deactivated. Contact your administrator.");
      setLoading(false);
      return;
    }

    setLoading(false);
    navigate("/dashboard");
  }

  return (
    <div className="bg-bgDark min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleLogin}
        className="bg-cardDark p-6 rounded-xl w-full max-w-sm text-center"
      >
        <div className="w-12 h-12 rounded-full bg-accentTeal flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-bgDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 2 L14 9 L21 12 L14 15 L12 22 L10 15 L3 12 L10 9 Z" />
          </svg>
        </div>

        <h1 className="text-xl font-bold mb-1">
          <span className="text-white">Aero</span>
          <span className="text-accentTeal">Ready</span>
        </h1>
        <p className="text-textBody text-sm mb-6">Sign in to your account</p>

        <div className="text-left mb-3">
          <label className="text-textBody text-sm">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white text-sm outline-none focus:border-accentTeal"
          />
        </div>

        <div className="text-left mb-2">
          <label className="text-textBody text-sm">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            className="w-full mt-1 p-2 rounded bg-bgDark border border-gray-700 text-white text-sm outline-none focus:border-accentTeal"
          />
        </div>

        <Link
          to="/forgot-password"
          className="text-accentTeal text-xs text-right mb-4 block cursor-pointer"
        >
          Forgot password?
        </Link>

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

export default Login;