export type LegacyPermission =
  | "identity.login"
  | "wallet.request"
  | "group.context"
  | "chat.share"
  | "storage.read"
  | "storage.write"
  | "device.motion"
  | "device.vibrate"
  | "ui.fullscreen"
  | "ads.rewarded";
export type BusinessPermission =
  | "bot.receive"
  | "bot.send"
  | "group.events"
  | "orders.pay"
  | "notifications.subscribe"
  | "links.create"
  | "files.choose"
  | "media.choose"
  | "camera.scan";
export type Permission = LegacyPermission | BusinessPermission;
export interface Provider {
  request(args: {
    method: string;
    params?: unknown[] | object;
  }): Promise<unknown>;
  on?(event: string, handler: (value: any) => void): void;
  removeListener?(event: string, handler: (value: any) => void): void;
}
export interface PluginContext {
  appId: string;
  installationId: string;
  version: string;
  permissions: Array<Permission | BusinessPermission>;
  subject: string;
  expiresAt: number;
  identityAddress?: string;
  group?: {
    id: string;
    name: string;
    role: "owner" | "admin" | "member";
    member: boolean;
  };
}
export interface LoginProof {
  address: string;
  nickname?: string;
  chainId: number;
  origin: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  message: string;
  signature: string;
}
export interface ShareCard {
  title: string;
  text?: string;
  url: string;
  imageUrl?: string;
}
export interface GravityFrame {
  subscriptionId: string;
  x: number;
  y: number;
  z: number;
  timestamp: number;
  control: { x: number; y: number; angle: number | null; strength: number };
  level: { roll: number; pitch: number; inclination: number; faceUp: boolean };
}
export interface PluginSDK {
  getLaunchContext(): Promise<{
    id: string;
    path: string;
    params: Record<string, string>;
    expiresAt: number;
  } | null>;
  orders: {
    get(orderId: string): Promise<PluginOrder>;
    pay(orderId: string): Promise<PluginOrder>;
    cancel(orderId: string): Promise<void>;
    submit(orderId: string, txHash: string): Promise<PluginOrder>;
  };
  notifications: {
    topics(): Promise<NotificationTopic[]>;
    subscriptions(): Promise<NotificationSubscription[]>;
    subscribe(topic: string): Promise<NotificationSubscription>;
    unsubscribe(topic: string): Promise<NotificationSubscription>;
  };
  links: {
    create(options: {
      path: string;
      params?: Record<string, string>;
      expiresIn?: number;
    }): Promise<{
      scene: {
        id: string;
        appId: string;
        path: string;
        params: string;
        expiresAt: number;
      };
      url: string;
    }>;
  };
  files: { choose(options?: { accept?: string[] }): Promise<PluginFile> };
  media: { choose(): Promise<PluginFile> };
  camera: { scan(): Promise<string> };
  getContext(): Promise<PluginContext>;
  getCapabilities(): Promise<{
    apiVersion: number;
    permissions: Array<Permission | BusinessPermission>;
    features: string[];
  }>;
  getAuthorization(): Promise<{
    token: string;
    expiresAt: number;
    apiBase: string;
  }>;
  login(challenge: { nonce: string }): Promise<LoginProof>;
  shareToGroup(card: ShareCard): Promise<{ shared: true; groupId: string }>;
  storage: {
    get<T = unknown>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<{ saved: boolean }>;
    remove(key: string): Promise<{ saved: boolean }>;
  };
  wallet: Provider;
  device: {
    getCapabilities(): Promise<{
      gravity: { available: boolean };
      vibration: { available: boolean };
    }>;
  };
  vibrate(options?: { durationMs?: number }): Promise<unknown>;
  cancelVibration(): Promise<unknown>;
  requestFullscreen(): Promise<{ fullscreen: boolean }>;
  exitFullscreen(): Promise<{ fullscreen: boolean }>;
  gravity: {
    start(options?: {
      intervalMs?: number;
      deadZone?: number;
    }): Promise<unknown>;
    stop(): Promise<unknown>;
    calibrate(): Promise<unknown>;
    onChange(handler: (frame: GravityFrame) => void): () => void;
    onStop(
      handler: (value: { reason: string; subscriptionId: string }) => void,
    ): () => void;
  };
  ads: {
    getCapabilities(): Promise<{
      available: boolean;
      placements: string[];
      reason?: string;
    }>;
    load(options: {
      placement: string;
      rewardTicket?: string;
    }): Promise<unknown>;
    show(options: {
      placement: string;
      rewardTicket: string;
    }): Promise<unknown>;
  };
  on(event: string, handler: (value: any) => void): () => void;
  destroy(): void;
}
export interface NotificationTopic {
  id: string;
  name: string;
  description: string;
}
export interface NotificationSubscription {
  id: string;
  appId: string;
  installationId: string;
  topic: string;
  subject: string;
  active: boolean;
  updatedAt: number;
}
export interface PluginFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  expiresAt: number;
  downloadPath: string;
}
export interface PluginOrder {
  id: string;
  appId: string;
  installationId: string;
  subject: string;
  reference: string;
  title: string;
  chainId: 56 | 97;
  recipient: string;
  asset: string;
  amount: string;
  payer: string;
  txHash: string;
  status:
    | "pending"
    | "prepared"
    | "submitted"
    | "paid"
    | "failed"
    | "expired"
    | "cancelled";
  createdAt: number;
  expiresAt: number;
  paidAt: number;
  confirmations: number;
  lastError: string;
}
export interface CardButton {
  id: string;
  label: string;
  sceneId?: string;
  data?: string;
  disabled?: boolean;
}
export interface PluginCard {
  id: string;
  appId: string;
  installationId: string;
  groupId: string;
  name: string;
  content: string;
  state: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}
export function createPlugin(options?: { provider?: Provider }): PluginSDK;
export default createPlugin;
declare global {
  interface Window {
    GPCPluginSDK: { createPlugin: typeof createPlugin };
  }
}
