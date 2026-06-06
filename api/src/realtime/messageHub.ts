import type { AssetMessageWsEvent } from "@auction/shared";

export type MessageSubscriber = {
  send(event: AssetMessageWsEvent): void;
};

export class MessageHub {
  private readonly userSubscribers = new Map<string, Set<MessageSubscriber>>();
  private readonly principalSubscribers = new Map<string, Set<MessageSubscriber>>();
  private readonly allAdminSubscribers = new Set<MessageSubscriber>();

  subscribeUser(userId: string, subscriber: MessageSubscriber): () => void {
    return subscribeToMap(this.userSubscribers, userId, subscriber);
  }

  subscribePrincipal(principalId: string, subscriber: MessageSubscriber): () => void {
    return subscribeToMap(this.principalSubscribers, principalId, subscriber);
  }

  subscribeAllAdmins(subscriber: MessageSubscriber): () => void {
    this.allAdminSubscribers.add(subscriber);
    return () => {
      this.allAdminSubscribers.delete(subscriber);
    };
  }

  publish(event: AssetMessageWsEvent): void {
    if ("userId" in event) {
      sendTo(this.userSubscribers.get(event.userId), event);
    }
    if ("principalId" in event && event.principalId) {
      sendTo(this.principalSubscribers.get(event.principalId), event);
    }
    sendTo(this.allAdminSubscribers, event);
  }
}

function subscribeToMap(map: Map<string, Set<MessageSubscriber>>, key: string, subscriber: MessageSubscriber): () => void {
  const subscribers = map.get(key) ?? new Set<MessageSubscriber>();
  subscribers.add(subscriber);
  map.set(key, subscribers);

  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      map.delete(key);
    }
  };
}

function sendTo(subscribers: Set<MessageSubscriber> | undefined, event: AssetMessageWsEvent): void {
  if (!subscribers) {
    return;
  }
  for (const subscriber of subscribers) {
    try {
      subscriber.send(event);
    } catch {
      // Keep one broken subscriber from blocking message delivery to other online recipients.
    }
  }
}
