import { Shield, ShieldCheck, Loader2 } from 'lucide-react';

const CATEGORY_ICONS = {
  data_broker_removal: '\u{1F5D1}',
  social_hardening: '\u{1F512}',
  routine_variation: '\u{1F500}',
  physical_security: '\u{1F6E1}',
  credential_hardening: '\u{1F511}',
  general: '\u{26E8}',
};

export default function CountermeasurePanel({
  countermeasures,
  onToggle,
  onSimulate,
  isSimulating,
}) {
  const enabledCount = countermeasures.filter(c => c.enabled).length;

  return (
    <div className="countermeasure-panel">
      <div className="countermeasure-header">
        <div className="countermeasure-title">
          <Shield size={16} style={{ color: '#09BC8A' }} />
          <span>SHIELD MODE</span>
        </div>
        <div className="countermeasure-count">
          {enabledCount} / {countermeasures.length} active
        </div>
      </div>

      <p className="countermeasure-description">
        Toggle protections to see how the threat scenario adapts when countermeasures are deployed.
      </p>

      <div className="countermeasure-list">
        {countermeasures.map(cm => (
          <div
            key={cm.id}
            className={`countermeasure-item ${cm.enabled ? 'active' : ''}`}
          >
            <button
              className="countermeasure-toggle"
              onClick={() => onToggle(cm.id)}
              aria-pressed={cm.enabled}
            >
              <span className="countermeasure-icon">
                {CATEGORY_ICONS[cm.category] || CATEGORY_ICONS.general}
              </span>
              <span className="countermeasure-label">{cm.label}</span>
              <span className={`countermeasure-switch ${cm.enabled ? 'on' : 'off'}`}>
                <span className="switch-thumb" />
              </span>
            </button>
            {cm.enabled && (
              <div className="countermeasure-detail">
                {cm.fullText}
              </div>
            )}
          </div>
        ))}
      </div>

      {enabledCount > 0 && (
        <button
          className="simulate-btn"
          onClick={onSimulate}
          disabled={isSimulating}
        >
          {isSimulating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Recalculating threat scenario...
            </>
          ) : (
            <>
              <ShieldCheck size={14} />
              Simulate with {enabledCount} countermeasure{enabledCount !== 1 ? 's' : ''}
            </>
          )}
        </button>
      )}
    </div>
  );
}
