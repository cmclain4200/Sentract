import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export default function Settings() {
  const { user, profile } = useAuth();

  // Profile section state
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [profileStatus, setProfileStatus] = useState("idle"); // idle | saving | saved | error
  const [profileError, setProfileError] = useState(null);

  // Password section state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("idle");
  const [passwordError, setPasswordError] = useState(null);

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileStatus("saving");
    setProfileError(null);
    try {
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);
      if (dbErr) throw dbErr;

      await supabase.auth.updateUser({ data: { full_name: fullName } });
      setProfileStatus("saved");
      setTimeout(() => setProfileStatus("idle"), 2000);
    } catch (err) {
      setProfileError(err.message);
      setProfileStatus("error");
    }
  }

  async function handlePasswordSave(e) {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordStatus("saving");
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) throw err;
      setPasswordStatus("saved");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordStatus("idle"), 2000);
    } catch (err) {
      setPasswordError(err.message);
      setPasswordStatus("error");
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <span className="section-label">Configuration</span>
          <h1 className="page-title mt-1">Settings</h1>
        </div>

        {/* Profile Section */}
        <div className="surface p-6 mb-6">
          <div className="mb-5">
            <span className="section-label">Profile</span>
            <p className="sub-label mt-1">Manage your account information</p>
          </div>

          <form onSubmit={handleProfileSave} className="flex flex-col gap-4">
            <div>
              <label className="sub-label block mb-1.5">Email</label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", color: "#555" }}
              />
            </div>
            <div>
              <label className="sub-label block mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm text-white outline-none transition-colors"
                style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}
                onFocus={(e) => (e.target.style.borderColor = "#333")}
                onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
                placeholder="Enter your full name"
              />
            </div>

            {profileError && (
              <div className="p-3 rounded text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                {profileError}
              </div>
            )}
            {profileStatus === "saved" && (
              <div className="p-3 rounded text-sm" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}>
                Profile updated successfully.
              </div>
            )}

            <button
              type="submit"
              disabled={profileStatus === "saving"}
              className="w-full py-2.5 rounded text-sm font-semibold transition-all duration-200 cursor-pointer"
              style={{
                background: profileStatus === "saving" ? "#0a0a0a" : "#00d4aa",
                color: profileStatus === "saving" ? "#555" : "#0a0a0a",
                border: "none",
              }}
            >
              {profileStatus === "saving" ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </div>

        {/* Change Password Section */}
        <div className="surface p-6">
          <div className="mb-5">
            <span className="section-label">Security</span>
            <p className="sub-label mt-1">Update your password</p>
          </div>

          <form onSubmit={handlePasswordSave} className="flex flex-col gap-4">
            <div>
              <label className="sub-label block mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
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

            {passwordError && (
              <div className="p-3 rounded text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                {passwordError}
              </div>
            )}
            {passwordStatus === "saved" && (
              <div className="p-3 rounded text-sm" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}>
                Password updated successfully.
              </div>
            )}

            <button
              type="submit"
              disabled={passwordStatus === "saving"}
              className="w-full py-2.5 rounded text-sm font-semibold transition-all duration-200 cursor-pointer"
              style={{
                background: passwordStatus === "saving" ? "#0a0a0a" : "#00d4aa",
                color: passwordStatus === "saving" ? "#555" : "#0a0a0a",
                border: "none",
              }}
            >
              {passwordStatus === "saving" ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
