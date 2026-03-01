import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Mail, ArrowRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const { signUp, resendConfirmation } = useAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Clear any existing session when landing on signup page
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) supabase.auth.signOut();
    });
  }, []);

  useEffect(() => {
    const inviteId = searchParams.get("invite");
    if (!inviteId) return;
    fetch(`/api/get-invitation?id=${inviteId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.valid) {
          setInvitation(data);
          setEmail(data.email);
          setOrganization(data.orgName || "");
        }
      })
      .catch(() => {});
  }, [searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await signUp(email, password, { full_name: fullName, organization });
      // If user is already confirmed (e.g. autoconfirm enabled), go straight to dashboard
      if (user?.email_confirmed_at || user?.confirmed_at) {
        navigate("/dashboard");
      } else {
        // Sign out the unconfirmed session so they can't access protected routes
        await supabase.auth.signOut();
        setSubmitted(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await resendConfirmation(email);
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  }

  // Confirmation pending screen
  if (submitted) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <div className="w-full" style={{ maxWidth: 440 }}>
          <div className="flex items-center mb-8 justify-center">
            <img src="/sentract-logo-dark.png" alt="Sentract" style={{ height: 36 }} />
          </div>

          <div className="surface" style={{ padding: "36px 40px" }}>
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(9,188,138,0.12)", border: "1px solid rgba(9,188,138,0.25)" }}>
                <Mail size={24} color="#09BC8A" />
              </div>
              <h2 className="text-white text-[22px] font-semibold mb-2">Check Your Email</h2>
              <p className="text-[14px] mb-6" style={{ color: "#888", lineHeight: 1.6 }}>
                We sent a confirmation link to<br />
                <strong className="text-white">{email}</strong>
              </p>
              <p className="text-[13px] mb-6" style={{ color: "#555", lineHeight: 1.6 }}>
                Click the link in the email to verify your account, then sign in.
              </p>

              {error && (
                <div className="w-full mb-4 p-3 rounded text-[13px]" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleResend}
                disabled={resending || resent}
                className="w-full rounded text-[14px] font-semibold transition-all duration-200 cursor-pointer mb-3"
                style={{
                  background: "transparent",
                  color: resent ? "#09BC8A" : "#888",
                  border: `1px solid ${resent ? "#09BC8A" : "#333"}`,
                  padding: "12px 24px",
                  minHeight: 44,
                }}
              >
                {resent ? "Confirmation email resent" : resending ? "Resending..." : "Resend confirmation email"}
              </button>

              <Link
                to="/login"
                className="w-full rounded text-[14px] font-semibold transition-all duration-200 no-underline flex items-center justify-center gap-2"
                style={{ background: "#09BC8A", color: "#0a0a0a", padding: "12px 24px", minHeight: 44 }}
              >
                Go to Sign In <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center" style={{ background: "#0a0a0a" }}>
      <div className="w-full" style={{ maxWidth: 440 }}>
        {/* Logo */}
        <div className="flex items-center mb-8 justify-center">
          <img src="/sentract-logo-dark.png" alt="Sentract" style={{ height: 36 }} />
        </div>

        <div className="surface" style={{ padding: "36px 40px" }}>
          <div className="mb-7">
            <span className="section-label">Authentication</span>
            <h2 className="text-white text-[24px] font-semibold mt-1">Create Account</h2>
          </div>

          {invitation && (
            <div className="mb-5 p-4 rounded text-[14px]" style={{ background: "rgba(9,188,138,0.1)", border: "1px solid rgba(9,188,138,0.2)", color: "#09BC8A" }}>
              You've been invited to join <strong>{invitation.orgName}</strong>
            </div>
          )}

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
