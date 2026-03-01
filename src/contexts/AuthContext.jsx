import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext({});

function isEmailConfirmed(user) {
  if (!user) return false;
  // Supabase sets email_confirmed_at when the user confirms their email
  if (user.email_confirmed_at) return true;
  // Also check confirmed_at (older Supabase versions)
  if (user.confirmed_at) return true;
  // Check identities — if empty array, email not yet confirmed
  if (user.identities && user.identities.length === 0) return false;
  // If identity has verified, user is confirmed
  if (user.identities?.[0]?.identity_data?.email_verified) return true;
  return false;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
  }

  const handleUserChange = useCallback((u) => {
    setUser(u);
    setEmailConfirmed(isEmailConfirmed(u));
    if (u) {
      fetchProfile(u.id);
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUserChange(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUserChange(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [handleUserChange]);

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    // signInWithPassword only succeeds for confirmed users on most Supabase configs,
    // but double-check just in case
    if (data.user && !isEmailConfirmed(data.user)) {
      await supabase.auth.signOut();
      throw new Error("Please confirm your email address before signing in. Check your inbox for a confirmation link.");
    }
    return data;
  }

  async function signUp(email, password, metadata) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/login?confirmed=true`,
      },
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setEmailConfirmed(false);
  }

  async function resendConfirmation(email) {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    if (error) throw error;
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, emailConfirmed, signIn, signUp, signOut, resendConfirmation }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
