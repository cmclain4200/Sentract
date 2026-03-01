export const REPORT_TEMPLATES = {
  full: {
    id: "full",
    label: "Full Report",
    description: "Complete intelligence report with all sections",
    pages: ["cover", "executive_summary", "subject_overview", "digital_exposure", "behavioral_analysis", "aegis_detail", "recon_mirror", "recommendations", "methodology"],
  },
  executive: {
    id: "executive",
    label: "Executive Brief",
    description: "Cover + executive summary + Aegis score + recommendations",
    pages: ["cover", "executive_summary", "aegis_detail", "recommendations"],
  },
  briefing: {
    id: "briefing",
    label: "Quick Briefing",
    description: "Cover + executive summary only",
    pages: ["cover", "executive_summary"],
  },
};
