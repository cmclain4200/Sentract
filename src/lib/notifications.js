import { supabase } from "./supabase";
import { sendEmail } from "./email";

export async function createRbacNotification({ userId, orgId, notificationType, title, detail, link, metadata }) {
  supabase
    .from("rbac_notifications")
    .insert({ user_id: userId, org_id: orgId, notification_type: notificationType, title, detail, link, metadata: metadata || {} })
    .then(({ error }) => {
      if (error) console.error("Notification insert error:", error.message);
    });
}

export async function fetchRbacNotifications({ limit = 10 } = {}) {
  const { data, error } = await supabase
    .from("rbac_notifications")
    .select("*")
    .eq("read", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("fetchRbacNotifications error:", error.message);
    return [];
  }
  return data || [];
}

export async function markNotificationRead(id) {
  await supabase.from("rbac_notifications").update({ read: true }).eq("id", id);
}

export async function markAllNotificationsRead() {
  await supabase.from("rbac_notifications").update({ read: true }).eq("read", false);
}

export async function notifyAssessmentStatusChange({ assessment, newStatus, orgId, currentUserId, moduleName, subjectName }) {
  const link = assessment.subject_id ? `/case/${assessment.case_id || ""}/profile` : undefined;

  if (newStatus === "submitted") {
    // Notify org members with approve_assessment permission (not self)
    const { data: members } = await supabase
      .from("org_members")
      .select("user_id, roles(permissions)")
      .eq("org_id", orgId);

    const reviewerIds = (members || [])
      .filter((m) => m.user_id !== currentUserId && m.roles?.permissions?.approve_assessment)
      .map((m) => m.user_id);

    for (const uid of reviewerIds) {
      createRbacNotification({
        userId: uid,
        orgId,
        notificationType: "assessment_submitted",
        title: `${moduleName || "Assessment"} submitted for review`,
        detail: subjectName ? `Subject: ${subjectName}` : undefined,
        link,
        metadata: { assessment_id: assessment.id, module: assessment.module },
      });
    }

    if (reviewerIds.length > 0) {
      sendEmail({
        user_ids: reviewerIds,
        subject: `Assessment awaiting review — ${moduleName || "Assessment"}`,
        template: "assessment_submitted",
        templateData: { moduleName: moduleName || "Assessment", subjectName },
      });
    }
  } else if (["approved", "rejected", "published"].includes(newStatus)) {
    // Notify the assessment author (not self)
    const authorId = assessment.user_id;
    if (authorId && authorId !== currentUserId) {
      createRbacNotification({
        userId: authorId,
        orgId,
        notificationType: `assessment_${newStatus}`,
        title: `${moduleName || "Assessment"} ${newStatus}`,
        detail: subjectName ? `Subject: ${subjectName}` : undefined,
        link,
        metadata: { assessment_id: assessment.id, module: assessment.module },
      });

      sendEmail({
        user_ids: [authorId],
        subject: `Assessment ${newStatus} — ${moduleName || "Assessment"}`,
        template: "assessment_status",
        templateData: { moduleName: moduleName || "Assessment", subjectName, status: newStatus },
      });
    }
  }
}
