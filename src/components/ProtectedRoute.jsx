import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useOrg } from "../contexts/OrgContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { loading: orgLoading } = useOrg();

  if (loading || orgLoading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <div className="flex items-center gap-2">
          <span className="pulse-dot" />
          <span className="pulse-dot" />
          <span className="pulse-dot" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
