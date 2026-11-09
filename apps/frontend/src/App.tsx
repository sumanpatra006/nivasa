import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout.js';
import { ResidentLayout } from './layouts/ResidentLayout.js';
import { StaffLayout } from './layouts/StaffLayout.js';

import { LoginPage } from './pages/LoginPage.js';
import { ResidentHomePage } from './pages/ResidentHomePage.js';
import { MaintenancePage } from './pages/MaintenancePage.js';
import { ResidentComplaintsPage } from './pages/ResidentComplaintsPage.js';
import { StaffOverviewPage } from './pages/StaffOverviewPage.js';
import { StaffComplaintsPage } from './pages/StaffComplaintsPage.js';
import { StaffReconciliationPage } from './pages/StaffReconciliationPage.js';
import { CommitteeDashboardPage } from './pages/CommitteeDashboardPage.js';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Core Layout with Shared Top Context Bar */}
        <Route element={<RootLayout />}>
          <Route path="/" element={<Navigate to="/resident" replace />} />

          {/* Resident Experience (Mobile-First) */}
          <Route path="/resident" element={<ResidentLayout />}>
            <Route index element={<ResidentHomePage />} />
            <Route path="maintenance" element={<MaintenancePage />} />
            <Route path="complaints" element={<ResidentComplaintsPage />} />
          </Route>

          {/* Staff Experience (Operational Clarity) */}
          <Route path="/staff" element={<StaffLayout />}>
            <Route index element={<StaffOverviewPage />} />
            <Route path="complaints" element={<StaffComplaintsPage />} />
            <Route path="reconciliation" element={<StaffReconciliationPage />} />
          </Route>

          {/* Committee Dashboard (Trustworthy Numbers) */}
          <Route path="/committee" element={<CommitteeDashboardPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/resident" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
