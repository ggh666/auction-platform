import type { AdminRole } from "@auction/shared";

export type AdminUserRow = {
  id: number;
  username: string;
  password_hash: string;
  role: AdminRole;
  disabled_at: Date | null;
};

export type CreateAdminUserInput = {
  username: string;
  passwordHash: string;
  role: AdminRole;
};

export type UpdateAdminUserInput = {
  username?: string;
  passwordHash?: string;
  role?: AdminRole;
  disabled?: boolean;
};

export type AdminOperationLog = {
  adminId: number;
  action: string;
  targetType: string;
  targetId: string;
  detail?: unknown;
};

export type AdminRepository = {
  findById(id: number): Promise<AdminUserRow | null>;
  findByUsername(username: string): Promise<AdminUserRow | null>;
  list(): Promise<AdminUserRow[]>;
  create(input: CreateAdminUserInput): Promise<AdminUserRow>;
  update(id: number, input: UpdateAdminUserInput): Promise<AdminUserRow>;
  softDelete(id: number): Promise<AdminUserRow>;
  logOperation(input: AdminOperationLog): Promise<void>;
};

export type InMemoryAdminRepository = AdminRepository & {
  listOperations(): Promise<AdminOperationLog[]>;
  disableAdmin(id: number): void;
  setRole(id: number, role: AdminRole): void;
};

function cloneAdmin(admin: AdminUserRow): AdminUserRow {
  return { ...admin };
}

export function createInMemoryAdminRepository(): InMemoryAdminRepository {
  const admins: AdminUserRow[] = [
    { id: 1, username: "reviewer", password_hash: "reviewer-pass", role: "reviewer", disabled_at: null },
    { id: 2, username: "operator", password_hash: "operator-pass", role: "operator", disabled_at: null },
    { id: 3, username: "super", password_hash: "super-pass", role: "super_admin", disabled_at: null }
  ];
  let nextId = 4;
  const operations: AdminOperationLog[] = [];

  return {
    async findById(id) {
      const admin = admins.find((candidate) => candidate.id === id);
      return admin ? cloneAdmin(admin) : null;
    },
    async findByUsername(username) {
      const admin = admins.find((candidate) => candidate.username === username);
      return admin ? cloneAdmin(admin) : null;
    },
    async list() {
      return admins.map(cloneAdmin);
    },
    async create(input) {
      const admin: AdminUserRow = {
        id: nextId++,
        username: input.username,
        password_hash: input.passwordHash,
        role: input.role,
        disabled_at: null
      };
      admins.push(admin);
      return cloneAdmin(admin);
    },
    async update(id, input) {
      const admin = admins.find((candidate) => candidate.id === id);
      if (!admin) {
        throw new Error("Admin user not found");
      }
      if (input.username !== undefined) {
        admin.username = input.username;
      }
      if (input.passwordHash !== undefined) {
        admin.password_hash = input.passwordHash;
      }
      if (input.role !== undefined) {
        admin.role = input.role;
      }
      if (input.disabled !== undefined) {
        admin.disabled_at = input.disabled ? admin.disabled_at ?? new Date() : null;
      }
      return cloneAdmin(admin);
    },
    async softDelete(id) {
      const admin = admins.find((candidate) => candidate.id === id);
      if (!admin) {
        throw new Error("Admin user not found");
      }
      admin.disabled_at = admin.disabled_at ?? new Date();
      return cloneAdmin(admin);
    },
    async logOperation(input) {
      operations.push({ ...input });
      return undefined;
    },
    async listOperations() {
      return operations.map((operation) => ({ ...operation }));
    },
    disableAdmin(id) {
      const admin = admins.find((candidate) => candidate.id === id);
      if (admin) {
        admin.disabled_at = new Date();
      }
    },
    setRole(id, role) {
      const admin = admins.find((candidate) => candidate.id === id);
      if (admin) {
        admin.role = role;
      }
    }
  };
}
