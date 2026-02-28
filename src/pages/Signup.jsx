import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signUp(email, password, { full_name: fullName, organization });
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center" style={{ background: "#0a0a0a" }}>
      <div className="w-full" style={{ maxWidth: 440 }}>
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src="/sentract-logo.png" alt="Sentract" style={{ width: 32, height: 32, filter: "invert(1)" }} />
          <span className="text-[24px] font-semibold text-white tracking-tight">Sentract</span>
        </div>

        <div className="surface" style={{ padding: "36px 40px" }}>
          <div className="mb-7">
            <span className="section-label">Authentication</span>
            <h2 className="text-white text-[24px] font-semibold mt-1">Create Account</h2>
          </div>

          {error && (
            <div className="mb-5 p-4 rounded text-[14px]" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="sub-label block mb-2">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded text-[15px] text-white outline-none transition-colors"
                style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "10px 14px", minHeight: 44 }}
                onFocus={(e) => (e.target.style.borderColor = "#333")}
                onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
              />
            </div>
            <div>
              <label className="sub-label block mb-2">Organization</label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full rounded text-[15px] text-white outline-none transition-colors"
                style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "10px 14px", minHeight: 44 }}
                onFocus={(e) => (e.target.style.borderColor = "#333")}
                onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="sub-label block mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded text-[15px] text-white outline-none transition-colors"
                style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "10px 14px", minHeight: 44 }}
                onFocus={(e) => (e.target.style.borderColor = "#333")}
                onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
              />
            </div>
            <div>
              <label className="sub-label block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded text-[15px] text-white outline-none transition-colors"
                style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "10px 14px", minHeight: 44 }}
                onFocus={(e) => (e.target.style.borderColor = "#333")}
                onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded text-[15px] font-semibold transition-all duration-200 cursor-pointer"
              style={{
                background: loading ? "#0a0a0a" : "#09BC8A",
                color: loading ? "#555" : "#0a0a0a",
                border: "none",
                padding: "14px 32px",
                minHeight: 48,
              }}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-[14px]" style={{ color: "#555" }}>
              Already have an account?{" "}
              <Link to="/login" className="no-underline" style={{ color: "#09BC8A" }}>
                Sign in
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
