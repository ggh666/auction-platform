import type { ReactNode } from "react";
import type { AdminRole } from "@auction/shared";

type AppLayoutProps = {
  active: string;
  role: AdminRole;
  username: string;
  onNavigate: (page: string) => void;
  onChangePassword: () => void;
  onLogout: () => void;
  children: ReactNode;
};

type NavItem = {
  key: string;
  label: string;
  roles: AdminRole[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "用户管理",
    items: [
      { key: "users", label: "前台用户", roles: ["super_admin"] },
      { key: "adminUsers", label: "后台用户", roles: ["super_admin"] },
      { key: "principals", label: "主理人管理", roles: ["super_admin"] }
    ]
  },
  {
    label: "资产管理",
    items: [
      { key: "reviews", label: "审核管理", roles: ["super_admin", "reviewer"] },
      { key: "assetPublish", label: "发布资产", roles: ["super_admin", "reviewer", "operator"] },
      { key: "exchangeResources", label: "交换资源", roles: ["super_admin", "reviewer", "operator"] },
      { key: "anchorRecommendations", label: "主播推荐", roles: ["super_admin", "reviewer", "operator"] },
      { key: "assetData", label: "主理人资源", roles: ["super_admin", "reviewer", "operator"] }
    ]
  },
  {
    label: "配置管理",
    items: [
      { key: "priceReferences", label: "估值参考", roles: ["super_admin", "reviewer", "operator"] },
      { key: "redeemCodes", label: "兑换码设置", roles: ["super_admin", "reviewer", "operator"] },
      { key: "skyTower", label: "天空塔设置", roles: ["super_admin", "reviewer", "operator"] },
      { key: "configs", label: "系统配置", roles: ["super_admin"] }
    ]
  }
];

const standaloneNavItems: NavItem[] = [
  { key: "dashboard", label: "仪表盘", roles: ["super_admin", "reviewer", "operator"] },
  { key: "messages", label: "消息中心", roles: ["super_admin", "reviewer", "operator"] }
];

const roleLabels: Record<AdminRole, string> = {
  super_admin: "超级管理员",
  reviewer: "审核员",
  operator: "运营"
};

export function AppLayout({ active, role, username, onNavigate, onChangePassword, onLogout, children }: AppLayoutProps) {
  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(role))
    }))
    .filter((group) => group.items.length > 0);
  const visibleStandaloneNavItems = standaloneNavItems.filter((item) => item.roles.includes(role));
  const visibleNavItems = [...visibleNavGroups.flatMap((group) => group.items), ...visibleStandaloneNavItems];
  const current = visibleNavItems.find((item) => item.key === active);
  const initial = username.trim().slice(0, 1).toUpperCase() || "管";

  return (
    <div className="admin-shell">
      <aside className="sidebar" aria-label="后台导航">
        <div className="brand">
          <span className="brand-mark">拍</span>
          <div>
            <h1>交换后台</h1>
            <p>游戏资产运营管理</p>
          </div>
        </div>
        <nav className="nav-list">
          {visibleNavGroups.map((group) => (
            <section className="nav-group" key={group.label}>
              <p className="nav-group-title">{group.label}</p>
              <div className="nav-group-items">
                {group.items.map((item) => (
                  <button
                    className={active === item.key ? "active" : ""}
                    key={item.key}
                    onClick={() => onNavigate(item.key)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>
          ))}
          {visibleStandaloneNavItems.map((item) => (
            <button
              className={`nav-standalone ${active === item.key ? "active" : ""}`}
              key={item.key}
              onClick={() => onNavigate(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">运营控制台</p>
            <h2>{current?.label ?? "仪表盘"}</h2>
          </div>
          <div className="topbar-actions">
            <div className="admin-identity" aria-label={`当前登录人 ${username}`}>
              <span className="admin-avatar">{initial}</span>
              <div>
                <strong>{username}</strong>
                <span>{roleLabels[role]}</span>
              </div>
            </div>
            <button className="ghost-button compact-button" onClick={onChangePassword} type="button">
              修改密码
            </button>
            <button className="ghost-button" onClick={onLogout} type="button">
              退出登录
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
