import type { BidDisplayRecord, BidRecord, UserSummary } from "@auction/shared";
import type { UserRow, UsersRepository } from "./users.repository";

export function toUserSummary(user: UserRow): UserSummary {
  return {
    id: String(user.id),
    displayName: user.display_name,
    avatarUrl: user.avatar_url ?? undefined,
    banned: user.banned_at !== null,
    violationCount: user.violation_count,
    creditScore: user.credit_score,
    creditResetAt: user.credit_reset_at === null ? null : new Date(user.credit_reset_at).toISOString(),
    buyerUnreachableCount: user.buyer_unreachable_count,
    bidRestrictedUntil: user.bid_restricted_until === null ? null : new Date(user.bid_restricted_until).toISOString()
  };
}

export async function readUserSummary(users: UsersRepository, userId: string): Promise<UserSummary> {
  const parsedUserId = Number(userId);
  if (Number.isInteger(parsedUserId)) {
    const user = await users.findById(parsedUserId);
    if (user) {
      return toUserSummary(user);
    }
  }

  return {
    id: userId,
    displayName: `用户 ${userId}`,
    banned: false,
    violationCount: 0,
    creditScore: 100,
    creditResetAt: null,
    buyerUnreachableCount: 0,
    bidRestrictedUntil: null
  };
}

export async function toBidDisplayRecord(users: UsersRepository, bid: BidRecord): Promise<BidDisplayRecord> {
  return {
    ...bid,
    bidder: await readUserSummary(users, bid.bidderId)
  };
}
