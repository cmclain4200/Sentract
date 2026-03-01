import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function ConfirmEmail() {
  const { user, emailConfirmed, signOut, resendConfirmation } = useAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState(null);

  // If somehow they're confirmed, redirect them
  if (emailConfirmed) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <div className="w-full text-center" style={{ maxWidth: 440 }}>
          <div className="surface" style={{ padding: "36px 40px" }}>
            <h2 className="text-white text-[20px] font-semibold mb-4">Email Confirmed</h2>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded text-[14px] font-semibold no-underline"
              style={{ background: "#09BC8A", color: "#0a0a0a", padding: "12px 24px" }}
            >
              Go to Dashboard <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function handleResend() {
    if (!user?.email) return;
    setResending(true);
    setError(null);
    try {
      await resendConfirmation(user.email);
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  }

  async function handleSignOut() {
    await signOut();
  }

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
            <h2 className="text-white text-[22px] font-semibold mb-2">Confirm Your Email</h2>
            <p className="text-[14px] mb-2" style={{ color: "#888", lineHeight: 1.6 }}>
              We sent a confirmation link to
            </p>
            <p className="text-[15px] font-semibold text-white mb-6">{user?.email}</p>
            <p className="text-[13px] mb-6" style={{ color: "#555", lineHeight: 1.6 }}>
              Click the link in the email to verify your account. Once confirmed, sign in to access your dashboard.
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

            <button
              onClick={handleSignOut}
              className="w-full rounded text-[14px] font-semibold transition-all duration-200 cursor-pointer"
              style={{ background: "#09BC8A", color: "#0a0a0a", border: "none", padding: "12px 24px", minHeight: 44 }}
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
