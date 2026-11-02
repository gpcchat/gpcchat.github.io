export type Permission =
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
  permissions: Permission[];
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
  getContext(): Promise<PluginContext>;
  getCapabilities(): Promise<{
    apiVersion: number;
    permissions: Permission[];
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
export function createPlugin(options?: { provider?: Provider }): PluginSDK;
export default createPlugin;
declare global {
  interface Window {
    GPCPluginSDK: { createPlugin: typeof createPlugin };
  }
}
