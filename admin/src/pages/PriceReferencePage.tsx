import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  centsToYuanText,
  dragonBallPriceReferenceProfessionOptions,
  dragonBallQualityOptions,
  type DragonBallPriceReferenceBatch,
  type DragonBallPriceReferenceBatchListResponse,
  type DragonBallPriceReferenceBatchResponse,
  type DragonBallPriceReferenceBatchUpsertRequest
} from "@auction/shared";
import { adminDelete, adminGet, adminPost, adminPut } from "../api/client";
import { DataTable } from "../components/DataTable";
import { PaginationBar } from "../components/PaginationBar";
import { parsePriceReferenceImportText } from "./priceReferenceImport";

type PriceReferenceRow = {
  key: string;
  profession: string;
  quality: string;
  minPriceYuan: string;
  maxPriceYuan: string;
};

const pageSize = 12;
const integerYuanPattern = /^[1-9]\d*$/;

function currentWeekStartDate(): string {
  const now = new Date();
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  return monday.toISOString().slice(0, 10);
}

function buildEmptyRows(): PriceReferenceRow[] {
  return dragonBallQualityOptions.flatMap((quality) =>
    dragonBallPriceReferenceProfessionOptions.map((profession) => ({
      key: `${profession}-${quality}`,
      profession,
      quality,
      minPriceYuan: "",
      maxPriceYuan: ""
    }))
  );
}

function rowsFromBatch(batch: DragonBallPriceReferenceBatch | null): PriceReferenceRow[] {
  const rows = buildEmptyRows();
  if (!batch) {
    return rows;
  }
  return rows.map((row) => {
    const item = batch.items.find((candidate) => candidate.profession === row.profession && candidate.quality === row.quality);
    return item
      ? {
          ...row,
          minPriceYuan: centsToYuanText(item.minPriceCents),
          maxPriceYuan: centsToYuanText(item.maxPriceCents)
        }
      : row;
  });
}

function formatDateRange(batch: DragonBallPriceReferenceBatch): string {
  return `${batch.weekStartDate} 至 ${batch.weekEndDate}`;
}

function readYuanInput(value: string): number | null {
  const trimmed = value.trim();
  return integerYuanPattern.test(trimmed) ? Number(trimmed) : null;
}

export function PriceReferencePage() {
  const [batches, setBatches] = useState<DragonBallPriceReferenceBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<DragonBallPriceReferenceBatch | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [gameName, setGameName] = useState("塔防精灵");
  const [weekStartDate, setWeekStartDate] = useState(currentWeekStartDate);
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<PriceReferenceRow[]>(() => rowsFromBatch(null));
  const [importText, setImportText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedBatchId = selectedBatch?.id ?? null;
  const hasFilledRows = useMemo(
    () => rows.some((row) => row.minPriceYuan.trim() || row.maxPriceYuan.trim()),
    [rows]
  );

  async function loadBatches(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const response = await adminGet<DragonBallPriceReferenceBatchListResponse>(
        `/admin/dragon-ball-price-reference-batches?page=${nextPage}&pageSize=${pageSize}`
      );
      setBatches(response.items);
      setTotal(response.total);
      setPage(response.page);
      if (!selectedBatchId && response.items[0]) {
        selectBatch(response.items[0]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载估值参考失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBatches(1);
  }, []);

  function selectBatch(batch: DragonBallPriceReferenceBatch) {
    setSelectedBatch(batch);
    setGameName(batch.gameName);
    setWeekStartDate(batch.weekStartDate);
    setNote(batch.note);
    setRows(rowsFromBatch(batch));
    setNotice(null);
    setError(null);
  }

  function startNewBatch() {
    setSelectedBatch(null);
    setGameName("塔防精灵");
    setWeekStartDate(currentWeekStartDate());
    setNote("");
    setRows(rowsFromBatch(null));
    setNotice("正在新增周估值参考，保存后会覆盖同周同职业/品质的数据。");
    setError(null);
  }

  function copyBatchToCurrentWeek(batch: DragonBallPriceReferenceBatch) {
    setSelectedBatch(null);
    setGameName(batch.gameName);
    setWeekStartDate(currentWeekStartDate());
    setNote(`复制自 ${formatDateRange(batch)}`);
    setRows(rowsFromBatch(batch));
    setNotice(`已复制 ${formatDateRange(batch)} 的估值参考，请确认周开始日期后保存。`);
    setError(null);
  }

  function updateRow(rowKey: string, field: "minPriceYuan" | "maxPriceYuan", value: string) {
    setRows((current) => current.map((row) => (row.key === rowKey ? { ...row, [field]: value } : row)));
  }

  function handleImportText() {
    const result = parsePriceReferenceImportText(importText);
    if (result.errors.length > 0) {
      setError(`解析失败：${result.errors.slice(0, 5).join("；")}`);
      setNotice(null);
      return;
    }
    if (result.entries.length === 0) {
      setError("请粘贴职业、品质、低价数据。");
      setNotice(null);
      return;
    }

    const minPriceByRowKey = new Map(
      result.entries.map((entry) => [`${entry.profession}-${entry.quality}`, entry.minPriceYuan])
    );
    const currentRowKeys = new Set(rows.map((row) => row.key));
    const filledCount = result.entries.filter((entry) => currentRowKeys.has(`${entry.profession}-${entry.quality}`)).length;
    setRows((current) =>
      current.map((row) => {
        const minPriceYuan = minPriceByRowKey.get(row.key);
        if (!minPriceYuan) {
          return row;
        }
        return { ...row, minPriceYuan };
      })
    );
    setError(null);
    setNotice(`已解析 ${result.entries.length} 条数据，填入 ${filledCount} 条最低价；最高价请确认后填写。`);
  }

  function buildPayload(): DragonBallPriceReferenceBatchUpsertRequest {
    const items: DragonBallPriceReferenceBatchUpsertRequest["items"] = [];
    for (const row of rows) {
      const hasMin = row.minPriceYuan.trim().length > 0;
      const hasMax = row.maxPriceYuan.trim().length > 0;
      if (!hasMin && !hasMax) {
        continue;
      }
      const minPriceYuan = readYuanInput(row.minPriceYuan);
      const maxPriceYuan = readYuanInput(row.maxPriceYuan);
      if (minPriceYuan === null || maxPriceYuan === null) {
        throw new Error("最低价和最高价只支持正整数元宝");
      }
      if (minPriceYuan > maxPriceYuan) {
        throw new Error("最低价不能大于最高价");
      }
      items.push({
        profession: row.profession,
        quality: row.quality,
        minPriceCents: minPriceYuan * 100,
        maxPriceCents: maxPriceYuan * 100
      });
    }
    if (items.length === 0) {
      throw new Error("请至少填写一条估值参考");
    }
    return {
      gameName: gameName.trim(),
      weekStartDate,
      note: note.trim(),
      items
    };
  }

  async function saveBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = buildPayload();
      const response = selectedBatchId
        ? await adminPut<DragonBallPriceReferenceBatchResponse>(
            `/admin/dragon-ball-price-reference-batches/${selectedBatchId}`,
            payload
          )
        : await adminPost<DragonBallPriceReferenceBatchResponse>("/admin/dragon-ball-price-reference-batches", payload);
      selectBatch(response.batch);
      setNotice("估值参考已保存。");
      await loadBatches(1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存估值参考失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedBatch() {
    if (!selectedBatchId) {
      return;
    }
    if (!window.confirm("确定删除当前周估值参考？")) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminDelete<DragonBallPriceReferenceBatchResponse>(
        `/admin/dragon-ball-price-reference-batches/${selectedBatchId}`
      );
      startNewBatch();
      await loadBatches(1);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除估值参考失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-section">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>周估值参考</h3>
            <p>按周维护龙珠职业和品质的最低价、最高价，价格只支持正整数元宝。</p>
          </div>
          <div className="inline-actions">
            <button className="ghost-button" disabled={loading || saving} onClick={() => void loadBatches()} type="button">
              刷新
            </button>
            <button className="primary-button" disabled={saving} onClick={startNewBatch} type="button">
              新增本周
            </button>
          </div>
        </div>

        {error ? <p className="notice danger">{error}</p> : null}
        {notice ? <p className="notice success">{notice}</p> : null}

        <div className="price-reference-layout">
          <aside className="price-reference-batches">
            <DataTable
              columns={[
                { key: "week", label: "周次" },
                { key: "count", label: "条目" },
                { key: "actions", label: "操作", align: "center" }
              ]}
              emptyText={loading ? "正在加载..." : "暂无估值参考"}
              getRowKey={(row) => row.id}
              rows={batches}
              renderCell={(row, column) => {
                if (column.key === "week") {
                  return (
                    <button className="link-button" onClick={() => selectBatch(row)} type="button">
                      <strong>{formatDateRange(row)}</strong>
                      <span>{row.gameName}</span>
                    </button>
                  );
                }
                if (column.key === "actions") {
                  return (
                    <button className="ghost-button" disabled={saving} onClick={() => copyBatchToCurrentWeek(row)} type="button">
                      复制
                    </button>
                  );
                }
                return `${row.items.length} 条`;
              }}
            />
            <PaginationBar
              loading={loading}
              onPageChange={(nextPage) => void loadBatches(nextPage)}
              page={page}
              pageSize={pageSize}
              total={total}
            />
          </aside>

          <form className="price-reference-editor" onSubmit={saveBatch}>
            <div className="asset-filter-bar">
              <label>
                游戏
                <input maxLength={80} onChange={(event) => setGameName(event.target.value)} value={gameName} />
              </label>
              <label>
                周开始日期
                <input onChange={(event) => setWeekStartDate(event.target.value)} type="date" value={weekStartDate} />
              </label>
              <label>
                备注
                <input maxLength={200} onChange={(event) => setNote(event.target.value)} placeholder="可选" value={note} />
              </label>
            </div>

            {!hasFilledRows ? <p className="notice">请填写至少一组职业/品质的最低价和最高价。</p> : null}

            <div className="price-reference-import">
              <div>
                <h4>批量解析</h4>
                <p>粘贴职业、品质、低价三列数据，也支持“金色牧师 300”格式；解析后会填入对应最低价。</p>
              </div>
              <textarea
                onChange={(event) => setImportText(event.target.value)}
                placeholder={`职业,品质,低价\n牧师,蓝色,30\n金色牧师 300`}
                rows={5}
                value={importText}
              />
              <div className="inline-actions">
                <button className="ghost-button" disabled={saving} onClick={handleImportText} type="button">
                  解析并填入最低价
                </button>
              </div>
            </div>

            <DataTable
              columns={[
                { key: "profession", label: "职业" },
                { key: "quality", label: "品质" },
                { key: "min", label: "最低价" },
                { key: "max", label: "最高价" }
              ]}
              emptyText="暂无可录入行"
              getRowKey={(row) => row.key}
              rows={rows}
              renderCell={(row, column) => {
                if (column.key === "profession") {
                  return row.profession;
                }
                if (column.key === "quality") {
                  return `${row.quality}品质`;
                }
                if (column.key === "min") {
                  return (
                    <input
                      inputMode="numeric"
                      onChange={(event) => updateRow(row.key, "minPriceYuan", event.target.value)}
                      placeholder="最低价"
                      value={row.minPriceYuan}
                    />
                  );
                }
                return (
                  <input
                    inputMode="numeric"
                    onChange={(event) => updateRow(row.key, "maxPriceYuan", event.target.value)}
                    placeholder="最高价"
                    value={row.maxPriceYuan}
                  />
                );
              }}
            />

            <div className="form-actions">
              <button className="primary-button" disabled={saving} type="submit">
                保存估值参考
              </button>
              <button className="ghost-button" disabled={saving || !selectedBatchId} onClick={() => void deleteSelectedBatch()} type="button">
                删除当前周
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
