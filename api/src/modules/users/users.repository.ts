export type UserRow = {
  id: number;
  openid: string | null;
  display_name: string;
  avatar_url: string | null;
  banned_at: Date | string | null;
  ban_reason: string | null;
  violation_count: number;
  credit_score: number;
  credit_reset_at: Date | string | null;
  daily_publish_limit: number | null;
  buyer_unreachable_count: number;
  bid_restricted_until: Date | string | null;
  bid_restricted_permanent: boolean;
  bid_restriction_reason: string | null;
  bid_restriction_started_at: Date | string | null;
  bid_restriction_admin_id: number | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type BidRestrictionInput = {
  permanent: boolean;
  restrictedUntil: Date | null;
  reason: string;
  adminId: number;
};

export type InMemoryUsersRepository = UsersRepository & {
  setNow(now: () => Date): void;
};

export type UsersRepository = {
  findById(id: number): Promise<UserRow | null>;
  countAll(): Promise<number>;
  countBanned(): Promise<number>;
  countCreatedSince(since: string): Promise<number>;
  listForAdmin(input?: { query?: string; page?: number; pageSize?: number; limit?: number }): Promise<UserRow[]>;
  countForAdmin(input?: { query?: string }): Promise<number>;
  findOrCreateMockUser(displayName: string): Promise<UserRow>;
  findOrCreateWechatUser(input: { openid: string; displayName: string; avatarUrl?: string }): Promise<UserRow>;
  banUser(id: number, reason: string): Promise<UserRow>;
  unbanUser(id: number): Promise<UserRow>;
  setDailyPublishLimit(id: number, limit: number | null): Promise<UserRow>;
  deductCreditScore(id: number, points: number): Promise<UserRow>;
  recordBuyerUnreachable(id: number): Promise<UserRow>;
  restrictBidding(id: number, input: BidRestrictionInput): Promise<UserRow>;
  releaseBidRestriction(id: number): Promise<UserRow>;
};

export function createInMemoryUsersRepository(options: { now?: () => Date } = {}): InMemoryUsersRepository {
  const users = new Map<number, UserRow>();
  let nextId = 1;
  let now = options.now ?? (() => new Date());

  function resetAtFrom(value: Date): Date {
    const resetAt = new Date(value);
    resetAt.setMonth(resetAt.getMonth() + 3);
    return resetAt;
  }

  function cloneUser(user: UserRow): UserRow {
    return {
      ...user,
      banned_at: user.banned_at ? new Date(user.banned_at) : null,
      credit_reset_at: user.credit_reset_at ? new Date(user.credit_reset_at) : null,
      bid_restricted_until: user.bid_restricted_until ? new Date(user.bid_restricted_until) : null,
      bid_restriction_started_at: user.bid_restriction_started_at ? new Date(user.bid_restriction_started_at) : null,
      created_at: new Date(user.created_at),
      updated_at: new Date(user.updated_at)
    };
  }

  function createUser(input: { openid: string | null; displayName: string; avatarUrl?: string | null }): UserRow {
    const createdAt = now();
    return {
      id: nextId++,
      openid: input.openid,
      display_name: input.displayName,
      avatar_url: input.avatarUrl ?? null,
      banned_at: null,
      ban_reason: null,
      violation_count: 0,
      credit_score: 100,
      credit_reset_at: null,
      daily_publish_limit: null,
      buyer_unreachable_count: 0,
      bid_restricted_until: null,
      bid_restricted_permanent: false,
      bid_restriction_reason: null,
      bid_restriction_started_at: null,
      bid_restriction_admin_id: null,
      created_at: createdAt,
      updated_at: createdAt
    };
  }

  function timeValue(value: Date | string): number {
    return value instanceof Date ? value.getTime() : new Date(value).getTime();
  }

  async function findById(id: number) {
    const user = users.get(id);
    if (!user) {
      return null;
    }
    const normalized = normalizeCreditReset(user);
    return cloneUser(normalized);
  }

  function normalizeCreditReset(user: UserRow): UserRow {
    if (user.credit_score >= 100 || !user.credit_reset_at) {
      return user;
    }
    if (now().getTime() < timeValue(user.credit_reset_at)) {
      return user;
    }
    const updated: UserRow = {
      ...user,
      credit_score: 100,
      credit_reset_at: null,
      updated_at: now()
    };
    users.set(user.id, updated);
    return updated;
  }

  return {
    setNow(nextNow) {
      now = nextNow;
    },
    findById,
    async countAll() {
      return users.size;
    },
    async countBanned() {
      return [...users.values()].filter((user) => user.banned_at !== null).length;
    },
    async countCreatedSince(since) {
      const sinceMs = new Date(since).getTime();
      return [...users.values()].filter((user) => timeValue(user.created_at) >= sinceMs).length;
    },
    async listForAdmin(input = {}) {
      const query = input.query?.trim().toLowerCase() ?? "";
      const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : 1;
      const pageSize = input.limit ?? (Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0 ? input.pageSize : 20);
      const filtered = [...users.values()].map(normalizeCreditReset)
        .filter((user) => {
          if (!query) {
            return true;
          }
          return String(user.id) === query || user.display_name.toLowerCase().includes(query);
        })
        .sort((left, right) => timeValue(right.created_at) - timeValue(left.created_at) || right.id - left.id);
      const offset = (page - 1) * pageSize;
      return filtered
        .slice(offset, offset + pageSize)
        .map(cloneUser);
    },
    async countForAdmin(input = {}) {
      const query = input.query?.trim().toLowerCase() ?? "";
      return [...users.values()].map(normalizeCreditReset).filter((user) => {
        if (!query) {
          return true;
        }
        return String(user.id) === query || user.display_name.toLowerCase().includes(query);
      }).length;
    },
    async findOrCreateMockUser(displayName) {
      const user = createUser({ openid: null, displayName });
      users.set(user.id, user);
      return cloneUser(user);
    },
    async findOrCreateWechatUser(input) {
      const existing = [...users.values()].find((user) => user.openid === input.openid);
      if (existing) {
        const normalized = normalizeCreditReset(existing);
        const updated: UserRow = {
          ...normalized,
          display_name: input.displayName,
          avatar_url: input.avatarUrl ?? normalized.avatar_url,
          updated_at: now()
        };
        users.set(updated.id, updated);
        return cloneUser(updated);
      }

      const user = createUser({ openid: input.openid, displayName: input.displayName, avatarUrl: input.avatarUrl });
      users.set(user.id, user);
      return cloneUser(user);
    },
    async banUser(id, reason) {
      const user = users.get(id);
      if (!user) {
        throw new Error("User not found");
      }
      const updated: UserRow = {
        ...user,
        banned_at: now(),
        ban_reason: reason.trim(),
        updated_at: now()
      };
      users.set(id, updated);
      return cloneUser(updated);
    },
    async unbanUser(id) {
      const user = users.get(id);
      if (!user) {
        throw new Error("User not found");
      }
      const updated: UserRow = {
        ...user,
        banned_at: null,
        ban_reason: null,
        updated_at: now()
      };
      users.set(id, updated);
      return cloneUser(updated);
    },
    async setDailyPublishLimit(id, limit) {
      const user = users.get(id);
      if (!user) {
        throw new Error("User not found");
      }
      const updated: UserRow = {
        ...user,
        daily_publish_limit: limit,
        updated_at: now()
      };
      users.set(id, updated);
      return cloneUser(updated);
    },
    async deductCreditScore(id, points) {
      const existing = users.get(id);
      if (!existing) {
        throw new Error("User not found");
      }
      const user = normalizeCreditReset(existing);
      const deducted = Math.max(0, user.credit_score - points);
      const currentTime = now();
      const updated: UserRow = {
        ...user,
        violation_count: user.violation_count + 1,
        credit_score: deducted,
        credit_reset_at: resetAtFrom(currentTime),
        updated_at: currentTime
      };
      users.set(id, updated);
      return cloneUser(updated);
    },
    async recordBuyerUnreachable(id) {
      const existing = users.get(id);
      if (!existing) {
        throw new Error("User not found");
      }
      const currentTime = now();
      const nextCount = existing.buyer_unreachable_count + 1;
      const restrictedUntil = new Date(currentTime);
      if (nextCount >= 3) {
        restrictedUntil.setDate(restrictedUntil.getDate() + 30);
      } else if (nextCount >= 2) {
        restrictedUntil.setDate(restrictedUntil.getDate() + 7);
      }
      const currentRestrictionMs = existing.bid_restricted_until ? timeValue(existing.bid_restricted_until) : 0;
      const nextRestriction =
        nextCount >= 2 && restrictedUntil.getTime() > currentRestrictionMs
          ? restrictedUntil
          : existing.bid_restricted_until;
      const updated: UserRow = {
        ...existing,
        buyer_unreachable_count: nextCount,
        bid_restricted_until: existing.bid_restricted_permanent ? existing.bid_restricted_until : nextRestriction,
        bid_restricted_permanent: existing.bid_restricted_permanent,
        bid_restriction_reason: nextRestriction && !existing.bid_restricted_permanent ? "买家失联" : existing.bid_restriction_reason,
        bid_restriction_started_at:
          nextRestriction && !existing.bid_restricted_permanent ? currentTime : existing.bid_restriction_started_at,
        bid_restriction_admin_id: existing.bid_restricted_permanent ? existing.bid_restriction_admin_id : null,
        updated_at: currentTime
      };
      users.set(id, updated);
      return cloneUser(updated);
    },
    async restrictBidding(id, input) {
      const existing = users.get(id);
      if (!existing) {
        throw new Error("User not found");
      }
      const currentTime = now();
      const updated: UserRow = {
        ...existing,
        bid_restricted_until: input.permanent ? null : input.restrictedUntil,
        bid_restricted_permanent: input.permanent,
        bid_restriction_reason: input.reason.trim(),
        bid_restriction_started_at: currentTime,
        bid_restriction_admin_id: input.adminId,
        updated_at: currentTime
      };
      users.set(id, updated);
      return cloneUser(updated);
    },
    async releaseBidRestriction(id) {
      const existing = users.get(id);
      if (!existing) {
        throw new Error("User not found");
      }
      const updated: UserRow = {
        ...existing,
        bid_restricted_until: null,
        bid_restricted_permanent: false,
        bid_restriction_reason: null,
        bid_restriction_started_at: null,
        bid_restriction_admin_id: null,
        updated_at: now()
      };
      users.set(id, updated);
      return cloneUser(updated);
    }
  };
}
