const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 24 }, (_, i) => i);

export function buildHeatmapFromRoutines(routines) {
  const d = {};
  days.forEach((day) => { d[day] = {}; hours.forEach((h) => { d[day][h] = { intensity: 0, activities: [] }; }); });

  routines.forEach((r) => {
    const schedule = (r.schedule || "").toLowerCase();
    const consistency = r.consistency || 0.5;

    // Parse day ranges
    let activeDays = [];
    if (schedule.includes("mon") && schedule.includes("fri")) activeDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    else if (schedule.includes("daily") || schedule.includes("every day")) activeDays = days;
    else if (schedule.includes("weekend") || schedule.includes("sat")) activeDays = ["Sat", "Sun"];
    else {
      days.forEach((day) => { if (schedule.includes(day.toLowerCase())) activeDays.push(day); });
    }
    if (activeDays.length === 0) activeDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];

    // Parse time
    let hour = -1;
    const timeMatch = schedule.match(/(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)/i);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      const ampm = timeMatch[3].toLowerCase();
      if (ampm === "pm" && hour < 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
    } else {
      const h24Match = schedule.match(/(\d{1,2}):(\d{2})/);
      if (h24Match) hour = parseInt(h24Match[1], 10);
    }
    if (hour === -1) {
      if (schedule.includes("morning") || schedule.includes("am")) hour = 7;
      else if (schedule.includes("evening") || schedule.includes("pm")) hour = 18;
      else if (schedule.includes("lunch") || schedule.includes("noon")) hour = 12;
      else hour = 9;
    }

    activeDays.forEach((day) => {
      // Fill the hour and adjacent hours
      for (let offset = -1; offset <= 1; offset++) {
        const h = hour + offset;
        if (h < 0 || h > 23) continue;
        const existing = d[day][h];
        const addIntensity = offset === 0 ? consistency : consistency * 0.4;
        existing.intensity = Math.min(1, existing.intensity + addIntensity);
        if (offset === 0) existing.activities.push(r.name || "Activity");
      }
    });
  });

  return d;
}
