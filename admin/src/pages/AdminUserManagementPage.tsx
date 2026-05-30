import { useEffect, useState, type FormEvent } from "react";
import type {
  AdminAccountActionResponse,
  AdminAccountListResponse,
  AdminAccountSummary,
  AdminPrincipalActionResponse,
  AdminRole
} from "@auction/shared";
import { adminDelete, adminGet, adminPost } from "../api/client";
import { DataTable } from "../components/DataTable";
import { PaginationBar } from "../components/PaginationBar";

const pageSize = 20;

type AdminUserForm = {
  id: string;
  username: string;
  password: string;
  role: AdminRole;
  disabled: boolean;
  principalDisplayName: string;
};

const emptyForm: AdminUserForm = {
  id: "",
  username: "",
  password: "",
  role: "reviewer",
  disabled: false,
  principalDisplayName: ""
};

const roleLabels: Record<AdminRole, string> = {
  super_admin: "超级管理员",
  reviewer: "审核员",
  operator: "运营"
};

function adminStatus(admin: AdminAccountSummary) {
  if (admin.disabledAt) {
    return <span className="status danger">已停用</span>;
  }
  return <span className="status success">可登录</span>;
}

function adminErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "后台用户操作失败";
  }
  const messages: Record<string, string> = {
    "Admin username already exists": "后台登录名已存在",
    "Admin username must be 3-64 letters, numbers, dots, underscores or hyphens": "登录名仅支持 3-64 位字母、数字、点、下划线或中划线",
    "Admin password must be 8-128 characters": "密码长度必须是 8 到 128 位",
    "Admin role is invalid": "请选择有效角色",
    "Cannot disable or change role for current admin": "不能停用当前账号或修改当前账号角色",
    "At least one active super admin is required": "至少需要保留一个可登录的超级管理员",
    "Failed to fetch": "网络请求失败，请确认后台 API 可访问或刷新后重试"
  };
  return messages[error.message] ?? error.message;
}

type AdminUserManagementPageProps = {
  currentAdminId: string;
};

export function AdminUserManagementPage({ currentAdminId }: AdminUserManagementPageProps) {
  const [admins, setAdmins] = useState<AdminAccountSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<AdminUserForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const editing = form.id !== "";

  async function loadAdmins(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const response = await adminGet<AdminAccountListResponse>(`/admin/admin-users?page=${nextPage}&pageSize=${pageSize}`);
      setAdmins(response.items);
      setTotal(response.total);
      setPage(response.page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载后台用户失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAdmins(1);
  }, []);

  function updateForm<K extends keyof AdminUserForm>(key: K, value: AdminUserForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function editAdmin(admin: AdminAccountSummary) {
    setForm({
      id: admin.id,
      username: admin.username,
      password: "",
      role: admin.role,
      disabled: admin.disabledAt !== null,
      principalDisplayName: admin.principal?.displayName ?? ""
    });
  }

  async function savePrincipalBinding(admin: AdminAccountSummary) {
    const principalName = form.principalDisplayName.trim();
    if (!principalName && !admin.principal) {
      return;
    }
    await adminPost<AdminPrincipalActionResponse>("/admin/principals", {
      adminId: admin.id,
      displayName: principalName || admin.principal?.displayName || admin.username,
      disabled: admin.disabledAt !== null || !principalName
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const username = form.username.trim();
    if (!username) {
      setError("请填写后台登录名");
      return;
    }
    if (!editing && form.password.length < 8) {
      setError("新建后台用户需要填写至少 8 位密码");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        username,
        role: form.role,
        disabled: form.disabled,
        ...(!editing && form.password ? { password: form.password } : {})
      };
      const response = editing
        ? await adminPost<AdminAccountActionResponse>(`/admin/admin-users/${form.id}/update`, payload)
        : await adminPost<AdminAccountActionResponse>("/admin/admin-users", payload);
      await savePrincipalBinding(response.admin);
      setForm(emptyForm);
      setNotice(editing ? "后台用户基础信息已保存" : "后台用户已创建");
      await loadAdmins(editing ? page : 1);
    } catch (saveError) {
      setError(adminErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAdmin(admin: AdminAccountSummary) {
    setNotice(null);
    if (admin.id === currentAdminId) {
      setError("不能删除当前登录账号");
      return;
    }
    if (!window.confirm(`确认停用后台用户 ${admin.username}？停用后该账号无法登录，绑定主理人也会停用。`)) {
      return;
    }

    setActingId(admin.id);
    setError(null);
    try {
      await adminDelete<AdminAccountActionResponse>(`/admin/admin-users/${admin.id}`);
      if (form.id === admin.id) {
        setForm(emptyForm);
      }
      await loadAdmins(page);
    } catch (deleteError) {
      setError(adminErrorMessage(deleteError));
    } finally {
      setActingId(null);
    }
  }

  async function resetPassword(admin: AdminAccountSummary) {
    if (!window.confirm(`确认为后台用户 ${admin.username} 生成新的临时密码？旧密码会立即失效。`)) {
      return;
    }

    setActingId(admin.id);
    setError(null);
    setNotice(null);
    try {
      const response = await adminPost<AdminAccountActionResponse>(`/admin/admin-users/${admin.id}/reset-password`);
      const temporaryPassword = response.temporaryPassword ?? "";
      setNotice(`已为 ${admin.username} 生成临时密码：${temporaryPassword}`);
      window.alert(`后台用户 ${admin.username} 的临时密码：${temporaryPassword}`);
      await loadAdmins(page);
    } catch (resetError) {
      setError(adminErrorMessage(resetError));
    } finally {
      setActingId(null);
    }
  }

  return (
    <section className="page-section">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>后台用户管理</h3>
            <p>创建后台登录账号、设置角色权限，并把账号关联到主理人数据范围。</p>
          </div>
          <button className="primary-button" disabled={loading} onClick={() => void loadAdmins(page)} type="button">
            刷新
          </button>
        </div>
        {error ? <p className="notice danger">{error}</p> : null}
        {notice ? <p className="notice success">{notice}</p> : null}
        <form className="admin-user-form" onSubmit={submit}>
          <label>
            登录名
            <input
              disabled={saving}
              onChange={(event) => updateForm("username", event.target.value)}
              placeholder="例如 reviewer-a"
              required
              value={form.username}
            />
          </label>
          {!editing ? (
            <label>
              密码
              <input
                autoComplete="new-password"
                disabled={saving}
                onChange={(event) => updateForm("password", event.target.value)}
                placeholder="至少 8 位"
                type="password"
                value={form.password}
              />
            </label>
          ) : null}
          <label>
            角色权限
            <select disabled={saving} onChange={(event) => updateForm("role", event.target.value as AdminRole)} value={form.role}>
              <option value="reviewer">审核员</option>
              <option value="operator">运营</option>
              <option value="super_admin">超级管理员</option>
            </select>
          </label>
          <label>
            关联主理人
            <input
              disabled={saving}
              onChange={(event) => updateForm("principalDisplayName", event.target.value)}
              placeholder="留空表示不关联或停用主理人"
              value={form.principalDisplayName}
            />
          </label>
          <label className="checkbox-label">
            <input checked={form.disabled} onChange={(event) => updateForm("disabled", event.target.checked)} type="checkbox" />
            停用账号
          </label>
          <div className="filter-actions">
            <button className="primary-button" disabled={saving} type="submit">
              {editing ? "保存" : "创建"}
            </button>
            <button className="ghost-button" disabled={saving} onClick={() => setForm(emptyForm)} type="button">
              清空
            </button>
          </div>
        </form>
        <DataTable
          columns={[
            { key: "id", label: "ID" },
            { key: "username", label: "登录名" },
            { key: "role", label: "角色权限" },
            { key: "principal", label: "关联主理人" },
            { key: "status", label: "状态" },
            { key: "actions", label: "操作", align: "center" }
          ]}
          emptyText={loading ? "正在加载..." : "暂无后台用户"}
          getRowKey={(row) => row.id}
          rows={admins}
          renderCell={(row, column) => {
            if (column.key === "role") {
              return roleLabels[row.role];
            }
            if (column.key === "principal") {
              if (!row.principal) {
                return "未关联";
              }
              return row.principal.disabledAt ? `${row.principal.displayName}（已停用）` : row.principal.displayName;
            }
            if (column.key === "status") {
              return adminStatus(row);
            }
            if (column.key === "actions") {
              return (
                <div className="inline-actions">
                  <button disabled={actingId === row.id} onClick={() => editAdmin(row)} type="button">
                    编辑
                  </button>
                  <button disabled={actingId === row.id} onClick={() => void resetPassword(row)} type="button">
                    重置密码
                  </button>
                  <button disabled={actingId === row.id || row.id === currentAdminId} onClick={() => void deleteAdmin(row)} type="button">
                    删除
                  </button>
                </div>
              );
            }
            return row[column.key as keyof AdminAccountSummary] as string;
          }}
        />
        <PaginationBar loading={loading} onPageChange={(nextPage) => void loadAdmins(nextPage)} page={page} pageSize={pageSize} total={total} />
      </div>
    </section>
  );
}
