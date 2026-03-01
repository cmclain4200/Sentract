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

  // Find invitation: by ID if provided, otherwise by email
  let invitation;
  if (invitation_id) {
    const { data } = await supabase
      .from("invitations")
      .select("*")
      .eq("id", invitation_id)
      .eq("status", "pending")
      .single();
    invitation = data;
  } else {
    const { data } = await supabase
      .from("invitations")
      .select("*")
      .eq("email", user.email)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    invitation = data;
  }

  if (!invitation) {
    return res.status(404).json({ error: "No pending invitation found" });
  }

  if (invitation.email !== user.email) {
    return res.status(403).json({ error: "Invitation is for a different email" });
  }

  if (new Date(invitation.expires_at) < new Date()) {
    await supabase.from("invitations").update({ status: "expired" }).eq("id", invitation.id);
    return res.status(410).json({ error: "Invitation has expired" });
  }

  // Check if user already belongs to the invited org
  const { data: existingInOrg } = await supabase
    .from("org_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", invitation.org_id)
    .single();

  if (existingInOrg) {
    // Already in the right org — just mark invitation as accepted
    await supabase.from("invitations").update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    }).eq("id", invitation.id);
    return res.status(200).json({ success: true, already_member: true });
  }

  // Check if user has an existing org membership (auto-created org from trigger)
  const { data: existing } = await supabase
    .from("org_members")
    .select("id, org_id, roles(name)")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    // Check if this is an auto-created org (user is only member and is owner)
    const { count } = await supabase
      .from("org_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", existing.org_id);

    if (count === 1 && existing.roles?.name === "org_owner") {
      // Safe to clean up the auto-created org — remove membership, teams, roles, org
      await supabase.from("team_members").delete().eq("user_id", user.id);
      await supabase.from("org_members").delete().eq("id", existing.id);
      // Delete teams, roles, then the org itself
      await supabase.from("teams").delete().eq("org_id", existing.org_id);
      await supabase.from("roles").delete().eq("org_id", existing.org_id);
      await supabase.from("organizations").delete().eq("id", existing.org_id);
    } else {
      return res.status(400).json({ error: "User already belongs to an organization with other members" });
    }
  }

  // Add to invited org
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
  }).eq("id", invitation.id);

  return res.status(200).json({ success: true });
}
