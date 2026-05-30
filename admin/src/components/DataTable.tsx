import type { ReactNode } from "react";

export type DataTableColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
};

type DataTableProps<T> = {
  columns: DataTableColumn[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  renderCell: (row: T, column: DataTableColumn) => ReactNode;
  emptyText?: string;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  renderCell,
  emptyText = "暂无数据"
}: DataTableProps<T>) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.align ? `align-${column.align}` : undefined} key={column.key}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="empty-cell" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={getRowKey(row, index)}>
                {columns.map((column) => (
                  <td className={column.align ? `align-${column.align}` : undefined} key={column.key}>
                    {renderCell(row, column)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
