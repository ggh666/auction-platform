import { useEffect, useState, type FormEvent } from "react";
import type {
  AnchorRecommendation,
  AnchorRecommendationListResponse,
  AnchorRecommendationResponse,
  AnchorRecommendationUpsertRequest
} from "@auction/shared";
import { adminDelete, adminGet, adminPost, adminPut } from "../api/client";
import { DataTable } from "../components/DataTable";

type AnchorForm = {
  id: string | null;
  name: string;
  intro: string;
  imageUrl: string;
};

const emptyForm: AnchorForm = {
  id: null,
  name: "",
  intro: "",
  imageUrl: ""
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

function toPayload(form: AnchorForm): AnchorRecommendationUpsertRequest {
  return {
    name: form.name.trim(),
    intro: form.intro.trim(),
    imageUrl: form.imageUrl.trim()
  };
}

export function AnchorRecommendationPage() {
  const [anchors, setAnchors] = useState<AnchorRecommendation[]>([]);
  const [form, setForm] = useState<AnchorForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadAnchors() {
    setLoading(true);
    setError(null);
    try {
      const response = await adminGet<AnchorRecommendationListResponse>("/admin/anchor-recommendations");
      setAnchors(response.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载主播推荐失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnchors();
  }, []);

  function updateForm<K extends keyof AnchorForm>(key: K, value: AnchorForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function editAnchor(anchor: AnchorRecommendation) {
    setForm({
      id: anchor.id,
      name: anchor.name,
      intro: anchor.intro,
      imageUrl: anchor.imageUrl
    });
    setNotice(null);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = toPayload(form);
    if (!payload.name || !payload.intro || !payload.imageUrl) {
      setError("请填写主播名称、简介和图片链接地址");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (form.id) {
        await adminPut<AnchorRecommendationResponse>(`/admin/anchor-recommendations/${form.id}`, payload);
        setNotice("主播推荐已更新。");
      } else {
        await adminPost<AnchorRecommendationResponse>("/admin/anchor-recommendations", payload);
        setNotice("主播推荐已新增。");
      }
      setForm(emptyForm);
      await loadAnchors();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存主播推荐失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAnchor(anchor: AnchorRecommendation) {
    if (!window.confirm(`确定删除主播推荐「${anchor.name}」吗？`)) {
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await adminDelete<{ ok: true }>(`/admin/anchor-recommendations/${anchor.id}`);
      if (form.id === anchor.id) {
        setForm(emptyForm);
      }
      setNotice("主播推荐已删除。");
      await loadAnchors();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除主播推荐失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-section">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>主播推荐</h3>
            <p>维护小程序资源入口展示的主播推荐信息，图片使用外部链接地址。</p>
          </div>
          <button className="primary-button" disabled={loading || saving} onClick={() => void loadAnchors()} type="button">
            刷新
          </button>
        </div>

        {error ? <p className="notice danger">{error}</p> : null}
        {notice ? <p className="notice success">{notice}</p> : null}

        <form className="principal-form anchor-form" onSubmit={submit}>
          <label>
            主播名称
            <input
              disabled={saving}
              maxLength={80}
              onChange={(event) => updateForm("name", event.target.value)}
              placeholder="例如：阿塔直播间"
              required
              value={form.name}
            />
          </label>
          <label>
            图片链接地址
            <input
              disabled={saving}
              maxLength={1000}
              onChange={(event) => updateForm("imageUrl", event.target.value)}
              placeholder="https://example.com/anchor.png"
              required
              type="url"
              value={form.imageUrl}
            />
          </label>
          <label>
            简介
            <textarea
              disabled={saving}
              maxLength={500}
              onChange={(event) => updateForm("intro", event.target.value)}
              placeholder="主播内容、擅长方向或推荐理由"
              required
              rows={3}
              value={form.intro}
            />
          </label>
          <div className="filter-actions">
            <button className="primary-button" disabled={saving} type="submit">
              {form.id ? "保存修改" : "新增主播"}
            </button>
            <button className="ghost-button" disabled={saving} onClick={() => setForm(emptyForm)} type="button">
              清空
            </button>
          </div>
        </form>

        <DataTable
          columns={[
            { key: "image", label: "图片" },
            { key: "name", label: "主播名称" },
            { key: "intro", label: "简介" },
            { key: "updatedAt", label: "更新时间" },
            { key: "actions", label: "操作", align: "center" }
          ]}
          emptyText={loading ? "正在加载..." : "暂无主播推荐"}
          getRowKey={(row) => row.id}
          rows={anchors}
          renderCell={(row, column) => {
            if (column.key === "image") {
              return <img alt={`${row.name} 图片`} className="exchange-resource-thumbnail" src={row.imageUrl} />;
            }
            if (column.key === "intro") {
              return (
                <div className="stacked-cell">
                  <strong>{row.intro}</strong>
                  <span>{row.imageUrl}</span>
                </div>
              );
            }
            if (column.key === "updatedAt") {
              return formatTime(row.updatedAt);
            }
            if (column.key === "actions") {
              return (
                <div className="inline-actions">
                  <button disabled={saving} onClick={() => editAnchor(row)} type="button">
                    编辑
                  </button>
                  <button disabled={saving} onClick={() => void deleteAnchor(row)} type="button">
                    删除
                  </button>
                </div>
              );
            }
            return row[column.key as keyof AnchorRecommendation] as string;
          }}
        />
      </div>
    </section>
  );
}
