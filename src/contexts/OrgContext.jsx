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
