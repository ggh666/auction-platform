import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  dragonBallProfessionOptions,
  dragonBallQualityOptions,
  type AdminAssetCopyDraft,
  type AuctionAsset,
  type PrincipalSummary
} from "@auction/shared";
import { adminGet, adminPost } from "../api/client";

type UploadedAdminImage = AdminAssetCopyDraft["images"][number] & {
  safetyStatus?: string;
  safetyTraceId?: string | null;
};

type AssetPublishContextResponse = {
  principals: PrincipalSummary[];
  defaultEndAt: string;
};

type AssetActionResponse = {
  asset: AuctionAsset;
};

type PublishFormState = {
  principalId: string;
  gameName: string;
  sellerGameId: string;
  serverName: string;
  assetType: "账号" | "道具";
  itemCategory: "" | "龙珠";
  title: string;
  description: string;
  startingPriceYuan: string;
  minIncrementYuan: string;
  endAt: string;
  dragonBallProfession: string;
  dragonBallQuality: string;
  dragonBallAttributes: string;
};

type AssetPublishPageProps = {
  copyDraft?: AdminAssetCopyDraft | null;
  onOpenAsset: (assetId: string) => void;
};

const publishAssetTypeOptions: Array<{ value: PublishFormState["assetType"]; label: string }> = [
  { value: "账号", label: "账号" },
  { value: "道具", label: "道具" }
];

function padTimePart(value: number): string {
  return String(value).padStart(2, "0");
}

function toDatetimeLocalValue(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())}T${padTimePart(
    date.getHours()
  )}:${padTimePart(date.getMinutes())}`;
}

function datetimeLocalToIso(value: string): string {
  const date = new Date(value);
  return date.toISOString();
}

function defaultEndAtIso(): string {
  return new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
}

function createEmptyPublishForm(defaultEndAt = defaultEndAtIso(), principalId = ""): PublishFormState {
  return {
    principalId,
    gameName: "塔防精灵",
    sellerGameId: "",
    serverName: "",
    assetType: "账号",
    itemCategory: "",
    title: "",
    description: "",
    startingPriceYuan: "100",
    minIncrementYuan: "1",
    endAt: toDatetimeLocalValue(defaultEndAt),
    dragonBallProfession: dragonBallProfessionOptions[0],
    dragonBallQuality: dragonBallQualityOptions[3],
    dragonBallAttributes: "附加伤害+0%，无视冰甲+0%"
  };
}

function normalizeDraftAssetType(assetType: string): PublishFormState["assetType"] {
  return assetType === "道具" || assetType === "装备" ? "道具" : "账号";
}

function centsToWholeYuanInput(cents: number): string {
  return String(Math.floor(cents / 100));
}

function createPublishFormFromCopyDraft(
  copyDraft: AdminAssetCopyDraft,
  defaultEndAt: string,
  fallbackPrincipalId: string
): PublishFormState {
  const assetType = normalizeDraftAssetType(copyDraft.assetType);
  const dragonBall = copyDraft.dragonBall;
  return {
    principalId: copyDraft.principalId ?? fallbackPrincipalId,
    gameName: copyDraft.gameName,
    sellerGameId: copyDraft.sellerGameId,
    serverName: copyDraft.serverName,
    assetType,
    itemCategory: assetType === "道具" && copyDraft.itemCategory === "龙珠" ? "龙珠" : "",
    title: copyDraft.title,
    description: copyDraft.description,
    startingPriceYuan: centsToWholeYuanInput(copyDraft.startingPriceCents),
    minIncrementYuan: centsToWholeYuanInput(copyDraft.minIncrementCents),
    endAt: toDatetimeLocalValue(defaultEndAt),
    dragonBallProfession: dragonBall?.profession ?? dragonBallProfessionOptions[0],
    dragonBallQuality: dragonBall?.quality ?? dragonBallQualityOptions[3],
    dragonBallAttributes: dragonBall?.attributes ?? "附加伤害+0%，无视冰甲+0%"
  };
}

function wholeYuanInputToCents(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return Number.NaN;
  }
  return Number(trimmed) * 100;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",").pop() ?? "" : result);
    };
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function formatImageSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AssetPublishPage({ copyDraft = null, onOpenAsset }: AssetPublishPageProps) {
  const [publishContext, setPublishContext] = useState<AssetPublishContextResponse | null>(null);
  const [publishForm, setPublishForm] = useState<PublishFormState>(() => createEmptyPublishForm());
  const [publishImages, setPublishImages] = useState<UploadedAdminImage[]>([]);
  const [publishedAsset, setPublishedAsset] = useState<AuctionAsset | null>(null);
  const [copySourceAssetId, setCopySourceAssetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPrincipal = useMemo(
    () => publishContext?.principals.find((principal) => principal.id === publishForm.principalId) ?? null,
    [publishContext, publishForm.principalId]
  );

  async function loadPublishContext() {
    setLoading(true);
    setError(null);
    try {
      const context = await adminGet<AssetPublishContextResponse>("/admin/asset-publish-context");
      const principalId = context.principals[0]?.id ?? "";
      setPublishContext(context);
      if (copyDraft) {
        const copyPrincipalId = context.principals.some((principal) => principal.id === copyDraft.principalId)
          ? copyDraft.principalId
          : principalId;
        setPublishForm(createPublishFormFromCopyDraft({ ...copyDraft, principalId: copyPrincipalId }, context.defaultEndAt, principalId));
        setPublishImages(copyDraft.images.map((image) => ({ ...image })));
        setCopySourceAssetId(copyDraft.sourceAssetId);
        setMessage(`已复制资产 ${copyDraft.sourceAssetId}，请确认截止时间后发布为新资产。`);
      } else {
        setPublishForm(createEmptyPublishForm(context.defaultEndAt, principalId));
        setPublishImages([]);
        setCopySourceAssetId(null);
      }
      setPublishedAsset(null);
    } catch (contextError) {
      setError(contextError instanceof Error ? contextError.message : "加载发布配置失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPublishContext();
  }, [copyDraft?.sourceAssetId]);

  function updatePublishForm<K extends keyof PublishFormState>(key: K, value: PublishFormState[K]) {
    setPublishForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "assetType" && value === "账号") {
        next.itemCategory = "";
      }
      return next;
    });
  }

  async function uploadPublishImages(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    setImageUploading(true);
    setMessage(null);
    setError(null);
    try {
      const uploadedImages: UploadedAdminImage[] = [];
      for (const file of Array.from(files)) {
        const base64Data = await fileToBase64(file);
        const response = await adminPost<{ image: UploadedAdminImage }>("/admin/images", {
          assetType: publishForm.assetType,
          fileName: file.name,
          mimeType: file.type,
          base64Data
        });
        uploadedImages.push(response.image);
      }
      setPublishImages((current) => [...current, ...uploadedImages].slice(0, 9));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "上传图片失败");
    } finally {
      setImageUploading(false);
    }
  }

  function removePublishImage(objectKey: string) {
    setPublishImages((current) => current.filter((image) => image.objectKey !== objectKey));
  }

  function resetForm() {
    const principalId = publishForm.principalId || publishContext?.principals[0]?.id || "";
    setPublishForm(createEmptyPublishForm(defaultEndAtIso(), principalId));
    setPublishImages([]);
    setPublishedAsset(null);
    setCopySourceAssetId(null);
    setMessage(null);
    setError(null);
  }

  async function submitPublishForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const startingPriceCents = wholeYuanInputToCents(publishForm.startingPriceYuan);
      const minIncrementCents = wholeYuanInputToCents(publishForm.minIncrementYuan);
      const dragonBall =
        publishForm.assetType === "道具" && publishForm.itemCategory === "龙珠"
          ? {
              profession: publishForm.dragonBallProfession,
              quality: publishForm.dragonBallQuality,
              attributes: publishForm.dragonBallAttributes
            }
          : undefined;
      const response = await adminPost<AssetActionResponse>("/admin/assets", {
        principalId: publishForm.principalId || undefined,
        gameName: publishForm.gameName,
        sellerGameId: publishForm.sellerGameId,
        serverName: publishForm.serverName,
        assetType: publishForm.assetType,
        itemCategory: publishForm.assetType === "道具" ? publishForm.itemCategory || undefined : undefined,
        dragonBall,
        title: publishForm.title,
        description: publishForm.description,
        startingPriceCents,
        minIncrementCents,
        endAt: datetimeLocalToIso(publishForm.endAt),
        images: publishImages
      });

      setPublishedAsset(response.asset);
      setMessage(`发布成功，资产编号 ${response.asset.id}`);
      setPublishForm(createEmptyPublishForm(defaultEndAtIso(), publishForm.principalId));
      setPublishImages([]);
      setCopySourceAssetId(null);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "发布资产失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-section asset-publish-page">
      <div className="panel publish-page-heading">
        <div>
          <h3>{copySourceAssetId ? "复制资产" : "发布资产"}</h3>
          <p>{copySourceAssetId ? `已复制资产 ${copySourceAssetId}，可编辑后发布为新资产。` : "主理人受控发布，发布后直接进入前台交换列表。"}</p>
        </div>
        <div className="inline-actions">
          <button disabled={loading || submitting} onClick={() => void loadPublishContext()} type="button">
            重新加载
          </button>
          <button className="ghost-button" disabled={submitting} onClick={resetForm} type="button">
            清空表单
          </button>
        </div>
      </div>

      {message ? (
        <div className="notice success publish-result-notice">
          <span>{message}</span>
          {publishedAsset ? (
            <button className="link-button" onClick={() => onOpenAsset(publishedAsset.id)} type="button">
              查看详情
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="notice danger">{error}</p> : null}

      {loading ? (
        <div className="panel empty-state">
          <strong>正在加载发布配置</strong>
          <span>请稍候</span>
        </div>
      ) : (
        <form className="asset-publish-form publish-workbench" onSubmit={submitPublishForm}>
          <div className="publish-main-column">
            <section className="publish-section">
              <div className="publish-section-heading">
                <span>01</span>
                <h4>基础信息</h4>
              </div>
              <div className="publish-field-grid">
                <label className="publish-field">
                  游戏
                  <input
                    onChange={(event) => updatePublishForm("gameName", event.target.value)}
                    required
                    value={publishForm.gameName}
                  />
                </label>
                <label className="publish-field">
                  类型
                  <select
                    onChange={(event) => updatePublishForm("assetType", event.target.value as PublishFormState["assetType"])}
                    value={publishForm.assetType}
                  >
                    {publishAssetTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="publish-field">
                  卖家游戏ID
                  <input
                    maxLength={80}
                    onChange={(event) => updatePublishForm("sellerGameId", event.target.value)}
                    required
                    value={publishForm.sellerGameId}
                  />
                </label>
                <label className="publish-field">
                  区服
                  <input
                    onChange={(event) => updatePublishForm("serverName", event.target.value)}
                    required
                    value={publishForm.serverName}
                  />
                </label>
                {publishForm.assetType === "道具" ? (
                  <label className="publish-field">
                    道具分类
                    <select
                      onChange={(event) => updatePublishForm("itemCategory", event.target.value as PublishFormState["itemCategory"])}
                      value={publishForm.itemCategory}
                    >
                      <option value="">普通道具</option>
                      <option value="龙珠">龙珠</option>
                    </select>
                  </label>
                ) : null}
              </div>
            </section>

            {publishForm.assetType === "道具" && publishForm.itemCategory === "龙珠" ? (
              <section className="publish-section">
                <div className="publish-section-heading">
                  <span>02</span>
                  <h4>龙珠属性</h4>
                </div>
                <div className="publish-field-grid">
                  <label className="publish-field">
                    职业
                    <select
                      onChange={(event) => updatePublishForm("dragonBallProfession", event.target.value)}
                      value={publishForm.dragonBallProfession}
                    >
                      {dragonBallProfessionOptions.map((profession) => (
                        <option key={profession} value={profession}>
                          {profession}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="publish-field">
                    品质
                    <select
                      onChange={(event) => updatePublishForm("dragonBallQuality", event.target.value)}
                      value={publishForm.dragonBallQuality}
                    >
                      {dragonBallQualityOptions.map((quality) => (
                        <option key={quality} value={quality}>
                          {quality}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="publish-field full-field">
                    属性
                    <input
                      onChange={(event) => updatePublishForm("dragonBallAttributes", event.target.value)}
                      required
                      value={publishForm.dragonBallAttributes}
                    />
                  </label>
                </div>
              </section>
            ) : null}

            <section className="publish-section">
              <div className="publish-section-heading">
                <span>{publishForm.assetType === "道具" && publishForm.itemCategory === "龙珠" ? "03" : "02"}</span>
                <h4>价格与时间</h4>
              </div>
              <div className="publish-field-grid">
                <label className="publish-field">
                  起估价
                  <input
                    inputMode="numeric"
                    min="1"
                    onChange={(event) => updatePublishForm("startingPriceYuan", event.target.value)}
                    pattern="[0-9]+"
                    required
                    type="number"
                    value={publishForm.startingPriceYuan}
                  />
                </label>
                <label className="publish-field">
                  最低加价
                  <input
                    inputMode="numeric"
                    min="1"
                    onChange={(event) => updatePublishForm("minIncrementYuan", event.target.value)}
                    pattern="[0-9]+"
                    required
                    type="number"
                    value={publishForm.minIncrementYuan}
                  />
                </label>
                <label className="publish-field full-field">
                  截止时间
                  <input
                    onChange={(event) => updatePublishForm("endAt", event.target.value)}
                    required
                    type="datetime-local"
                    value={publishForm.endAt}
                  />
                </label>
              </div>
            </section>

            <section className="publish-section">
              <div className="publish-section-heading">
                <span>{publishForm.assetType === "道具" && publishForm.itemCategory === "龙珠" ? "04" : "03"}</span>
                <h4>展示内容</h4>
              </div>
              <div className="publish-field-grid">
                <label className="publish-field full-field">
                  标题
                  <input
                    maxLength={80}
                    onChange={(event) => updatePublishForm("title", event.target.value)}
                    required
                    value={publishForm.title}
                  />
                </label>
                <label className="publish-field full-field">
                  描述
                  <textarea
                    maxLength={1000}
                    onChange={(event) => updatePublishForm("description", event.target.value)}
                    required
                    rows={7}
                    value={publishForm.description}
                  />
                </label>
              </div>
            </section>
          </div>

          <aside className="publish-side-column">
            <section className="publish-section publish-side-section">
              <div className="publish-section-heading">
                <span>归属</span>
                <h4>主理人</h4>
              </div>
              {publishContext && publishContext.principals.length > 1 ? (
                <label className="publish-field">
                  主理人
                  <select
                    onChange={(event) => updatePublishForm("principalId", event.target.value)}
                    required
                    value={publishForm.principalId}
                  >
                    {publishContext.principals.map((principal) => (
                      <option key={principal.id} value={principal.id}>
                        {principal.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="principal-readonly">
                  <span>{selectedPrincipal?.displayName ?? "暂无可用主理人"}</span>
                  <strong>{selectedPrincipal ? "当前发布归属" : "请先配置主理人"}</strong>
                </div>
              )}
            </section>

            <section className="publish-section publish-side-section">
              <div className="publish-section-heading">
                <span>{publishImages.length}/9</span>
                <h4>图片</h4>
              </div>
                <label className={`image-upload-zone ${imageUploading || publishImages.length >= 9 ? "disabled" : ""}`}>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  disabled={imageUploading || publishImages.length >= 9}
                  multiple
                  onChange={(event) => {
                    void uploadPublishImages(event.target.files);
                    event.currentTarget.value = "";
                  }}
                  type="file"
                />
                <span>{imageUploading ? "上传中" : "选择图片"}</span>
                <strong>JPG / PNG / WebP，最多 9 张</strong>
              </label>
              {publishImages.length > 0 ? (
                <div className="uploaded-image-list">
                  {publishImages.map((image) => (
                    <div className="uploaded-image-card" key={image.objectKey}>
                      <img alt="已上传资产图" src={image.publicUrl} />
                      <div>
                        <span>{formatImageSize(image.sizeBytes)}</span>
                        <button onClick={() => removePublishImage(image.objectKey)} type="button">
                          移除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <div className="publish-submit-panel">
              <button
                className="primary-button"
                disabled={submitting || imageUploading || Boolean(publishContext && publishContext.principals.length === 0)}
                type="submit"
              >
                {submitting ? "发布中" : "确认发布"}
              </button>
              <button className="ghost-button" disabled={submitting} onClick={resetForm} type="button">
                取消
              </button>
            </div>
          </aside>
        </form>
      )}
    </section>
  );
}
