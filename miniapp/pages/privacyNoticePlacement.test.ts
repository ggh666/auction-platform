import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readPage(path: string) {
  return readFileSync(resolve(import.meta.dirname, path), "utf8");
}

describe("miniapp privacy notices", () => {
  it("shows privacy notices before user information is submitted", () => {
    const loginPage = readPage("login/login.vue");
    const detailPage = readPage("auctions/detail.vue");
    const listPage = readPage("auctions/list.vue");

    expect(loginPage).toContain("隐私说明");
    expect(loginPage).toContain("昵称和头像");
    expect(loginPage.indexOf("隐私说明")).toBeLessThan(loginPage.indexOf("进入平台"));

    expect(detailPage).toContain("隐私说明");
    expect(detailPage).toContain("估价金额");
    expect(detailPage).toContain("不会展示手机号等无关个人信息");
    expect(detailPage.indexOf("隐私说明")).toBeLessThan(detailPage.indexOf("我要了"));

    expect(listPage).toContain("隐私说明：搜索词和筛选条件仅用于本次列表查询。");
    expect(listPage).not.toContain("关注操作仅用于生成个人关注记录，不会公开展示");
    expect(listPage.indexOf("隐私说明")).toBeGreaterThan(listPage.indexOf("submitSearch"));
  });
});
