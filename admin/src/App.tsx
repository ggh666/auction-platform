import { useState } from "react";
import { clearAdminToken, readAdminSession, readAdminToken, type AdminSession } from "./auth/session";
import { AppLayout } from "./components/AppLayout";
import { AdminUserManagementPage } from "./pages/AdminUserManagementPage";
import { AssetDataPage } from "./pages/AssetDataPage";
import { AssetDetailPage } from "./pages/AssetDetailPage";
import { ConfigPage } from "./pages/ConfigPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { PrincipalManagementPage } from "./pages/PrincipalManagementPage";
import { ReviewCenterPage } from "./pages/ReviewCenterPage";
import { UserManagementPage } from "./pages/UserManagementPage";

type PageKey = "dashboard" | "reviews" | "assetData" | "adminUsers" | "principals" | "users" | "configs";

function renderPage(page: PageKey, onOpenAsset: (assetId: string) => void, currentAdminId: string) {
  switch (page) {
    case "reviews":
      return <ReviewCenterPage onOpenAsset={onOpenAsset} />;
    case "assetData":
      return <AssetDataPage onOpenAsset={onOpenAsset} />;
    case "adminUsers":
      return <AdminUserManagementPage currentAdminId={currentAdminId} />;
    case "users":
      return <UserManagementPage />;
    case "principals":
      return <PrincipalManagementPage />;
    case "configs":
      return <ConfigPage />;
    case "dashboard":
    default:
      return <DashboardPage onOpenAsset={onOpenAsset} />;
  }
}

export function App() {
  const [loggedIn, setLoggedIn] = useState(() => readAdminToken() !== null);
  const [admin, setAdmin] = useState<AdminSession | null>(() => readAdminSession());
  const [page, setPage] = useState<PageKey>("dashboard");
  const [detailAssetId, setDetailAssetId] = useState<string | null>(null);

  function logout() {
    clearAdminToken();
    setLoggedIn(false);
    setAdmin(null);
    setPage("dashboard");
    setDetailAssetId(null);
  }

  if (!loggedIn || !admin) {
    return (
      <LoginPage
        onLoggedIn={(nextAdmin) => {
          setAdmin(nextAdmin);
          setLoggedIn(true);
        }}
      />
    );
  }

  return (
    <AppLayout
      active={page}
      role={admin.role}
      onNavigate={(nextPage) => {
        setDetailAssetId(null);
        setPage(nextPage as PageKey);
      }}
      onLogout={logout}
    >
      {detailAssetId ? (
        <AssetDetailPage assetId={detailAssetId} onBack={() => setDetailAssetId(null)} />
      ) : (
        renderPage(page, setDetailAssetId, admin.id)
      )}
    </AppLayout>
  );
}
