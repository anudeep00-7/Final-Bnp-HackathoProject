import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import AdminLayout from "./layouts/AdminLayout";

import Dashboard from "./pages/admin/Dashboard";
import Portfolio from "./pages/admin/Portfolio";
import CorporateActions from "./pages/admin/CorporateActions";
import Elections from "./pages/admin/Elections";
import Reports from "./pages/admin/Reports";
import AuditsControls from "./pages/admin/AuditsControls";
import Reconciliation from "./pages/admin/Reconciliation";
import ImportDataset from "./pages/admin/ImportDataset";
import AdminProfile from "./pages/admin/AdminProfile";
import AIChat from "./pages/admin/AIChat";
function App() {
  return (
    <BrowserRouter>

      <Routes>

        <Route path="/admin" element={<AdminLayout />}>

          <Route
            index
            element={
              <Navigate
                to="/admin/dashboard"
                replace
              />
            }
          />

          <Route
            path="dashboard"
            element={<Dashboard />}
          />

          <Route
            path="portfolio"
            element={<Portfolio />}
          />

          <Route
            path="corporate-actions"
            element={<CorporateActions />}
          />

          <Route
            path="elections"
            element={<Elections />}
          />

          <Route
            path="reports"
            element={<Reports />}
          />

          <Route
            path="audits-controls"
            element={<AuditsControls />}
          />

          <Route
            path="reconciliation"
            element={<Reconciliation />}
          />

          <Route
            path="import-dataset"
            element={<ImportDataset />}
          />
          <Route
  path="ai-assistant"
  element={<AIChat />}
/>

        </Route>


        <Route
          path="*"
          element={
            <Navigate
              to="/admin/dashboard"
              replace
            />
          }
        />
        <Route
  path="profile"
  element={<AdminProfile />}
/>

      </Routes>
      

    </BrowserRouter>
  );
}

export default App;