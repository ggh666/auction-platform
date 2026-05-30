import { expect, test } from "@playwright/test";

test("admin login page renders", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "管理后台登录" })).toBeVisible();
  await expect(page.getByLabel("用户名")).toBeVisible();
  await expect(page.getByLabel("密码")).toBeVisible();
});
