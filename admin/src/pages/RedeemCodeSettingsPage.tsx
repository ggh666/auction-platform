import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  parseRedeemCodeText,
  type RedeemCodeConfigResponse,
  type RedeemCodeItem
} from "@auction/shared";
import { adminGet, adminPut } from "../api/client";
import { DataTable } from "../components/DataTable";

function formatTime(value: string | null): string {
  if (!value) {
    return "尚未保存";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function parsePreview(rawText: string): { items: RedeemCodeItem[]; error: string | null } {
  try {
    return { items: parseRedeemCodeText(rawText), error: null };
  } catch (error) {
    return { items: [], error: error instanceof Error ? error.message : "兑换码格式有误" };
  }
}

export function RedeemCodeSettingsPage() {
  const [rawText, setRawText] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const preview = useMemo(() => parsePreview(rawText), [rawText]);

  async function loadConfig() {
    setLoading(true);
    setError(null);
    try {
      const response = await adminGet<RedeemCodeConfigResponse>("/admin/redeem-codes/config");
      setRawText(response.rawText);
      setUpdatedAt(response.updatedAt);
      setUpdatedBy(response.updatedBy);
      setNotice(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载兑换码设置失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfig();
  }, []);

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await adminPut<RedeemCodeConfigResponse>("/admin/redeem-codes/config", { rawText });
      setRawText(response.rawText);
      setUpdatedAt(response.updatedAt);
      setUpdatedBy(response.updatedBy);
      setNotice("兑换码设置已保存。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存兑换码设置失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-section">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>兑换码设置</h3>
            <p>按行维护小程序攻略页展示的兑换码，格式为「兑换码|奖励说明|效期」。</p>
          </div>
          <button className="ghost-button" disabled={loading || saving} onClick={() => void loadConfig()} type="button">
            刷新
          </button>
        </div>

        {error ? <p className="notice danger">{error}</p> : null}
        {notice ? <p className="notice success">{notice}</p> : null}

        <form className="redeem-code-settings" onSubmit={saveConfig}>
          <div className="price-reference-import">
            <div>
              <h4>批量文本</h4>
              <p>每行一条：兑换码|奖励说明|效期。空行会被忽略，效期只展示不自动下线。</p>
            </div>
            <textarea
              disabled={loading || saving}
              onChange={(event) => setRawText(event.target.value)}
              placeholder={`兑换码|奖励说明|效期\nTFJL520|随机金卡|永久`}
              rows={10}
              value={rawText}
            />
            <div className="form-actions">
              <button className="primary-button" disabled={loading || saving || Boolean(preview.error)} type="submit">
                保存设置
              </button>
            </div>
          </div>

          <div className="panel-subheading">
            <div>
              <h4>解析预览</h4>
              <p>
                当前共 {preview.items.length} 条；更新时间：{formatTime(updatedAt)}
                {updatedBy === null ? "" : `；更新人 ${updatedBy}`}
              </p>
            </div>
          </div>

          {preview.error ? <p className="notice danger">{preview.error}</p> : null}
          <DataTable
            columns={[
              { key: "code", label: "兑换码" },
              { key: "description", label: "奖励说明" },
              { key: "validity", label: "效期" }
            ]}
            emptyText={loading ? "正在加载..." : "暂无兑换码"}
            getRowKey={(row) => row.code}
            rows={preview.items}
            renderCell={(row, column) => row[column.key as keyof RedeemCodeItem]}
          />
        </form>
      </div>
    </section>
  );
}
