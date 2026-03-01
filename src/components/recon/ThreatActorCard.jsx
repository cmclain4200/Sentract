import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { THREAT_ACTOR_PROFILES } from '../../data/threatActorProfiles';

export default function ThreatActorCard({ adversaryType, sophistication }) {
  const [expanded, setExpanded] = useState(false);

  const profile = THREAT_ACTOR_PROFILES[adversaryType]?.sophistication?.[sophistication];
  if (!profile) return null;

  return (
    <div className="threat-actor-card">
      <button
        className="threat-actor-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="threat-actor-header-left">
          <span className="threat-actor-type-label">THREAT PROFILE</span>
          <span className="threat-actor-type-name">
            {adversaryType} &middot; {sophistication} Sophistication
          </span>
        </div>
        <div className="threat-actor-header-right">
          <div className="threat-actor-quick-stats">
            <span className="quick-stat">
              <span className="quick-stat-label">Budget</span>
              <span className="quick-stat-value">{profile.budget}</span>
            </span>
            <span className="quick-stat">
              <span className="quick-stat-label">Timeline</span>
              <span className="quick-stat-value">{profile.timeline}</span>
            </span>
          </div>
          {expanded ? <ChevronUp size={16} color="#555" /> : <ChevronDown size={16} color="#555" />}
        </div>
      </button>

      {expanded && (
        <div className="threat-actor-body">
          <p className="threat-actor-description">{profile.description}</p>

          <div className="threat-actor-grid">
            <div className="threat-actor-section">
              <div className="threat-actor-section-title">COMMON TTPs</div>
              <ul className="threat-actor-list">
                {profile.ttps.map((ttp, i) => (
                  <li key={i}>{ttp}</li>
                ))}
              </ul>
            </div>

            <div className="threat-actor-section">
              <div className="threat-actor-section-title">TYPICAL TOOLS</div>
              <ul className="threat-actor-list">
                {profile.tools.map((tool, i) => (
                  <li key={i}>{tool}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="threat-actor-real-world">
            <div className="threat-actor-section-title">REAL-WORLD COMPARISON</div>
            <p>{profile.realWorld}</p>
          </div>
        </div>
      )}
    </div>
  );
}
