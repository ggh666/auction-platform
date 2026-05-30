# Admin Asset Data Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin asset data page that lists all asset statuses with filters and pagination.

**Architecture:** Extend the shared API contract, add a paginated repository query used by `GET /admin/assets`, then add a React admin page with status, keyword, game-name dropdown, asset-type filters, image preview, and previous/next pagination. Keep the existing asset review page focused on pending-review workflow.

**Tech Stack:** Fastify, TypeScript, MySQL repository pattern, React admin frontend, Vitest.

---

### Task 1: Backend Contract And Repository Query

**Files:**
- Modify: `products/auction-platform/shared/src/api-contracts.ts`
- Modify: `products/auction-platform/api/src/modules/assets/assets.repository.ts`
- Modify: `products/auction-platform/api/src/modules/assets/assets.mysql.repository.ts`
- Test: `products/auction-platform/tests/api/admin.test.ts`
- Test: `products/auction-platform/tests/api/mysql-repositories.test.ts`

- [x] Add `AdminAssetListResponse` with `items`, `total`, `page`, and `pageSize`.
- [x] Add `listForAdmin(input)` to `AssetsRepository`.
- [x] Implement in-memory filtering by `keyword`, `status`, `gameName`, and `assetType`.
- [x] Implement MySQL filtering with safe parameter binding and `LIMIT/OFFSET`.
- [x] Verify backend tests fail before implementation and pass after implementation.

### Task 2: Admin Assets Route

**Files:**
- Modify: `products/auction-platform/api/src/modules/admin/adminPermissions.ts`
- Modify: `products/auction-platform/api/src/modules/admin/admin.routes.ts`
- Test: `products/auction-platform/tests/api/admin.test.ts`

- [x] Add `asset:view` permission for `super_admin`, `reviewer`, and `operator`.
- [x] Add `GET /admin/assets`.
- [x] Parse `page`, `pageSize`, `keyword`, `status`, `gameName`, and `assetType`.
- [x] Clamp invalid page inputs to safe defaults and reject invalid asset status values with `400`.

### Task 3: Admin Frontend Page

**Files:**
- Create: `products/auction-platform/admin/src/pages/AssetDataPage.tsx`
- Modify: `products/auction-platform/admin/src/App.tsx`
- Modify: `products/auction-platform/admin/src/components/AppLayout.tsx`
- Modify: `products/auction-platform/admin/src/styles.css`

- [x] Add `资产数据` navigation.
- [x] Render filters: keyword input, status select, game name select with `全部 / 塔防精灵`, asset type select with `全部 / 账号 / 道具`.
- [x] Render table with image preview, title, seller, prices, status, end time, and created time.
- [x] Add pagination controls and reload data when filters submit or page changes.

### Task 4: Verification

**Files:**
- No production file changes.

- [x] Run `npm --prefix products/auction-platform test`.
- [x] Run `npm --prefix products/auction-platform run typecheck`.
- [x] Run `npm --prefix products/auction-platform run build --workspace @auction/admin`.
