import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { invitation_id } = req.body;
  if (!invitation_id) {
    return res.status(400).json({ error: "invitation_id is required" });
  }

  // Check user doesn't already have an org
  const { data: existing } = await supabase
    .from("org_members")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return res.status(400).json({ error: "User already belongs to an organization" });
  }

  // Fetch the invitation
  const { data: invitation } = await supabase
    .from("invitations")
    .select("*")
    .eq("id", invitation_id)
    .eq("status", "pending")
    .single();

  if (!invitation) {
    return res.status(404).json({ error: "Invitation not found or expired" });
  }

  if (invitation.email !== user.email) {
    return res.status(403).json({ error: "Invitation is for a different email" });
  }

  if (new Date(invitation.expires_at) < new Date()) {
    await supabase.from("invitations").update({ status: "expired" }).eq("id", invitation_id);
    return res.status(410).json({ error: "Invitation has expired" });
  }

  // Add to org
  const { error: memberErr } = await supabase.from("org_members").insert({
    user_id: user.id,
    org_id: invitation.org_id,
    role_id: invitation.role_id,
  });

  if (memberErr) {
    return res.status(400).json({ error: memberErr.message });
  }

  // Update profile with org_id
  await supabase.from("profiles").update({ org_id: invitation.org_id }).eq("id", user.id);

  // Add to team if specified
  if (invitation.team_id) {
    await supabase.from("team_members").insert({
      user_id: user.id,
      team_id: invitation.team_id,
      added_by: invitation.invited_by,
    });
  }

  // Mark invitation as accepted
  await supabase.from("invitations").update({
    status: "accepted",
    accepted_at: new Date().toISOString(),
  }).eq("id", invitation_id);

  return res.status(200).json({ success: true });
}
