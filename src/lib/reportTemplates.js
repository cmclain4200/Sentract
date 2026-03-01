export const REPORT_TEMPLATES = {
  full: {
    id: "full",
    label: "Full Report",
    description: "Complete intelligence report with all sections",
    pages: ["cover", "executive_summary", "subject_overview", "digital_exposure", "behavioral_analysis", "aegis_detail", "recon_mirror", "recommendations", "methodology"],
  },
  security_team: {
    id: "security_team",
    label: "Security Team Report",
    description: "Full technical detail with pattern analysis and cross-case connections",
    pages: ["cover", "executive_summary", "subject_overview", "digital_exposure", "behavioral_analysis", "pattern_analysis", "crosswire_summary", "aegis_detail", "recon_mirror", "recommendations", "methodology"],
  },
  executive: {
    id: "executive",
    label: "Executive Brief",
    description: "Cover + executive summary + Aegis score + recommendations",
    pages: ["cover", "executive_summary", "aegis_detail", "recommendations"],
  },
  client_briefing: {
    id: "client_briefing",
    label: "Client Briefing",
    description: "Action-oriented summary for non-technical stakeholders",
    pages: ["cover", "executive_summary", "recommendations"],
  },
  briefing: {
    id: "briefing",
    label: "Quick Briefing",
    description: "Cover + executive summary only",
    pages: ["cover", "executive_summary"],
  },
};
