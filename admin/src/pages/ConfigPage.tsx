import { useEffect, useState } from "react";
import type { SystemConfig, SystemConfigActionResponse, SystemConfigListResponse } from "@auction/shared";
import { adminGet, adminPost } from "../api/client";
import { DataTable } from "../components/DataTable";
import { PaginationBar } from "../components/PaginationBar";

const pageSize = 20;

const configLabels: Record<string, { label: string; hint: string }> = {
  default_min_increment_cents: { label: "默认最低加价", hint: "单位：分，例如 100 表示 1 元" },
  extension_window_seconds: { label: "延时保护窗口", hint: "单位：秒，交换结束前进入保护窗口" },
  extension_duration_seconds: { label: "延时增加时长", hint: "单位：秒，保护窗口内出价后自动延长" },
  max_images_per_asset: { label: "单资产图片数", hint: "发布资产时允许上传的最大图片数量" },
  max_image_size_bytes: { label: "单张图片大小", hint: "单位：字节，例如 5242880 表示 5MB" },
  default_daily_publish_limit: { label: "默认每日发布次数", hint: "未单独设置用户时，每个用户每天可发布的资产数量" }
};

function configName(key: string): string {
  return configLabels[key]?.label ?? key;
}

function configHint(key: string): string {
  return configLabels[key]?.hint ?? "平台配置项";
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function ConfigPage() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadConfigs(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const response = await adminGet<SystemConfigListResponse>(`/admin/configs?page=${nextPage}&pageSize=${pageSize}`);
      setConfigs(response.items);
      setTotal(response.total);
      setPage(response.page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载系统配置失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfigs(1);
  }, []);

  function replaceConfig(config: SystemConfig) {
    setConfigs((current) => current.map((item) => (item.key === config.key ? config : item)));
  }

  async function updateConfig(config: SystemConfig) {
    const value = window.prompt(`请输入「${configName(config.key)}」的新值`, config.value)?.trim();
    if (value === undefined) {
      return;
    }

    setActingKey(config.key);
    setError(null);
    try {
      const response = await adminPost<SystemConfigActionResponse>(`/admin/configs/${config.key}`, { value });
      replaceConfig(response.config);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新配置失败");
    } finally {
      setActingKey(null);
    }
  }

  return (
    <section className="page-section">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>平台配置</h3>
            <p>读取并更新系统配置。配置变更会写入数据库，并在后端业务校验中即时生效。</p>
          </div>
          <button className="primary-button" disabled={loading} onClick={() => void loadConfigs(page)} type="button">
            刷新
          </button>
        </div>
        {error ? <p className="notice danger">{error}</p> : null}
        <DataTable
          columns={[
            { key: "name", label: "配置项" },
            { key: "key", label: "配置键" },
            { key: "value", label: "当前值" },
            { key: "updatedBy", label: "更新人" },
            { key: "updatedAt", label: "更新时间" },
            { key: "actions", label: "操作", align: "center" }
          ]}
          emptyText={loading ? "正在加载..." : "暂无配置数据"}
          getRowKey={(row) => row.key}
          rows={configs}
          renderCell={(row, column) => {
            if (column.key === "name") {
              return (
                <div className="stacked-cell">
                  <strong>{configName(row.key)}</strong>
                  <span>{configHint(row.key)}</span>
                </div>
              );
            }

            if (column.key === "updatedBy") {
              return row.updatedBy === null ? <span className="muted">系统初始化</span> : row.updatedBy;
            }

            if (column.key === "updatedAt") {
              return formatTime(row.updatedAt);
            }

            if (column.key === "actions") {
              return (
                <div className="inline-actions">
                  <button disabled={actingKey === row.key} onClick={() => void updateConfig(row)} type="button">
                    修改
                  </button>
                </div>
              );
            }

            return row[column.key as keyof SystemConfig] as string | number;
          }}
        />
        <PaginationBar loading={loading} onPageChange={(nextPage) => void loadConfigs(nextPage)} page={page} pageSize={pageSize} total={total} />
      </div>
    </section>
  );
}
