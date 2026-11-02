import type { PluginOrder, PluginCard, CardButton } from "./index";
export interface ServerClient {
  events(
    after?: string,
  ): Promise<
    Array<{
      id: string;
      sequence: number;
      kind: string;
      payload: string;
      createdAt: number;
    }>
  >;
  orders: {
    create(input: {
      customerAuthorization: string;
      reference: string;
      title: string;
      asset: string;
      amount: string;
      expiresIn?: number;
    }): Promise<PluginOrder>;
    get(orderId: string): Promise<PluginOrder>;
  };
  cards: {
    send(input: {
      installationId: string;
      idempotencyKey: string;
      text: string;
      title?: string;
      status?: string;
      buttons?: CardButton[];
    }): Promise<PluginCard>;
    get(messageId: string): Promise<PluginCard>;
    update(
      messageId: string,
      patch: {
        idempotencyKey: string;
        expectedVersion: number;
        text?: string;
        title?: string;
        status?: string;
        buttons?: CardButton[];
      },
    ): Promise<PluginCard>;
  };
  notifications: {
    send(input: {
      subscriptionId: string;
      idempotencyKey: string;
      title: string;
      body: string;
      sceneId?: string;
      deliverAt?: number;
    }): Promise<unknown>;
    get(notificationId: string): Promise<unknown>;
  };
  files: { download(fileId: string): Promise<ArrayBuffer> };
  links: {
    create(input: {
      installationId?: string;
      path: string;
      params?: Record<string, string>;
      expiresIn?: number;
    }): Promise<{
      scene: {
        id: string;
        appId: string;
        groupId?: string;
        path: string;
        params: string;
        expiresAt: number;
      };
      url: string;
    }>;
  };
}
export function createServerClient(options: {
  apiKey: string;
  apiBase?: string;
  fetch?: typeof fetch;
}): ServerClient;
export function verifyWebhook(options: {
  secret: string;
  timestamp: string;
  eventId: string;
  signature: string;
  rawBody: Uint8Array;
  now?: number;
}): boolean;
