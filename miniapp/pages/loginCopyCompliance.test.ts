import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginPagePath = resolve(import.meta.dirname, "login/login.vue");

describe("login page copy compliance", () => {
  it("does not display wording that can be confused with official platform login", () => {
    const loginPage = readFileSync(loginPagePath, "utf8");
    const template = loginPage.slice(loginPage.indexOf("<template>"), loginPage.indexOf("</template>"));

    expect(template).not.toContain("微信");
    expect(template).not.toContain("授权登录");
    expect(template).not.toContain("快捷登录");
    expect(template).not.toContain("官方");
    expect(loginPage).toContain("进入平台");
    expect(loginPage).toContain('open-type="chooseAvatar"');
    expect(loginPage).toContain('type="nickname"');
    expect(loginPage).toContain("点击选择昵称");
    expect(loginPage).toContain("重新选择");
    expect(loginPage).toContain("nicknameLocked");
    expect(loginPage).toContain("nickname-native-input");
    expect(loginPage).toContain("nickname-selector");
    expect(loginPage).toContain("nickname-display");
    expect(loginPage).not.toContain("getUserProfile");
    expect(loginPage).not.toContain("profileRawData");
    expect(loginPage).not.toContain("profileSignature");
    expect(loginPage).toContain("locked-profile");
  });
});
