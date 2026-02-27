import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="h-full flex items-center justify-center" style={{ background: "#0a0a0a" }}>
      <div className="text-center">
        <div className="text-[60px] font-bold" style={{ color: "#1e1e1e" }}>404</div>
        <div className="text-white text-lg font-semibold mb-2">Page not found</div>
        <div className="text-sm mb-6" style={{ color: "#555" }}>
          The page you're looking for doesn't exist.
        </div>
        <Link
          to="/dashboard"
          className="px-5 py-2.5 rounded-md text-sm font-semibold no-underline"
          style={{ background: "#00d4aa", color: "#0a0a0a" }}
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
