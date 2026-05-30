# Daily Publish Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Limit each user to a default of 3 asset publications per day, with per-user admin overrides.

**Architecture:** Add per-user publish limit data to users and a default limit system config. The asset publishing route checks the user's China-day publish count before creating a pending asset. Admin user management can set a specific limit or clear it to use the default.

**Tech Stack:** Fastify, TypeScript, MySQL repositories, React admin, uni-app Vue 3, Vitest.

---

### Task 1: Backend Limit Enforcement

**Files:**
- Modify: `products/auction-platform/tests/api/assets.test.ts`
- Modify: `products/auction-platform/api/src/modules/assets/assets.repository.ts`
- Modify: `products/auction-platform/api/src/modules/assets/assets.mysql.repository.ts`
- Modify: `products/auction-platform/api/src/modules/assets/assets.routes.ts`
- Modify: `products/auction-platform/api/src/app.ts`

- [x] Add failing tests for default 3-per-day limit and a per-user 0 limit blocking publishing.
- [x] Add `countCreatedBySellerSince(sellerId, since)` to asset repositories.
- [x] Read default limit from system config and user override before `createPending`.
- [x] Return a clear `publish_limit_reached` 400 error when the limit is reached.

### Task 2: Admin User Override

**Files:**
- Modify: `products/auction-platform/shared/src/domain.ts`
- Modify: `products/auction-platform/api/src/modules/users/users.repository.ts`
- Modify: `products/auction-platform/api/src/modules/users/users.mysql.repository.ts`
- Modify: `products/auction-platform/api/src/modules/admin/adminUsers.routes.ts`
- Modify: `products/auction-platform/tests/api/admin.test.ts`
- Modify: `products/auction-platform/tests/api/mysql-repositories.test.ts`
- Modify: `products/auction-platform/admin/src/pages/UserManagementPage.tsx`

- [x] Add failing tests for setting and clearing a user's publish limit.
- [x] Add `dailyPublishLimit` to admin user contracts and repository rows.
- [x] Add `setDailyPublishLimit(id, limit)` to user repositories.
- [x] Add admin route `POST /admin/users/:userId/publish-limit`.
- [x] Add a table column and action in the admin user page.

### Task 3: Database Migrations And Miniapp Message

**Files:**
- Modify: `products/auction-platform/api/src/db/migrations/001_initial_schema.sql`
- Create: `products/auction-platform/api/src/db/migrations/003_daily_publish_limit.sql`
- Modify: `products/auction-platform/miniapp/pages/auctions/publish.vue`

- [x] Add `users.daily_publish_limit` and `default_daily_publish_limit`.
- [x] Add a standalone migration for existing deployments.
- [x] Map `Daily publish limit reached` to a Chinese miniapp toast.

### Task 4: Verification

**Files:**
- No extra production files.

- [x] Run targeted red/green tests for assets, admin, and MySQL repositories.
- [x] Run `npm --prefix products/auction-platform test`.
- [x] Run `npm --prefix products/auction-platform run typecheck`.
- [x] Run `npm --prefix products/auction-platform run build --workspace @auction/admin`.
- [x] Run `npm --prefix products/auction-platform run build:mp-weixin --workspace @auction/miniapp`.
