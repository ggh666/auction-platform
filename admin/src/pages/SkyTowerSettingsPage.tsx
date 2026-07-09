import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  parseSkyTowerConfigText,
  type SkyTowerConfigResponse,
  type SkyTowerFloorOverride,
  type SkyTowerHeroQuality
} from "@auction/shared";
import { adminGet, adminPut } from "../api/client";
import { DataTable } from "../components/DataTable";

const formatExample = `楼层|阵容说明|左侧战车|右侧战车|英雄位|战术备注
1|战车属性：生命+10%；五战双狂将，需要纯粹或者伤害减免|左侧战车|右侧战车|左1:亡将-6:orange;左2:斧客-6:orange;右1:刀客-6:green;右2:钢鬃-6:green|58秒满狂将`;

const qualityLabels: Record<SkyTowerHeroQuality, string> = {
  yellow: "黄色",
  green: "绿色",
  orange: "橙色",
  unknown: "未标注"
};

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

function parsePreview(rawText: string): { items: SkyTowerFloorOverride[]; error: string | null } {
  try {
    return { items: parseSkyTowerConfigText(rawText), error: null };
  } catch (error) {
    return { items: [], error: error instanceof Error ? error.message : "天空塔设置格式有误" };
  }
}

function formatList(items: readonly string[]): string {
  return items.join("、");
}

function renderHeroSlots(row: SkyTowerFloorOverride): ReactNode {
  return row.heroSlots.map((slot) => `${slot.position}:${slot.name}:${qualityLabels[slot.quality]}`).join("；");
}

function renderPreviewCell(row: SkyTowerFloorOverride, key: string): ReactNode {
  if (key === "floor") {
    return `${row.floor} 层`;
  }
  if (key === "formationSummary") {
    return row.formationSummary;
  }
  if (key === "frontChariot") {
    return formatList(row.frontChariot);
  }
  if (key === "backChariot") {
    return formatList(row.backChariot);
  }
  if (key === "heroSlots") {
    return renderHeroSlots(row);
  }
  if (key === "tactics") {
    return formatList(row.tactics);
  }
  return "";
}

export function SkyTowerSettingsPage() {
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
      const response = await adminGet<SkyTowerConfigResponse>("/admin/sky-tower/config");
      setRawText(response.rawText);
      setUpdatedAt(response.updatedAt);
      setUpdatedBy(response.updatedBy);
      setNotice(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载天空塔设置失败");
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
      const response = await adminPut<SkyTowerConfigResponse>("/admin/sky-tower/config", { rawText });
      setRawText(response.rawText);
      setUpdatedAt(response.updatedAt);
      setUpdatedBy(response.updatedBy);
      setNotice("天空塔设置已保存。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存天空塔设置失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-section">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>天空塔设置</h3>
            <p>补充小程序攻略页展示的楼层阵容、左右战车、英雄位和战术备注。未配置楼层会继续展示默认占位。</p>
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
              <p>每行一层：楼层|阵容说明|左侧战车|右侧战车|英雄位|战术备注。空行会被忽略，重复楼层会被拦截。</p>
            </div>
            <textarea
              disabled={loading || saving}
              onChange={(event) => setRawText(event.target.value)}
              placeholder={formatExample}
              rows={14}
              value={rawText}
            />
            <p className="form-hint">
              英雄位格式为「位置:英雄:品质」，多项用分号分隔；品质可填 yellow、green、orange、unknown。
            </p>
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
                当前共 {preview.items.length} 层已配置；更新时间：{formatTime(updatedAt)}
                {updatedBy === null ? "" : `；更新人 ${updatedBy}`}
              </p>
            </div>
          </div>

          {preview.error ? <p className="notice danger">{preview.error}</p> : null}
          <DataTable
            columns={[
              { key: "floor", label: "楼层" },
              { key: "formationSummary", label: "阵容说明" },
              { key: "frontChariot", label: "左侧战车" },
              { key: "backChariot", label: "右侧战车" },
              { key: "heroSlots", label: "英雄位" },
              { key: "tactics", label: "战术备注" }
            ]}
            emptyText={loading ? "正在加载..." : "暂无天空塔配置"}
            getRowKey={(row) => String(row.floor)}
            rows={preview.items}
            renderCell={(row, column) => renderPreviewCell(row, column.key)}
          />
        </form>
      </div>
    </section>
  );
}
