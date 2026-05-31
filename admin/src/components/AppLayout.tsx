import type { ReactNode } from "react";
import type { AdminRole } from "@auction/shared";

type AppLayoutProps = {
  active: string;
  role: AdminRole;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  children: ReactNode;
};

const navItems = [
  { key: "dashboard", label: "仪表盘", roles: ["super_admin", "reviewer", "operator"] },
  { key: "reviews", label: "审核管理", roles: ["super_admin", "reviewer"] },
  { key: "assetData", label: "资产数据", roles: ["super_admin", "reviewer", "operator"] },
  { key: "dealFollowups", label: "成交跟进", roles: ["super_admin", "reviewer", "operator"] },
  { key: "adminUsers", label: "后台用户", roles: ["super_admin"] },
  { key: "principals", label: "主理人管理", roles: ["super_admin"] },
  { key: "users", label: "前台用户", roles: ["super_admin"] },
  { key: "configs", label: "系统配置", roles: ["super_admin"] }
];

export function AppLayout({ active, role, onNavigate, onLogout, children }: AppLayoutProps) {
  const visibleNavItems = navItems.filter((item) => item.roles.includes(role));
  const current = visibleNavItems.find((item) => item.key === active);

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
          <button className="ghost-button" onClick={onLogout} type="button">
            退出登录
          </button>
        </header>
        {children}
      </main>
    </div>
  );
}
