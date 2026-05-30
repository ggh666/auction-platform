import type { AuctionWsEvent } from "@auction/shared";

export type AuctionSubscriber = {
  send(event: AuctionWsEvent): void;
};

export class AuctionHub {
  private readonly subscribers = new Map<string, Set<AuctionSubscriber>>();

  subscribe(assetId: string, subscriber: AuctionSubscriber): () => void {
    const subscribers = this.subscribers.get(assetId) ?? new Set<AuctionSubscriber>();
    subscribers.add(subscriber);
    this.subscribers.set(assetId, subscribers);

    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        this.subscribers.delete(assetId);
      }
    };
  }

  publish(assetId: string, event: AuctionWsEvent): void {
    const subscribers = this.subscribers.get(assetId);
    if (!subscribers) {
      return;
    }

    for (const subscriber of subscribers) {
      try {
        subscriber.send(event);
      } catch {
        // Keep one broken subscriber from failing the bid request or blocking other subscribers.
      }
    }
  }
}
