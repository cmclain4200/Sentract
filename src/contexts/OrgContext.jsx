import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const OrgContext = createContext({});

export function OrgProvider({ children }) {
  const { user } = useAuth();
  const [org, setOrg] = useState(null);
  const [role, setRole] = useState(null);
  const [membership, setMembership] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrgData = useCallback(async () => {
    if (!user) {
      setOrg(null);
      setRole(null);
      setMembership(null);
      setTeams([]);
      setLoading(false);
      return;
    }

    try {
      // Check for pending invitations and accept them before loading org data.
      // This handles cases where handle_new_user trigger missed the invitation.
      const session = (await supabase.auth.getSession()).data.session;
      if (session?.access_token) {
        try {
          const resp = await fetch("/api/accept-invitation", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({}),
          });
          if (resp.ok) {
            const result = await resp.json();
            if (result.success && !result.already_member) {
              // Invitation was accepted — org data changed, continue loading fresh data
            }
          }
        } catch {
          // Ignore — no pending invitation or network error
        }
      }

      // Fetch org membership with role and org in one query
      const { data: memberData } = await supabase
        .from("org_members")
        .select("*, roles(*), organizations(*)")
        .eq("user_id", user.id)
        .single();

      if (memberData) {
        setMembership(memberData);
        setOrg(memberData.organizations);
        setRole(memberData.roles);

        // Fetch teams for this org
        const { data: teamData } = await supabase
          .from("teams")
          .select("*, team_members(user_id)")
          .eq("org_id", memberData.org_id)
          .order("created_at", { ascending: true });

        setTeams(teamData || []);
      }
    } catch (err) {
      console.error("Failed to fetch org data:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrgData();
  }, [fetchOrgData]);

  const can = useCallback(
    (permission) => {
      if (!role?.permissions) return false;
      return role.permissions[permission] === true;
    },
    [role]
  );

  const isOrgOwner = useCallback(() => {
    return role?.name === "org_owner";
  }, [role]);

  const isRole = useCallback((name) => role?.name === name, [role]);

  const myTeams = useCallback(() => {
    if (!user) return [];
    return teams.filter((t) =>
      t.team_members?.some((tm) => tm.user_id === user.id)
    );
  }, [teams, user]);

  return (
    <OrgContext.Provider
      value={{
        org,
        role,
        teams,
        membership,
        loading,
        can,
        isOrgOwner,
        isRole,
        myTeams,
        refetch: fetchOrgData,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
