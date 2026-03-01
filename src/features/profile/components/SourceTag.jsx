export default function SourceTag({ source }) {
  if (!source) return null;
  return <span className="source-tag">{source}</span>;
}
