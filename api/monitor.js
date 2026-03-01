// Vercel Cron Function — runs every 6 hours
// Checks monitoring_configs due for breach re-checks
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (!supabaseServiceKey) {
    return res.status(500).json({ error: "Missing service role key" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();

  // Find configs due for check
  const { data: configs, error } = await supabase
    .from("monitoring_configs")
    .select("*, subjects(id, name, case_id, profile_data)")
    .eq("enabled", true)
    .or(`next_check_at.is.null,next_check_at.lte.${now.toISOString()}`);

  if (error || !configs?.length) {
    return res.status(200).json({ checked: 0 });
  }

  let checked = 0;
  let alerts = 0;

  for (const cfg of configs) {
    try {
      const subject = cfg.subjects;
      if (!subject) continue;

      const emails = (subject.profile_data?.contact?.email_addresses || [])
        .filter((e) => e.address)
        .map((e) => e.address);

      if (emails.length === 0) continue;

      const existingBreaches = subject.profile_data?.breaches?.records || [];

      for (const email of emails) {
        const hibpKey = process.env.HIBP_API_KEY || process.env.VITE_HIBP_API_KEY;
        if (!hibpKey) continue;

        const response = await fetch(
          `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
          {
            headers: {
              "hibp-api-key": hibpKey,
              "user-agent": "Sentract-Monitor",
            },
          }
        );

        if (response.status === 200) {
          const breaches = await response.json();
          for (const b of breaches) {
            const isNew = !existingBreaches.some(
              (e) => e.breach_name?.toLowerCase() === b.Name?.toLowerCase() ||
                     e.hibp_name?.toLowerCase() === b.Name?.toLowerCase()
            );
            if (isNew) {
              await supabase.from("monitoring_alerts").insert({
                subject_id: subject.id,
                user_id: cfg.user_id,
                alert_type: "new_breach",
                title: `New breach detected: ${b.Name}`,
                detail: `${email} found in ${b.Name} breach (${b.BreachDate})`,
                data: { breach: b, email },
              });
              alerts++;
            }
          }
        }

        // Rate limit: 1.5s between requests
        await new Promise((r) => setTimeout(r, 1500));
      }

      // Update check times
      const nextCheck = new Date(now.getTime() + cfg.frequency_hours * 3600000);
      await supabase
        .from("monitoring_configs")
        .update({ last_checked_at: now.toISOString(), next_check_at: nextCheck.toISOString() })
        .eq("id", cfg.id);

      checked++;
    } catch (err) {
      console.error(`Monitor error for config ${cfg.id}:`, err);
    }
  }

  return res.status(200).json({ checked, alerts });
}
