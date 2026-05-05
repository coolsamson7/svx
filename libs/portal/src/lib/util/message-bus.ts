export type Message<T = any> = {
  topic: string;
  message: string;
  payload?: T;
};

type Handler = (msg: Message) => void;

class MessageBus {
  private handlers = new Map<string, Set<Handler>>();

  subscribe(topic: string, handler: Handler): () => void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
    }
    this.handlers.get(topic)!.add(handler);
    return () => this.unsubscribe(topic, handler);
  }

  unsubscribe(topic: string, handler: Handler) {
    this.handlers.get(topic)?.delete(handler);
  }

  publish(msg: Message) {
    const subs = this.handlers.get(msg.topic);
    if (!subs) return;
    subs.forEach((h) => {
      try {
        h(msg);
      }
      catch (e) {
        console.warn("[MessageBus] handler error", e);
      }
    });
  }
}

export const messageBus = new MessageBus();
