import { useState, useMemo } from 'react';

/**
 * Renders narrative text with interactive source-link annotations.
 * Phrases from sourceLinks are wrapped in hoverable/clickable spans
 * that show the underlying data point in a tooltip.
 */
export default function SourceLinkedNarrative({
  text,
  sourceLinks = [],
  currentPhase = null,
  onSourceClick = null,
}) {
  const [activeLink, setActiveLink] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Filter links to current phase if specified
  const relevantLinks = useMemo(() => {
    if (currentPhase === null) return sourceLinks;
    return sourceLinks.filter(l => l.phaseIndex === currentPhase);
  }, [sourceLinks, currentPhase]);

  // Build annotated text by finding and wrapping source phrases
  const annotatedContent = useMemo(() => {
    if (!text || relevantLinks.length === 0) {
      return <span>{text}</span>;
    }

    // Find all link positions in the text, sorted by index, longer phrases first to avoid partials
    const sortedLinks = [...relevantLinks]
      .map(link => {
        const idx = text.toLowerCase().indexOf(link.phrase.toLowerCase());
        return { ...link, index: idx };
      })
      .filter(link => link.index !== -1)
      .sort((a, b) => a.index - b.index || b.phrase.length - a.phrase.length);

    if (sortedLinks.length === 0) {
      return <span>{text}</span>;
    }

    const fragments = [];
    let lastIndex = 0;
    const usedRanges = [];

    for (const link of sortedLinks) {
      const searchFrom = Math.max(lastIndex, 0);
      const start = text.toLowerCase().indexOf(link.phrase.toLowerCase(), searchFrom === 0 ? 0 : searchFrom);
      if (start === -1) continue;

      const end = start + link.phrase.length;

      // Check for overlap with already-used ranges
      const overlaps = usedRanges.some(
        ([s, e]) => (start >= s && start < e) || (end > s && end <= e)
      );
      if (overlaps) continue;

      // Add plain text before this link
      if (start > lastIndex) {
        fragments.push(
          <span key={`text-${lastIndex}`}>{text.slice(lastIndex, start)}</span>
        );
      }

      // Add the source-linked phrase
      const linkId = `${link.profileSection}-${link.profileField}-${start}`;
      fragments.push(
        <SourcePhrase
          key={`link-${linkId}`}
          link={link}
          text={text.slice(start, end)}
          onHover={(link, pos) => { setActiveLink(link); setTooltipPos(pos); }}
          onLeave={() => setActiveLink(null)}
          onClick={onSourceClick}
        />
      );

      usedRanges.push([start, end]);
      lastIndex = end;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      fragments.push(
        <span key="text-end">{text.slice(lastIndex)}</span>
      );
    }

    return <>{fragments}</>;
  }, [text, relevantLinks, onSourceClick]);

  return (
    <div className="source-linked-narrative">
      <div className="narrative-text-body">
        {annotatedContent}
      </div>

      {activeLink && (
        <SourceTooltip
          link={activeLink}
          position={tooltipPos}
        />
      )}
    </div>
  );
}

function SourcePhrase({ link, text, onHover, onLeave, onClick }) {
  return (
    <span
      className="source-link-phrase"
      onMouseEnter={(e) => {
        const rect = e.target.getBoundingClientRect();
        onHover(link, {
          x: rect.left + rect.width / 2,
          y: rect.top - 8,
        });
      }}
      onMouseLeave={onLeave}
      onClick={() => onClick?.(link)}
      data-section={link.profileSection}
    >
      {text}
    </span>
  );
}

function SourceTooltip({ link, position }) {
  const SECTION_ICONS = {
    locations: '\u{1F4CD}',
    behavioral: '\u{1F504}',
    breaches: '\u{1F513}',
    digital: '\u{1F310}',
    network: '\u{1F465}',
    professional: '\u{1F4BC}',
    identity: '\u{1F464}',
    contact: '\u{1F4F1}',
    public_records: '\u{1F4C4}',
  };

  const icon = SECTION_ICONS[link.profileSection] || '\u{1F4CB}';
  const sectionName = (link.profileSection || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div
      className="source-tooltip"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%)',
        zIndex: 1000,
      }}
    >
      <div className="source-tooltip-section">
        {icon} {sectionName}
      </div>
      <div className="source-tooltip-value">
        {link.dataValue}
      </div>
      <div className="source-tooltip-source">
        Source: {link.source}
      </div>
      <div className="source-tooltip-arrow" />
    </div>
  );
}
