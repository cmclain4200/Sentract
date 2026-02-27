import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if URL hash contains recovery token
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      setRecoveryMode(true);
    }

    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleRequestReset(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(e) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) throw err;
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center" style={{ background: "#0a0a0a" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <img src="/sentract-logo.png" alt="Sentract" style={{ width: 28, height: 28, filter: "invert(1)" }} />
          <span className="text-[22px] font-semibold text-white tracking-tight">Sentract</span>
        </div>

        <div className="surface p-6">
          <div className="mb-6">
            <span className="section-label">{recoveryMode ? "Set New Password" : "Account Recovery"}</span>
            <h2 className="text-white text-lg font-semibold mt-1">
              {recoveryMode ? "Choose a New Password" : "Reset Password"}
            </h2>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
              {error}
            </div>
          )}

          {recoveryMode ? (
            <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
              <div>
                <label className="sub-label block mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 rounded text-sm text-white outline-none transition-colors"
                  style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}
                  onFocus={(e) => (e.target.style.borderColor = "#333")}
                  onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
                />
              </div>
              <div>
                <label className="sub-label block mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded text-sm text-white outline-none transition-colors"
                  style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}
                  onFocus={(e) => (e.target.style.borderColor = "#333")}
                  onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded text-sm font-semibold transition-all duration-200 cursor-pointer"
                style={{
                  background: loading ? "#0a0a0a" : "#00d4aa",
                  color: loading ? "#555" : "#0a0a0a",
                  border: "none",
                }}
              >
                {loading ? "Updating..." : "Set New Password"}
              </button>
            </form>
          ) : sent ? (
            <div className="text-center py-4">
              <div className="text-sm mb-2" style={{ color: "#10b981" }}>
                Check your email
              </div>
              <p className="text-[12px]" style={{ color: "#888" }}>
                If an account exists for {email}, you'll receive a password reset link shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleRequestReset} className="flex flex-col gap-4">
              <div>
                <label className="sub-label block mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 rounded text-sm text-white outline-none transition-colors"
                  style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}
                  onFocus={(e) => (e.target.style.borderColor = "#333")}
                  onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded text-sm font-semibold transition-all duration-200 cursor-pointer"
                style={{
                  background: loading ? "#0a0a0a" : "#00d4aa",
                  color: loading ? "#555" : "#0a0a0a",
                  border: "none",
                }}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}

          <div className="mt-5 text-center">
            <span className="text-sm" style={{ color: "#555" }}>
              <Link to="/login" className="no-underline" style={{ color: "#00d4aa" }}>
                Back to Sign In
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
