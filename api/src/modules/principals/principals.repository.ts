import type { PrincipalSummary } from "@auction/shared";

export type PrincipalRecord = PrincipalSummary & {
  adminId: string;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertPrincipalInput = {
  adminId: string;
  displayName: string;
  disabled?: boolean;
};

export type PrincipalsRepository = {
  listActive(): Promise<PrincipalSummary[]>;
  listForAdmin(): Promise<PrincipalRecord[]>;
  findById(id: string): Promise<PrincipalRecord | null>;
  findActiveById(id: string): Promise<PrincipalRecord | null>;
  findActiveByAdminId(adminId: number): Promise<PrincipalRecord | null>;
  upsert(input: UpsertPrincipalInput): Promise<PrincipalRecord>;
};

function clonePrincipal(principal: PrincipalRecord): PrincipalRecord {
  return { ...principal };
}

export function createInMemoryPrincipalsRepository(): PrincipalsRepository {
  const now = new Date().toISOString();
  const principals = new Map<string, PrincipalRecord>([
    [
      "1",
      {
        id: "1",
        adminId: "1",
        displayName: "默认主理人",
        disabledAt: null,
        createdAt: now,
        updatedAt: now
      }
    ],
    [
      "2",
      {
        id: "2",
        adminId: "2",
        displayName: "备用主理人",
        disabledAt: null,
        createdAt: now,
        updatedAt: now
      }
    ]
  ]);
  let nextId = 3;

  return {
    async listActive() {
      return [...principals.values()]
        .filter((principal) => principal.disabledAt === null)
        .sort((left, right) => Number(left.id) - Number(right.id))
        .map((principal) => ({ id: principal.id, displayName: principal.displayName }));
    },

    async listForAdmin() {
      return [...principals.values()]
        .sort((left, right) => Number(left.id) - Number(right.id))
        .map(clonePrincipal);
    },

    async findById(id) {
      const principal = principals.get(id);
      return principal ? clonePrincipal(principal) : null;
    },

    async findActiveById(id) {
      const principal = principals.get(id);
      return principal && principal.disabledAt === null ? clonePrincipal(principal) : null;
    },

    async findActiveByAdminId(adminId) {
      const principal = [...principals.values()].find(
        (candidate) => candidate.adminId === String(adminId) && candidate.disabledAt === null
      );
      return principal ? clonePrincipal(principal) : null;
    },

    async upsert(input) {
      const existing = [...principals.values()].find((principal) => principal.adminId === input.adminId);
      const updatedAt = new Date().toISOString();
      const principal: PrincipalRecord = {
        id: existing?.id ?? String(nextId++),
        adminId: input.adminId,
        displayName: input.displayName.trim(),
        disabledAt: input.disabled ? existing?.disabledAt ?? updatedAt : null,
        createdAt: existing?.createdAt ?? updatedAt,
        updatedAt
      };
      principals.set(principal.id, clonePrincipal(principal));
      return clonePrincipal(principal);
    }
  };
}
