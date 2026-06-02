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

const navItems = [
  { key: "dashboard", label: "仪表盘", roles: ["super_admin", "reviewer", "operator"] },
  { key: "reviews", label: "审核管理", roles: ["super_admin", "reviewer"] },
  { key: "assetData", label: "资产数据", roles: ["super_admin", "reviewer", "operator"] },
  { key: "assetPublish", label: "发布资产", roles: ["super_admin", "reviewer", "operator"] },
  { key: "dealFollowups", label: "成交跟进", roles: ["super_admin", "reviewer", "operator"] },
  { key: "adminUsers", label: "后台用户", roles: ["super_admin"] },
  { key: "principals", label: "主理人管理", roles: ["super_admin"] },
  { key: "users", label: "前台用户", roles: ["super_admin"] },
  { key: "configs", label: "系统配置", roles: ["super_admin"] }
];

const roleLabels: Record<AdminRole, string> = {
  super_admin: "超级管理员",
  reviewer: "审核员",
  operator: "运营"
};

export function AppLayout({ active, role, username, onNavigate, onChangePassword, onLogout, children }: AppLayoutProps) {
  const visibleNavItems = navItems.filter((item) => item.roles.includes(role));
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
          {visibleNavItems.map((item) => (
            <button
              className={active === item.key ? "active" : ""}
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
