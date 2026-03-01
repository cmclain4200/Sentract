import { useOrg } from "../contexts/OrgContext";

export function usePermissions() {
  const { can, isOrgOwner, role, loading } = useOrg();
  return { can, isOrgOwner, role, loading };
}
