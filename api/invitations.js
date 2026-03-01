import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  // Get user token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];

  // Create client with service role for admin operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify the user
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  // Check user's org membership and permissions
  const { data: membership } = await supabase
    .from("org_members")
    .select("*, roles(name, permissions)")
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return res.status(403).json({ error: "No organization membership" });
  }

  const permissions = membership.roles?.permissions || {};

  if (req.method === "POST") {
    // Create invitation
    if (!permissions.invite_member) {
      return res.status(403).json({ error: "No permission to invite members" });
    }

    const { email, role_id, team_id } = req.body;
    if (!email || !role_id) {
      return res.status(400).json({ error: "Email and role_id are required" });
    }

    // Check that the role belongs to the user's org
    const { data: role } = await supabase
      .from("roles")
      .select("id, name")
      .eq("id", role_id)
      .eq("org_id", membership.org_id)
      .single();

    if (!role) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Don't allow inviting as org_owner unless caller is org_owner
    if (role.name === "org_owner" && membership.roles?.name !== "org_owner") {
      return res.status(403).json({ error: "Cannot invite as org_owner" });
    }

    const { data, error } = await supabase.from("invitations").insert({
      email: email.trim().toLowerCase(),
      org_id: membership.org_id,
      role_id,
      team_id: team_id || null,
      invited_by: user.id,
    }).select().single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json(data);
  }

  if (req.method === "GET") {
    // List invitations for org
    const { data, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(200).json(data);
  }

  if (req.method === "PATCH") {
    // Revoke invitation
    if (!permissions.invite_member) {
      return res.status(403).json({ error: "No permission" });
    }

    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Invitation id is required" });
    }

    const { data, error } = await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("org_id", membership.org_id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
