type PaginationBarProps = {
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function PaginationBar({ loading, page, pageSize, total, onPageChange }: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination-bar">
      <span className="pagination-summary">
        第 {page} / {totalPages} 页，共 {total} 条
      </span>
      <div className="pagination-actions">
        <button className="ghost-button" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)} type="button">
          上一页
        </button>
        <button className="ghost-button" disabled={loading || page >= totalPages} onClick={() => onPageChange(page + 1)} type="button">
          下一页
        </button>
      </div>
    </div>
  );
}

