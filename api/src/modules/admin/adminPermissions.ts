import type { AdminRole } from "@auction/shared";

export type AdminPermission =
  | "admin:manage"
  | "asset:view"
  | "asset:review"
  | "asset:remove"
  | "auction:cancel"
  | "user:view"
  | "user:ban"
  | "report:review"
  | "violation:publish"
  | "config:manage";

const permissions: Record<AdminRole, AdminPermission[]> = {
  super_admin: [
    "admin:manage",
    "asset:view",
    "asset:review",
    "asset:remove",
    "auction:cancel",
    "user:view",
    "user:ban",
    "report:review",
    "violation:publish",
    "config:manage"
  ],
  reviewer: ["asset:view", "asset:review", "report:review", "violation:publish"],
  operator: ["asset:view", "asset:remove", "auction:cancel"]
};

export function canAdmin(role: AdminRole, permission: AdminPermission): boolean {
  return permissions[role].includes(permission);
}
