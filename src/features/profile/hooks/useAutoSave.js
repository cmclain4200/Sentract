import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { calculateCompleteness } from "../../../lib/profileCompleteness";
import { syncRelationships } from "../../../lib/relationshipSync";

export default function useAutoSave(subjectId, userId, showToast) {
  const [saveStatus, setSaveStatus] = useState("idle");
  const saveTimeout = useRef(null);
  const latestProfile = useRef(null);
  const prevSyncData = useRef(null);
  const snapshotSaved = useRef(false);

  // Keep ref in sync
  function updateRef(profile) {
    latestProfile.current = profile;
  }

  // Flush pending save on page unload or component unmount
  useEffect(() => {
    const flushSave = () => {
      if (saveTimeout.current && subjectId) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
        const comp = calculateCompleteness(latestProfile.current);
        supabase
          .from("subjects")
          .update({ profile_data: latestProfile.current, data_completeness: comp.score })
          .eq("id", subjectId)
          .then(() => {});
      }
    };
    const handleBeforeUnload = () => flushSave();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flushSave();
    };
  }, [subjectId]);

  const autoSave = useCallback(
    (data, subject) => {
      if (!subjectId) return;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      setSaveStatus("saving");
      saveTimeout.current = setTimeout(async () => {
        const comp = calculateCompleteness(data);
        const { error } = await supabase
          .from("subjects")
          .update({
            profile_data: data,
            data_completeness: comp.score,
          })
          .eq("id", subjectId);
        if (error) {
          setSaveStatus("error");
        } else {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);

          // Save profile snapshot (once per session) for anomaly detection
          if (!snapshotSaved.current && userId) {
            snapshotSaved.current = true;
            supabase.from("assessments").insert({
              subject_id: subjectId,
              user_id: userId,
              type: "profile_snapshot",
              module: "profile_snapshot",
              data: { profile_data: data },
            }).then(() => {});
          }

          // Check if network or professional fields changed — fire sync if so
          const syncKey = JSON.stringify({
            network: data.network,
            professional: data.professional,
            name: data.identity?.full_name,
          });
          if (prevSyncData.current !== syncKey) {
            prevSyncData.current = syncKey;
            if (userId) {
              syncRelationships({ ...(subject || {}), id: subjectId, profile_data: data }, userId).then((result) => {
                if (result.updated) showToast(result.details);
              });
            }
          }
        }
      }, 1500);
    },
    [subjectId, userId, showToast]
  );

  async function flushSave(profile, refreshSubject) {
    if (!subjectId) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    setSaveStatus("saving");
    const comp = calculateCompleteness(profile);
    const { error } = await supabase
      .from("subjects")
      .update({
        profile_data: profile,
        data_completeness: comp.score,
      })
      .eq("id", subjectId);
    if (error) {
      setSaveStatus("error");
    } else {
      setSaveStatus("saved");
      if (refreshSubject) refreshSubject();
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  }

  return { saveStatus, setSaveStatus, autoSave, flushSave, updateRef };
}
