# Bidder Notifications And Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix miniapp image selection/upload ergonomics, show bidder names in recent bids, and add A+B notifications for bid updates.

**Architecture:** Keep the backend as the source of truth for bid records and notification creation. Extend shared contracts with bid display summaries and notification items, add a notification repository plus API routes, and let the miniapp use both WebSocket realtime events and a profile notification list.

**Tech Stack:** Fastify, TypeScript, Vitest, MySQL repositories, uni-app Vue 3.

---

### Task 1: Miniapp Image Selection

**Files:**
- Create: `products/auction-platform/miniapp/utils/imageSelection.ts`
- Create: `products/auction-platform/miniapp/utils/imageSelection.test.ts`
- Modify: `products/auction-platform/miniapp/pages/auctions/publish.vue`

- [x] Add failing tests for appending at most 9 images, reporting overflow count, and removing a selected image by index.
- [x] Implement `appendAssetImagePaths` and `removeAssetImagePathAt`.
- [x] Update publish page to use the helpers, show selected count, show an overflow toast, and add a delete button on each selected image.
- [x] Keep upload sequential and improve error messages so a single invalid/oversized image reports which image failed.

### Task 2: Bid Display Summaries

**Files:**
- Modify: `products/auction-platform/shared/src/domain.ts`
- Modify: `products/auction-platform/shared/src/api-contracts.ts`
- Modify: `products/auction-platform/shared/src/ws-events.ts`
- Modify: `products/auction-platform/api/src/modules/assets/assets.routes.ts`
- Modify: `products/auction-platform/api/src/modules/bids/bids.routes.ts`
- Modify: `products/auction-platform/tests/api/assets.test.ts`
- Modify: `products/auction-platform/tests/api/bids.test.ts`
- Modify: `products/auction-platform/miniapp/pages/auctions/detail.vue`

- [x] Add failing API tests proving asset detail recent bids and bid realtime events include `bidder.displayName`.
- [x] Add shared `BidDisplayRecord = BidRecord & { bidder: UserSummary }`.
- [x] Map bid records to display records by reading bidder users; fall back to `用户 {id}` when missing.
- [x] Render bidder names in the miniapp recent bid list.

### Task 3: Station Notifications

**Files:**
- Create: `products/auction-platform/api/src/modules/notifications/notifications.repository.ts`
- Create: `products/auction-platform/api/src/modules/notifications/notifications.mysql.repository.ts`
- Create: `products/auction-platform/api/src/modules/notifications/notifications.routes.ts`
- Modify: `products/auction-platform/api/src/app.ts`
- Modify: `products/auction-platform/api/src/runtimeApp.ts`
- Modify: `products/auction-platform/api/src/db/migrations/001_initial_schema.sql`
- Modify: `products/auction-platform/tests/api/bids.test.ts`
- Modify: `products/auction-platform/tests/api/mysql-repositories.test.ts`

- [x] Add failing tests that when a new bidder outbids prior bidders, previous distinct bidders receive notification rows and the current bidder does not.
- [x] Add in-memory and MySQL notification repositories.
- [x] Persist notifications after successful bids.
- [x] Add `GET /api/profile/notifications` and `POST /api/profile/notifications/:notificationId/read`.

### Task 4: Miniapp Realtime And Notification UI

**Files:**
- Modify: `products/auction-platform/miniapp/api/client.ts`
- Create: `products/auction-platform/miniapp/utils/realtime.ts`
- Modify: `products/auction-platform/miniapp/pages/auctions/detail.vue`
- Modify: `products/auction-platform/miniapp/pages/profile/index.vue`
- Create: `products/auction-platform/miniapp/pages/profile/notifications.vue`
- Modify: `products/auction-platform/miniapp/src/pages.json` or `products/auction-platform/miniapp/pages.json`

- [x] Add a small helper to build `wss://.../ws/auctions?assetId=...` from the configured API base.
- [x] Connect detail page to auction WebSocket, update asset and recent bids on `bid_accepted`, and toast when another user bids.
- [x] Add client methods and a profile notifications page.
- [x] Add a profile menu entry for notifications.

### Task 5: Verification

**Files:**
- No extra production files.

- [x] Run `npm --prefix products/auction-platform test`.
- [x] Run `npm --prefix products/auction-platform run typecheck`.
- [x] Run `npm --prefix products/auction-platform run build:mp-weixin --workspace @auction/miniapp`.

### Post-Release Follow-Up: Notification Read Resilience

**Files:**
- Modify: `products/auction-platform/api/src/modules/notifications/notifications.routes.ts`
- Modify: `products/auction-platform/tests/api/profile.test.ts`
- Create: `products/auction-platform/docs/releases.md`
- Modify: `products/auction-platform/deploy/tencent-cloud.md`
- Modify: `products/auction-platform/README.md`

- [x] Add a regression test proving `GET /api/profile/notifications` returns an empty list instead of 500 when notification storage is unavailable.
- [x] Log `failed to list profile notifications` on storage failure so missing `station_notifications` migrations remain visible in API logs.
- [x] Document the `002_station_notifications.sql` migration, notification troubleshooting commands, and release verification notes.
