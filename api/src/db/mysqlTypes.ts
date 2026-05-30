export type MysqlResultHeader = {
  insertId: number;
  affectedRows: number;
};

export type MysqlExecutor = {
  execute<T = unknown>(sql: string, params?: unknown[]): Promise<[T, unknown[]]>;
};

export type MysqlConnection = MysqlExecutor & {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
};

export type MysqlPool = MysqlExecutor & {
  getConnection(): Promise<MysqlConnection>;
  end(): Promise<void>;
};

export function firstRow<T>(rows: unknown): T | null {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return rows[0] as T;
}

export function allRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export function toMysqlDate(iso: string): Date {
  return new Date(iso);
}

export function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
