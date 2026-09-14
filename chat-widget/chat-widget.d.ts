export interface ChatWalletProvider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: 'accountsChanged' | 'chainChanged' | 'disconnect', listener: (...args: unknown[]) => void): void;
  removeListener?(event: 'accountsChanged' | 'chainChanged' | 'disconnect', listener: (...args: unknown[]) => void): void;
}
export interface ChatWidgetOptions {
  /** Existing GPC group contract address on BNB Smart Chain mainnet. */
  groupId: string;
  /** Pass the provider already selected by your DApp. Defaults to window.ethereum. */
  provider?: ChatWalletProvider;
  position?: 'bottom-right' | 'bottom-left';
  /** Hosted GPC web build root. Defaults to the directory containing chat-widget.js. */
  chatUrl?: string;
}
export interface ChatWidgetInstance { open(): void; minimize(): void; destroy(): void }
export interface GPCChatSDK extends ChatWidgetInstance { init(options: ChatWidgetOptions): ChatWidgetInstance }
declare global { interface Window { GPCChat: GPCChatSDK } }
