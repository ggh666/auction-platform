import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = resolve(import.meta.dirname, "..");

function readAdminFile(path: string): string {
  return readFileSync(resolve(adminRoot, path), "utf8");
}

describe("admin message center", () => {
  it("adds a message center navigation item and page for asset conversations", () => {
    const appLayout = readAdminFile("components/AppLayout.tsx");
    const app = readAdminFile("App.tsx");
    const page = readAdminFile("pages/MessageCenterPage.tsx");

    expect(appLayout).toContain("消息中心");
    expect(app).toContain("MessageCenterPage");
    expect(page).toContain("adminGet<AdminAssetConversationListResponse>");
    expect(page).toContain("adminPost<AssetConversationMessageResponse>");
    expect(page).toContain("connectAdminMessageSocket");
    expect(page).toContain("发送消息");
    expect(page).toContain("筛选主理人");
    expect(page).toContain("普通主理人账号只显示自己负责的会话");
  });
});
