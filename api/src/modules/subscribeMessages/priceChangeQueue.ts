import type { SubscribeMessageService } from "./subscribeMessage.service";
import type { UsersRepository } from "../users/users.repository";

type QueueLogger = {
  error(payload: unknown, message?: string): void;
};

export type PriceChangeQueueItem = {
  notificationId: string;
  userId: string;
  assetId: string;
  assetTitle: string;
  previousAmountCents: number;
  amountCents: number;
  actorDisplayName: string;
  changedAt: string;
};

export function createInProcessPriceChangeQueue(input: {
  users: Pick<UsersRepository, "findById">;
  subscribeMessages: SubscribeMessageService;
  log: QueueLogger;
}) {
  const queue: PriceChangeQueueItem[] = [];
  let processing = false;

  async function drain() {
    if (processing) {
      return;
    }
    processing = true;

    try {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) {
          continue;
        }
        try {
          const recipient = await input.users.findById(Number(item.userId));
          await input.subscribeMessages.sendPriceChange({
            touserOpenid: recipient?.openid ?? null,
            assetId: item.assetId,
            assetTitle: item.assetTitle,
            previousAmountCents: item.previousAmountCents,
            amountCents: item.amountCents,
            actorDisplayName: item.actorDisplayName,
            changedAt: item.changedAt
          });
        } catch (error) {
          input.log.error({ err: error, notificationId: item.notificationId }, "failed to send price change subscribe message");
        }
      }
    } finally {
      processing = false;
      if (queue.length > 0) {
        void drain();
      }
    }
  }

  return {
    enqueue(item: PriceChangeQueueItem): void {
      queue.push(item);
      void drain();
    }
  };
}
