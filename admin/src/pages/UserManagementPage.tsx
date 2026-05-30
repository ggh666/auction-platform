import { useEffect, useState } from "react";
import type { AdminManagedUser, AdminUserActionResponse, AdminUserListResponse } from "@auction/shared";
import { adminGet, adminPost } from "../api/client";
import { DataTable } from "../components/DataTable";
import { PaginationBar } from "../components/PaginationBar";

const pageSize = 20;

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function userStatus(user: AdminManagedUser) {
  if (user.banned) {
    return <span className="status danger">已封禁</span>;
  }
  return <span className="status success">正常</span>;
}

export function UserManagementPage() {
  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadUsers(nextPage = page, nextQuery = query) {
    setLoading(true);
    setError(null);
    try {
      const trimmed = nextQuery.trim();
      const params = new URLSearchParams({ page: String(nextPage), pageSize: String(pageSize) });
      if (trimmed) {
        params.set("q", trimmed);
      }
      const path = `/admin/users?${params.toString()}`;
      const response = await adminGet<AdminUserListResponse>(path);
      setUsers(response.items);
      setTotal(response.total);
      setPage(response.page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载用户列表失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers(1, "");
  }, []);

  function replaceUser(user: AdminManagedUser) {
    setUsers((current) => current.map((item) => (item.id === user.id ? user : item)));
  }

  async function banUser(user: AdminManagedUser) {
    const reason = window.prompt("请输入封禁原因", user.banReason ?? "线下交易违约")?.trim();
    if (reason === undefined) {
      return;
    }

    setActingId(user.id);
    setError(null);
    try {
      const response = await adminPost<AdminUserActionResponse>(`/admin/users/${user.id}/ban`, { reason });
      replaceUser(response.user);
    } catch (banError) {
      setError(banError instanceof Error ? banError.message : "封禁用户失败");
    } finally {
      setActingId(null);
    }
  }

  async function unbanUser(user: AdminManagedUser) {
    setActingId(user.id);
    setError(null);
    try {
      const response = await adminPost<AdminUserActionResponse>(`/admin/users/${user.id}/unban`);
      replaceUser(response.user);
    } catch (unbanError) {
      setError(unbanError instanceof Error ? unbanError.message : "解除封禁失败");
    } finally {
      setActingId(null);
    }
  }

  async function setPublishLimit(user: AdminManagedUser) {
    const currentValue = user.dailyPublishLimit === null ? "" : String(user.dailyPublishLimit);
    const input = window.prompt("请输入每日发布次数，留空表示使用系统默认 3 次，0 表示禁止发布", currentValue);
    if (input === null) {
      return;
    }

    const trimmed = input.trim();
    const limit = trimmed === "" ? null : Number(trimmed);
    if (limit !== null && (!Number.isInteger(limit) || limit < 0 || limit > 999)) {
      setError("每日发布次数必须是 0 到 999 之间的整数");
      return;
    }

    setActingId(user.id);
    setError(null);
    try {
      const response = await adminPost<AdminUserActionResponse>(`/admin/users/${user.id}/publish-limit`, { limit });
      replaceUser(response.user);
    } catch (limitError) {
      setError(limitError instanceof Error ? limitError.message : "设置发布次数失败");
    } finally {
      setActingId(null);
    }
  }

  return (
    <section className="page-section">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>用户风控列表</h3>
            <p>查询真实用户、查看违规次数，并对严重违规用户进行封禁或解除限制。</p>
          </div>
          <form
            className="toolbar"
            onSubmit={(event) => {
              event.preventDefault();
              void loadUsers(1);
            }}
          >
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索用户 ID 或昵称"
              type="search"
              value={query}
            />
            <button className="primary-button" disabled={loading} type="submit">
              查询
            </button>
          </form>
        </div>
        {error ? <p className="notice danger">{error}</p> : null}
        <DataTable
          columns={[
            { key: "id", label: "用户ID" },
            { key: "name", label: "昵称" },
            { key: "creditScore", label: "信誉分", align: "right" },
            { key: "violationCount", label: "违规次数", align: "right" },
            { key: "dailyPublishLimit", label: "每日发布", align: "right" },
            { key: "status", label: "状态" },
            { key: "banReason", label: "封禁原因" },
            { key: "createdAt", label: "注册时间" },
            { key: "actions", label: "操作", align: "center" }
          ]}
          emptyText={loading ? "正在加载..." : "暂无用户数据"}
          getRowKey={(row) => row.id}
          rows={users}
          renderCell={(row, column) => {
            if (column.key === "name") {
              return row.displayName;
            }

            if (column.key === "status") {
              return userStatus(row);
            }

            if (column.key === "banReason") {
              return row.banReason ?? <span className="muted">无</span>;
            }

            if (column.key === "dailyPublishLimit") {
              return row.dailyPublishLimit === null ? <span className="muted">默认 3 次</span> : `${row.dailyPublishLimit} 次`;
            }

            if (column.key === "creditScore") {
              return row.creditScore <= 70 ? <span className="status danger">{row.creditScore}</span> : row.creditScore;
            }

            if (column.key === "createdAt") {
              return formatTime(row.createdAt);
            }

            if (column.key === "actions") {
              const disabled = actingId === row.id;
              return (
                <div className="inline-actions">
                  {row.banned ? (
                    <button disabled={disabled} onClick={() => void unbanUser(row)} type="button">
                      解封
                    </button>
                  ) : (
                    <button disabled={disabled} onClick={() => void banUser(row)} type="button">
                      封禁
                    </button>
                  )}
                  <button disabled={disabled} onClick={() => void setPublishLimit(row)} type="button">
                    发布次数
                  </button>
                </div>
              );
            }

            return row[column.key as keyof AdminManagedUser] as string | number;
          }}
        />
        <PaginationBar loading={loading} onPageChange={(nextPage) => void loadUsers(nextPage)} page={page} pageSize={pageSize} total={total} />
      </div>
    </section>
  );
}
