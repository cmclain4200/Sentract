import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="h-full flex items-center justify-center" style={{ background: "#0a0a0a" }}>
      <div className="text-center">
        <div className="text-[60px] font-bold" style={{ color: "#1e1e1e" }}>404</div>
        <div className="text-white text-[20px] font-semibold mb-3">Page not found</div>
        <div className="text-[15px] mb-8" style={{ color: "#555" }}>
          The page you're looking for doesn't exist.
        </div>
        <Link
          to="/dashboard"
          className="rounded-md text-[15px] font-semibold no-underline inline-flex items-center"
          style={{ background: "#09BC8A", color: "#0a0a0a", padding: "12px 28px", minHeight: 44 }}
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
