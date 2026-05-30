# Close Ended Auctions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent removed, non-active, or time-expired assets from continuing to participate in auction bidding.

**Architecture:** Keep the backend as the authority: public auction list excludes expired active assets, and bid submission already rejects non-active or expired assets. Add miniapp-side status/time gating so unavailable auctions show a clear reason and disable bid controls before a request is sent.

**Tech Stack:** Fastify, TypeScript, Vitest, uni-app Vue 3.

---

### Task 1: Backend Public List Excludes Expired Active Assets

**Files:**
- Modify: `products/auction-platform/tests/api/assets.test.ts`
- Modify: `products/auction-platform/api/src/modules/assets/assets.service.ts`

- [x] Add a failing API test that creates an active asset with `effectiveEndAt` in the past and expects `GET /api/assets` not to include it.
- [x] Run `npm --prefix products/auction-platform test -- tests/api/assets.test.ts` and verify the new test fails.
- [x] Update `createAssetsService().listActive()` to filter repository results to `status === "active"` and `effectiveEndAt > Date.now()`.
- [x] Re-run the targeted assets test and verify it passes.

### Task 2: Miniapp Bid Controls Disable For Closed Auctions

**Files:**
- Modify: `products/auction-platform/miniapp/utils/bidAmount.test.ts`
- Modify: `products/auction-platform/miniapp/utils/bidAmount.ts`
- Modify: `products/auction-platform/miniapp/pages/auctions/detail.vue`

- [x] Add failing utility tests for removed assets and time-expired active assets returning unavailable messages.
- [x] Run `npm --prefix products/auction-platform test -- miniapp/utils/bidAmount.test.ts` and verify the tests fail.
- [x] Add `auctionUnavailableMessage(asset, now)` in `bidAmount.ts`.
- [x] Use that helper in the detail page to show an unavailable notice, disable the input, and disable the submit button when the auction is closed.
- [x] Re-run utility tests and miniapp typecheck.

### Task 3: Verification

**Files:**
- No extra production files.

- [x] Run `npm --prefix products/auction-platform test`.
- [x] Run `npm --prefix products/auction-platform run typecheck`.
- [x] Run `npm --prefix products/auction-platform run build:mp-weixin --workspace @auction/miniapp`.
