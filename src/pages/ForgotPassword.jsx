import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleReset(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Password reset link bhej diya gaya hai aapke email par.");
    }
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
          <span className="text-white">Forgot</span>{" "}
          <span className="text-accentTeal">Password</span>
        </h1>
        <p className="text-textBody text-sm mb-6">
          Apna email daalein, hum aapko reset link bhejenge.
        </p>

        <div className="text-left mb-4">
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

        {message && <p className="text-accentTeal text-xs mb-3">{message}</p>}
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <button type="submit" className="btn-primary w-full">
          Send Reset Link
        </button>

        <p
          onClick={() => navigate("/")}
          className="text-textBody text-xs mt-4 cursor-pointer"
        >
          Back to Login
        </p>
      </form>
    </div>
  );
}

export default ForgotPassword;