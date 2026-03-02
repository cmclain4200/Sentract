import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: "Invitation ID is required" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, status, expires_at, org_id, role_id, team_ids, organizations(name), roles(name)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Invitation not found" });
  }

  const expired = new Date(data.expires_at) < new Date();
  const valid = data.status === "pending" && !expired;

  // Resolve team names from team_ids
  let teamNames = [];
  if (data.team_ids?.length) {
    const { data: teams } = await supabase
      .from("teams")
      .select("name")
      .in("id", data.team_ids);
    teamNames = (teams || []).map((t) => t.name);
  }

  return res.status(200).json({
    id: data.id,
    email: data.email,
    orgName: data.organizations?.name || null,
    roleName: data.roles?.name || null,
    teamNames,
    status: expired ? "expired" : data.status,
    valid,
  });
}
