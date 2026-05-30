import { useEffect, useState, type FormEvent } from "react";
import type {
  AdminAccountListResponse,
  AdminAccountSummary,
  AdminPrincipal,
  AdminPrincipalActionResponse,
  AdminPrincipalListResponse,
  AdminRole
} from "@auction/shared";
import { adminGet, adminPost } from "../api/client";
import { DataTable } from "../components/DataTable";
import { PaginationBar } from "../components/PaginationBar";

const pageSize = 20;

type PrincipalForm = {
  adminId: string;
  displayName: string;
  disabled: boolean;
};

const emptyForm: PrincipalForm = {
  adminId: "",
  displayName: "",
  disabled: false
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function principalStatus(principal: AdminPrincipal) {
  if (principal.disabledAt) {
    return <span className="status danger">已停用</span>;
  }
  return <span className="status success">可选择</span>;
}

const roleLabels: Record<AdminRole, string> = {
  super_admin: "超级管理员",
  reviewer: "审核员",
  operator: "运营"
};

function adminOptionLabel(admin: AdminAccountSummary): string {
  const disabled = admin.disabledAt ? " / 已停用" : "";
  return `${admin.username}（ID：${admin.id} / ${roleLabels[admin.role]}${disabled}）`;
}

function saveErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "保存主理人失败";
  }
  if (error.message === "Principal admin user is invalid") {
    return "请选择有效的后台登录用户";
  }
  if (error.message === "adminId and displayName are required") {
    return "请选择后台登录用户并填写主理人名称";
  }
  return error.message || "保存主理人失败";
}

export function PrincipalManagementPage() {
  const [principals, setPrincipals] = useState<AdminPrincipal[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminAccountSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<PrincipalForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPrincipals(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const [principalResponse, adminUserResponse] = await Promise.all([
        adminGet<AdminPrincipalListResponse>(`/admin/principals?page=${nextPage}&pageSize=${pageSize}`),
        adminGet<AdminAccountListResponse>("/admin/admin-users?page=1&pageSize=100")
      ]);
      setPrincipals(principalResponse.items);
      setTotal(principalResponse.total);
      setPage(principalResponse.page);
      setAdminUsers(adminUserResponse.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载主理人失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPrincipals(1);
  }, []);

  function updateForm<K extends keyof PrincipalForm>(key: K, value: PrincipalForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function editPrincipal(principal: AdminPrincipal) {
    setForm({
      adminId: principal.adminId,
      displayName: principal.displayName,
      disabled: principal.disabledAt !== null
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.adminId || !form.displayName.trim()) {
      setError("请选择后台登录用户并填写主理人名称");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminPost<AdminPrincipalActionResponse>("/admin/principals", form);
      setForm(emptyForm);
      await loadPrincipals(page);
    } catch (saveError) {
      setError(saveErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-section">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>主理人管理</h3>
            <p>把主理人绑定到后台登录用户；非超级管理员只能处理自己绑定主理人的资产和举报。</p>
          </div>
          <button className="primary-button" disabled={loading} onClick={() => void loadPrincipals(page)} type="button">
            刷新
          </button>
        </div>
        {error ? <p className="notice danger">{error}</p> : null}
        <form className="principal-form" onSubmit={submit}>
          <label>
            后台登录用户
            <select
              disabled={loading || saving}
              onChange={(event) => updateForm("adminId", event.target.value)}
              required
              value={form.adminId}
            >
              <option value="">请选择后台登录用户</option>
              {adminUsers.map((admin) => (
                <option disabled={admin.disabledAt !== null} key={admin.id} value={admin.id}>
                  {adminOptionLabel(admin)}
                </option>
              ))}
            </select>
          </label>
          <label>
            主理人名称
            <input
              disabled={saving}
              onChange={(event) => updateForm("displayName", event.target.value)}
              placeholder="小程序发布页展示的名称"
              required
              value={form.displayName}
            />
          </label>
          <label className="checkbox-label">
            <input checked={form.disabled} onChange={(event) => updateForm("disabled", event.target.checked)} type="checkbox" />
            停用
          </label>
          <div className="filter-actions">
            <button className="primary-button" disabled={saving} type="submit">
              保存
            </button>
            <button className="ghost-button" disabled={saving} onClick={() => setForm(emptyForm)} type="button">
              清空
            </button>
          </div>
        </form>
        <DataTable
          columns={[
            { key: "id", label: "主理人ID" },
            { key: "displayName", label: "名称" },
            { key: "admin", label: "后台用户" },
            { key: "status", label: "状态" },
            { key: "updatedAt", label: "更新时间" },
            { key: "actions", label: "操作", align: "center" }
          ]}
          emptyText={loading ? "正在加载..." : "暂无主理人"}
          getRowKey={(row) => row.id}
          rows={principals}
          renderCell={(row, column) => {
            if (column.key === "admin") {
              return `${row.username || "未知用户"}（ID：${row.adminId}）`;
            }
            if (column.key === "status") {
              return principalStatus(row);
            }
            if (column.key === "updatedAt") {
              return formatTime(row.updatedAt);
            }
            if (column.key === "actions") {
              return (
                <div className="inline-actions">
                  <button onClick={() => editPrincipal(row)} type="button">
                    编辑
                  </button>
                </div>
              );
            }
            return row[column.key as keyof AdminPrincipal] as string;
          }}
        />
        <PaginationBar loading={loading} onPageChange={(nextPage) => void loadPrincipals(nextPage)} page={page} pageSize={pageSize} total={total} />
      </div>
    </section>
  );
}
