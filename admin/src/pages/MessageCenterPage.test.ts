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
    expect(page).toContain("formatMessageTime(message.createdAt)");
    expect(page).toContain("className=\"message-time\"");
    expect(page).toContain("dateTime={message.createdAt}");
    expect(page).toContain("发送时间");
    expect(page).toContain("筛选主理人");
    expect(page).not.toContain("普通主理人账号只显示自己负责的会话，超级管理员可筛选主理人。");
  });

  it("keeps one realtime socket open while the selected conversation changes", () => {
    const page = readAdminFile("pages/MessageCenterPage.tsx");

    expect(page).toContain("useRef");
    expect(page).toContain("selectedIdRef");
    expect(page).toContain("selectedIdRef.current = selectedId");
    expect(page).toContain("principalIdRef.current = principalId");
    expect(page).toContain("scheduleReconnect");
    expect(page).toContain("if (!active || reconnectTimer !== null)");
    expect(page).toContain("event.conversationId === selectedIdRef.current");
  });
});
