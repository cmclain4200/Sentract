import { supabase } from "./supabase";

export async function sendEmail({ to, user_ids, subject, template, templateData }) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ to, user_ids, subject, template, templateData }),
    }).catch((err) => console.error("Email send error:", err));
  } catch (err) {
    console.error("Email setup error:", err);
  }
}
