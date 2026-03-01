import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

const TEMPLATES = {
  invitation({ orgName, roleName, signupUrl }) {
    return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:520px;margin:40px auto;padding:32px;background:#111;border:1px solid #1e1e1e;border-radius:8px;">
  <div style="font-size:11px;letter-spacing:0.1em;color:#555;text-transform:uppercase;margin-bottom:16px;">Sentract</div>
  <h1 style="color:#fff;font-size:20px;margin:0 0 12px;">You've been invited</h1>
  <p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 24px;">
    You've been invited to join <strong style="color:#fff;">${orgName}</strong> as a <strong style="color:#09BC8A;">${roleName}</strong>.
  </p>
  <a href="${signupUrl}" style="display:inline-block;padding:12px 28px;background:#09BC8A;color:#0a0a0a;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">Accept Invitation</a>
  <p style="color:#444;font-size:12px;margin-top:24px;">If you didn't expect this invitation, you can safely ignore this email.</p>
</div>
</body></html>`;
  },

  assessment_submitted({ moduleName, subjectName, submitterName }) {
    return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:520px;margin:40px auto;padding:32px;background:#111;border:1px solid #1e1e1e;border-radius:8px;">
  <div style="font-size:11px;letter-spacing:0.1em;color:#555;text-transform:uppercase;margin-bottom:16px;">Sentract</div>
  <h1 style="color:#fff;font-size:20px;margin:0 0 12px;">Assessment Awaiting Review</h1>
  <p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 16px;">
    <strong style="color:#fff;">${submitterName || "An analyst"}</strong> submitted a
    <strong style="color:#f59e0b;">${moduleName}</strong> assessment${subjectName ? ` for <strong style="color:#fff;">${subjectName}</strong>` : ""}.
  </p>
  <p style="color:#555;font-size:13px;">Log in to Sentract to review and approve.</p>
</div>
</body></html>`;
  },

  assessment_status({ moduleName, subjectName, status, reviewerName }) {
    const colors = { approved: "#09BC8A", rejected: "#ef4444", published: "#3b82f6" };
    const color = colors[status] || "#888";
    return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:520px;margin:40px auto;padding:32px;background:#111;border:1px solid #1e1e1e;border-radius:8px;">
  <div style="font-size:11px;letter-spacing:0.1em;color:#555;text-transform:uppercase;margin-bottom:16px;">Sentract</div>
  <h1 style="color:#fff;font-size:20px;margin:0 0 12px;">Assessment <span style="color:${color};">${status.charAt(0).toUpperCase() + status.slice(1)}</span></h1>
  <p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 16px;">
    Your <strong style="color:#fff;">${moduleName}</strong> assessment${subjectName ? ` for <strong style="color:#fff;">${subjectName}</strong>` : ""}
    has been <strong style="color:${color};">${status}</strong>${reviewerName ? ` by ${reviewerName}` : ""}.
  </p>
  <p style="color:#555;font-size:13px;">Log in to Sentract to view details.</p>
</div>
</body></html>`;
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!resendApiKey) {
    return res.status(200).json({ skipped: true, reason: "RESEND_API_KEY not configured" });
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

  const { to, user_ids, subject, template, templateData } = req.body;

  if (!template || !TEMPLATES[template]) {
    return res.status(400).json({ error: "Invalid template" });
  }

  const html = TEMPLATES[template](templateData || {});

  // Resolve recipients
  let recipients = [];

  if (to) {
    recipients = Array.isArray(to) ? to : [to];
  } else if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
    // Resolve user IDs to emails server-side
    for (const uid of user_ids) {
      try {
        const { data: { user: u } } = await supabase.auth.admin.getUserById(uid);
        if (u?.email) recipients.push(u.email);
      } catch (e) {
        console.error(`Failed to resolve user ${uid}:`, e.message);
      }
    }
  }

  if (recipients.length === 0) {
    return res.status(400).json({ error: "No recipients" });
  }

  try {
    const resend = new Resend(resendApiKey);
    const results = [];

    for (const recipient of recipients) {
      const { data, error } = await resend.emails.send({
        from: `Sentract <${fromEmail}>`,
        to: recipient,
        subject: subject || "Sentract Notification",
        html,
      });

      if (error) {
        console.error(`Email to ${recipient} failed:`, error);
        results.push({ email: recipient, error: error.message });
      } else {
        results.push({ email: recipient, id: data?.id });
      }
    }

    return res.status(200).json({ sent: results });
  } catch (err) {
    console.error("Resend error:", err);
    return res.status(500).json({ error: "Failed to send email" });
  }
}
