import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { MarketsListPage } from "./pages/MarketsListPage";
import { UploadPage } from "./pages/UploadPage";
import { MarketSetupPage } from "./pages/MarketSetupPage";
import { MarketDashboardPage } from "./pages/MarketDashboardPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<MarketsListPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/markets/new" element={<MarketSetupPage />} />
        <Route path="/markets/:id" element={<MarketDashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
