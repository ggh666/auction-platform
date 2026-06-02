import type { AdminRole } from "@auction/shared";

export type AdminPermission =
  | "admin:manage"
  | "asset:create"
  | "asset:view"
  | "asset:review"
  | "asset:remove"
  | "auction:confirm_deal"
  | "user:view"
  | "user:ban"
  | "report:review"
  | "violation:publish"
  | "config:manage";

const permissions: Record<AdminRole, AdminPermission[]> = {
  super_admin: [
    "admin:manage",
    "asset:create",
    "asset:view",
    "asset:review",
    "asset:remove",
    "auction:confirm_deal",
    "user:view",
    "user:ban",
    "report:review",
    "violation:publish",
    "config:manage"
  ],
  reviewer: ["asset:create", "asset:view", "asset:review", "auction:confirm_deal", "report:review", "violation:publish"],
  operator: ["asset:create", "asset:view", "asset:remove", "auction:confirm_deal"]
};

export function canAdmin(role: AdminRole, permission: AdminPermission): boolean {
  return permissions[role].includes(permission);
}
