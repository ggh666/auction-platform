import { useState } from "react";
import type { AdminAssetCopyDraft, AdminAssetCopyDraftResponse } from "@auction/shared";
import { adminGet } from "./api/client";
import { clearAdminToken, readAdminSession, readAdminToken, type AdminSession } from "./auth/session";
import { AppLayout } from "./components/AppLayout";
import { ChangePasswordDialog } from "./components/ChangePasswordDialog";
import { AdminUserManagementPage } from "./pages/AdminUserManagementPage";
import { AssetDataPage } from "./pages/AssetDataPage";
import { AssetDetailPage } from "./pages/AssetDetailPage";
import { AssetPublishPage } from "./pages/AssetPublishPage";
import { ConfigPage } from "./pages/ConfigPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DealFollowupPage } from "./pages/DealFollowupPage";
import { LoginPage } from "./pages/LoginPage";
import { PrincipalManagementPage } from "./pages/PrincipalManagementPage";
import { ReviewCenterPage } from "./pages/ReviewCenterPage";
import { UserManagementPage } from "./pages/UserManagementPage";

type PageKey =
  | "dashboard"
  | "reviews"
  | "assetData"
  | "assetPublish"
  | "dealFollowups"
  | "adminUsers"
  | "principals"
  | "users"
  | "configs";

function renderPage(
  page: PageKey,
  onOpenAsset: (assetId: string) => void,
  currentAdminId: string,
  copyDraft: AdminAssetCopyDraft | null,
  onCopyAsset: (assetId: string) => Promise<void>
) {
  switch (page) {
    case "reviews":
      return <ReviewCenterPage onOpenAsset={onOpenAsset} />;
    case "assetData":
      return <AssetDataPage onCopyAsset={onCopyAsset} onOpenAsset={onOpenAsset} />;
    case "assetPublish":
      return <AssetPublishPage copyDraft={copyDraft} onOpenAsset={onOpenAsset} />;
    case "dealFollowups":
      return <DealFollowupPage onOpenAsset={onOpenAsset} />;
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
  const [assetPublishDraft, setAssetPublishDraft] = useState<AdminAssetCopyDraft | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [loginNotice, setLoginNotice] = useState("");

  function logout() {
    clearAdminToken();
    setLoggedIn(false);
    setAdmin(null);
    setPage("dashboard");
    setDetailAssetId(null);
    setAssetPublishDraft(null);
    setPasswordDialogOpen(false);
  }

  function handlePasswordChanged() {
    logout();
    setLoginNotice("密码已修改，请使用新密码重新登录。");
  }

  async function copyAssetToPublish(assetId: string) {
    const response = await adminGet<AdminAssetCopyDraftResponse>(`/admin/assets/${assetId}/copy-draft`);
    setDetailAssetId(null);
    setAssetPublishDraft(response.draft);
    setPage("assetPublish");
  }

  if (!loggedIn || !admin) {
    return (
      <LoginPage
        notice={loginNotice}
        onLoggedIn={(nextAdmin) => {
          setLoginNotice("");
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
      username={admin.username}
      onNavigate={(nextPage) => {
        setDetailAssetId(null);
        setAssetPublishDraft(null);
        setPage(nextPage as PageKey);
      }}
      onChangePassword={() => setPasswordDialogOpen(true)}
      onLogout={logout}
    >
      {detailAssetId ? (
        <AssetDetailPage assetId={detailAssetId} onBack={() => setDetailAssetId(null)} />
      ) : (
        renderPage(page, setDetailAssetId, admin.id, assetPublishDraft, copyAssetToPublish)
      )}
      {passwordDialogOpen ? (
        <ChangePasswordDialog onChanged={handlePasswordChanged} onClose={() => setPasswordDialogOpen(false)} />
      ) : null}
    </AppLayout>
  );
}
