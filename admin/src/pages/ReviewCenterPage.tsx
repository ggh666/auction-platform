import { useState } from "react";
import { AssetReviewPage } from "./AssetReviewPage";
import { ReportReviewPage } from "./ReportReviewPage";

type ReviewTab = "assets" | "reports";

type ReviewCenterPageProps = {
  onOpenAsset: (assetId: string) => void;
};

const tabs: Array<{ key: ReviewTab; label: string }> = [
  { key: "assets", label: "资产审核" },
  { key: "reports", label: "举报审核" }
];

export function ReviewCenterPage({ onOpenAsset }: ReviewCenterPageProps) {
  const [activeTab, setActiveTab] = useState<ReviewTab>("assets");

  return (
    <section className="page-section">
      <div className="section-tabs" role="tablist" aria-label="审核类型">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? "active" : ""}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "assets" ? <AssetReviewPage onOpenAsset={onOpenAsset} /> : <ReportReviewPage onOpenAsset={onOpenAsset} />}
    </section>
  );
}
