import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import SectionHeader from "./common/SectionHeader";

export default function ModuleWrapper({ label, title, profileData, minCompleteness, completeness, children }) {
  if (completeness < minCompleteness) {
    return (
      <div className="h-full flex flex-col" style={{ padding: "32px" }}>
        <SectionHeader label={label} title={title} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <ShieldAlert size={44} className="mx-auto mb-5" style={{ color: '#333' }} />
            <h3 className="text-[20px] font-semibold text-white mb-3">More data needed</h3>
            <p className="text-[15px]" style={{ color: '#888' }}>
              This module requires at least {minCompleteness}% profile completeness to generate
              meaningful results. Your profile is currently at {completeness}%.
            </p>
            <p className="text-[15px] mt-3" style={{ color: '#555' }}>
              Adding more data points — especially {suggestMissingData(profileData)} — will unlock this analysis.
            </p>
            <Link
              to="../profile"
              className="inline-flex items-center mt-6 rounded-md no-underline text-[15px] font-semibold"
              style={{ background: '#09BC8A', color: '#0a0a0a', padding: '12px 28px', minHeight: 44 }}
            >
              Complete Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ padding: "32px" }}>
      <SectionHeader label={label} title={title} />
      {children}
    </div>
  );
}

function suggestMissingData(profileData) {
  if (!profileData) return 'identity information, social accounts, and breach records';
  const suggestions = [];
  if (!profileData.digital?.social_accounts?.length) suggestions.push('social media accounts');
  if (!profileData.breaches?.records?.length) suggestions.push('breach records');
  if (!profileData.behavioral?.routines?.length) suggestions.push('behavioral patterns');
  if (!profileData.locations?.addresses?.length) suggestions.push('known addresses');
  if (!profileData.network?.family_members?.length) suggestions.push('family details');
  return suggestions.slice(0, 3).join(', ') || 'additional profile data';
}
