export type PageQuery = {
  page?: unknown;
  pageSize?: unknown;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export function readPagination(query: PageQuery = {}, defaults: { page?: number; pageSize?: number; maxPageSize?: number } = {}) {
  const fallbackPage = defaults.page ?? 1;
  const fallbackPageSize = defaults.pageSize ?? 20;
  const maxPageSize = defaults.maxPageSize ?? 100;
  const page = parsePositiveInteger(query.page, fallbackPage);
  const pageSize = Math.min(parsePositiveInteger(query.pageSize, fallbackPageSize), maxPageSize);
  return { page, pageSize };
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    total: items.length,
    page,
    pageSize
  };
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  const raw = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

