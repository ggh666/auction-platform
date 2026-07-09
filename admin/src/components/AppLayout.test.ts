import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = resolve(import.meta.dirname, "..");

function readAdminFile(path: string): string {
  return readFileSync(resolve(adminRoot, path), "utf8");
}

describe("admin app layout navigation", () => {
  it("groups sidebar navigation and hides deal followups from the menu", () => {
    const layout = readAdminFile("components/AppLayout.tsx");

    expect(layout).toContain("navGroups");
    expect(layout).toContain('label: "用户管理"');
    expect(layout).toContain('label: "资产管理"');
    expect(layout).toContain('label: "配置管理"');
    expect(layout).toContain('label: "前台用户"');
    expect(layout).toContain('label: "后台用户"');
    expect(layout).toContain('label: "主理人管理"');
    expect(layout).toContain('label: "仪表盘"');
    expect(layout).toContain('label: "审核管理"');
    expect(layout).toContain('label: "发布资产"');
    expect(layout).toContain('label: "交换资源"');
    expect(layout).toContain('label: "主播推荐"');
    expect(layout).toContain('label: "主理人资源"');
    expect(layout).toContain('label: "估值参考"');
    expect(layout).toContain('label: "系统配置"');
    expect(layout).toContain('label: "消息中心"');
    expect(layout).toContain('className="nav-group-title"');
    expect(layout).toContain("className={`nav-standalone");
    expect(layout).not.toContain('label: "资产数据"');
    expect(layout).not.toContain('label: "价格参考"');
    expect(layout).not.toContain('label: "成交跟进"');
  });
});
