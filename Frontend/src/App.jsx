import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Public / Landing Page
import LandingPage from "./pages/public/LandingPage";

// Analyst Pages
import AnalystDashboard from "./pages/analyst/AnalystDashboard";
import MyPortfolios from "./pages/analyst/MyPortfolios";
import AnalystCorporateActions from "./pages/analyst/CorporateActions";
import ImpactAnalysis from "./pages/analyst/ImpactAnalysis";
import AnalystElections from "./pages/analyst/Elections";
import AnalystSettlements from "./pages/analyst/Settlements";
import AnalystReports from "./pages/analyst/Reports";
import AnalystAuditHistory from "./pages/analyst/AuditHistory";
import AIAssistantPage from "./pages/analyst/AIAssistantPage";
import Settings from "./pages/analyst/Settings";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCorporateActions from "./pages/admin/AdminCorporateActions";
import AdminReconciliation from "./pages/admin/AdminReconciliation";
import AdminAuditsControls from "./pages/admin/AdminAuditsControls";
import AdminElections from "./pages/admin/AdminElections";
import AdminReports from "./pages/admin/AdminReports";
import AdminPortfolios from "./pages/admin/AdminPortfolios";
import AdminImportDataset from "./pages/admin/AdminImportDataset";
import AdminProfile from "./pages/admin/AdminProfile";
import AdminAIChat from "./pages/admin/AdminAIChat";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* LANDING PAGE (Public root) */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<LandingPage />} />

        {/* ANALYST WORKSPACE ROUTES */}
        <Route path="/analyst" element={<AnalystDashboard />} />
        <Route path="/analyst/dashboard" element={<AnalystDashboard />} />
        <Route path="/analyst/portfolios" element={<MyPortfolios />} />
        <Route path="/analyst/actions" element={<AnalystCorporateActions />} />
        <Route path="/analyst/impact" element={<ImpactAnalysis />} />
        <Route path="/analyst/elections" element={<AnalystElections />} />
        <Route path="/analyst/settlements" element={<AnalystSettlements />} />
        <Route path="/analyst/reports" element={<AnalystReports />} />
        <Route path="/analyst/audit" element={<AnalystAuditHistory />} />
        <Route path="/analyst/ai" element={<AIAssistantPage />} />
        <Route path="/analyst/settings" element={<Settings />} />

        {/* ADMIN WORKSPACE ROUTES */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/portfolio" element={<AdminPortfolios />} />
        <Route path="/admin/portfolios" element={<AdminPortfolios />} />
        <Route path="/admin/corporate-actions" element={<AdminCorporateActions />} />
        <Route path="/admin/actions" element={<AdminCorporateActions />} />
        <Route path="/admin/elections" element={<AdminElections />} />
        <Route path="/admin/reconciliation" element={<AdminReconciliation />} />
        <Route path="/admin/audits-controls" element={<AdminAuditsControls />} />
        <Route path="/admin/audit" element={<AdminAuditsControls />} />
        <Route path="/admin/reports" element={<AdminReports />} />
        <Route path="/admin/import-dataset" element={<AdminImportDataset />} />
        <Route path="/admin/ai-assistant" element={<AdminAIChat />} />
        <Route path="/admin/profile" element={<AdminProfile />} />

        {/* FALLBACK REDIRECT */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;