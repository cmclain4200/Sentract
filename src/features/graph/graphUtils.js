export function buildGraphData(currentSubject, allSubjects, overlaps) {
  const nodes = [];
  const links = [];
  const nodeSet = new Set();

  // Add current subject as primary node
  if (currentSubject) {
    nodes.push({
      id: currentSubject.id,
      name: currentSubject.name,
      caseType: currentSubject.cases?.type || "EP",
      aegisScore: currentSubject.profile_data?.aegisScore || 0,
      isCurrent: true,
    });
    nodeSet.add(currentSubject.id);
  }

  // Add connected subjects from overlaps
  for (const overlap of overlaps) {
    const otherId = overlap.subject.id;
    if (!nodeSet.has(otherId)) {
      nodes.push({
        id: otherId,
        name: overlap.subject.name,
        caseType: overlap.subject.cases?.type || "EP",
        aegisScore: 0,
        isCurrent: false,
      });
      nodeSet.add(otherId);
    }

    // Deduplicate links
    const existingLink = links.find(
      (l) => (l.source === currentSubject?.id && l.target === otherId) ||
             (l.source === otherId && l.target === currentSubject?.id)
    );

    if (existingLink) {
      existingLink.matchCount += overlap.matches.length;
      existingLink.types = [...new Set([...existingLink.types, ...overlap.matches.map((m) => m.type)])];
    } else {
      links.push({
        source: currentSubject?.id,
        target: otherId,
        matchCount: overlap.matches.length,
        types: overlap.matches.map((m) => m.type),
        label: overlap.matches[0]?.label || "",
      });
    }
  }

  return { nodes, links };
}
