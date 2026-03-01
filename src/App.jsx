import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { OrgProvider } from "./contexts/OrgContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { createSentractEngine, EngineProvider } from "./engine";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import CaseView from "./pages/CaseView";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import ConfirmEmail from "./pages/ConfirmEmail";
import Settings from "./pages/Settings";
import TeamManagement from "./pages/TeamManagement";
import Profile from "./features/Profile";
import ReconMirror from "./features/ReconMirror";
import AegisScore from "./features/AegisScore";
import PatternLens from "./features/PatternLens";
import CrossWire from "./features/CrossWire";
import Timeline from "./features/Timeline";
import InvestigationGraph from "./features/graph/InvestigationGraph";

const engine = createSentractEngine();

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OrgProvider>
        <NotificationProvider>
        <EngineProvider value={engine}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/confirm-email" element={<ConfirmEmail />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/team" element={<TeamManagement />} />
            <Route path="/case/:caseId" element={<CaseView />}>
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="recon" element={<ReconMirror />} />
              <Route path="aegis" element={<AegisScore />} />
              <Route path="patterns" element={<PatternLens />} />
              <Route path="crosswire" element={<CrossWire />} />
              <Route path="timeline" element={<Timeline />} />
              <Route path="graph" element={<InvestigationGraph />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </EngineProvider>
        </NotificationProvider>
        </OrgProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
