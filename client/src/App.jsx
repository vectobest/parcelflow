import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './state/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import IntakePage from './pages/IntakePage.jsx';
import ApprovalsPage from './pages/ApprovalsPage.jsx';
import PolicyManagerPage from './pages/PolicyManagerPage.jsx';
import SimulatorPage from './pages/SimulatorPage.jsx';
import ReplayPage from './pages/ReplayPage.jsx';
import RiskPage from './pages/RiskPage.jsx';
import IncidentsPage from './pages/IncidentsPage.jsx';
import DigitalTwinPage from './pages/DigitalTwinPage.jsx';
import AssistantPage from './pages/AssistantPage.jsx';
import AuditPage from './pages/AuditPage.jsx';
import SecurityCenterPage from './pages/SecurityCenterPage.jsx';
import AccessControlPage from './pages/AccessControlPage.jsx';
import SystemHealthPage from './pages/SystemHealthPage.jsx';

export default function App() {
  const { identity, loading, oauthEnabled } = useAuth();

  if (loading) return <div className="login-shell"><p className="muted">Loading ParcelFlow...</p></div>;
  if (!identity) {
    // Real OAuth is configured -- a human actually has to pick an account, so show the login page.
    if (oauthEnabled) return <LoginPage />;
    // No auth configured -- auto sign-in should have handled this; AuthContext retries
    // silently on failure, so show a quiet holding state instead of a dead-end login form.
    return <div className="login-shell"><p className="muted">Signing in...</p></div>;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/intake" element={<IntakePage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/policy" element={<PolicyManagerPage />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        <Route path="/replay" element={<ReplayPage />} />
        <Route path="/risk" element={<RiskPage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="/digital-twin" element={<DigitalTwinPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/security" element={<SecurityCenterPage />} />
        <Route path="/access" element={<AccessControlPage />} />
        <Route path="/history" element={<SystemHealthPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
