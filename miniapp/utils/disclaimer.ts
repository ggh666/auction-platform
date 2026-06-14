export const TRADING_DISCLAIMER_MESSAGE =
  "本平台仅提供信息交换，不涉及任何线上资金交易，请务必走游戏内安全交易渠道，线下转账风险自担";

type ShowModal = (options: UniApp.ShowModalOptions) => void;

export function confirmTradingDisclaimer(showModal: ShowModal = uni.showModal): Promise<boolean> {
  return new Promise((resolve) => {
    showModal({
      title: "风险提示",
      content: TRADING_DISCLAIMER_MESSAGE,
      confirmText: "我已知晓",
      cancelText: "取消",
      success(result) {
        resolve(Boolean(result.confirm));
      },
      fail() {
        resolve(false);
      }
    });
  });
}
