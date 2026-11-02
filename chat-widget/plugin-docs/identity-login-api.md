# DApp 身份钱包静默登录

内置 Android/iOS DApp WebView 和桌面 DApp 窗口提供 `gpc_login`。此接口使用当前本地身份钱包生成登录证明，无需连接弹窗、签名弹窗或支付密码。Android/iOS 2.0.199（425）需安装本次 OTA 并重启；桌面支持需包含该接口的新客户端，旧版不支持该方法。

```js
// nonce 由 DApp 后端生成，16～128 位字母数字，随机、一次性且绑定当前登录会话。
const { nonce } = await fetch('/auth/challenge').then(r => r.json());
const proof = await window.ethereum.request({
  method: 'gpc_login',
  params: [{ nonce }],
});
// 也可使用：const proof = await window.gpc.login({ nonce });
await fetch('/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(proof),
});
```

返回字段：`address`（身份钱包地址）、`nickname`（当前身份钱包昵称）、`chainId`（当前 BSC 网络编号）、`origin`（钱包桥接层确定的页面来源）、`nonce`、`issuedAt`、`expirationTime`、`message`、`signature`。`nickname` 取自钱包本地当前身份资料，每次登录读取最新值；没有昵称时返回空字符串，旧客户端可能不含此字段。DApp 可在登录验证成功后用 `proof.nickname` 填充业务昵称，并按自身规则校验和展示；昵称不唯一、不包含在签名消息内，不能作为身份或权限依据。登录参数仍只需 `{ nonce }`，无需传昵称。

时间使用 UTC ISO 8601，有效期固定为 5 分钟；签名为 EIP-191 消息签名。消息模板保持兼容，各行使用 `\n`，结尾没有换行，地址使用 EIP-55 格式：

```text
{origin 的 host，含非默认端口} wants you to sign in with your Ethereum account:
{address}

Sign in to this DApp with your GPC identity wallet. This request grants no transaction or asset permissions.

URI: {origin}
Version: 1
Chain ID: {chainId}
Nonce: {nonce}
Issued At: {issuedAt}
Expiration Time: {expirationTime}
```

后端必须核对自己的预期 `origin`、网络、当前会话的 nonce、签发时间和过期时间，并按模板重建消息核对 `message`。使用 `ethers.verifyMessage(message, signature)` 恢复地址，与 `address` 比较；成功后原子消费 nonce 并签发业务登录会话。不要仅凭地址建立登录，不要只验签而忽略来源和 nonce。登录会话及退出由 DApp 管理，钱包不替 DApp 签发服务端令牌。

仅接受单个 `{ nonce }` 参数，额外字段、任意消息、类型化数据、交易参数均拒绝。身份钱包缺失、密钥不可用或签名期间身份切换返回 `4100`；参数无效返回 `-32602`；外部钱包身份返回 `4200`，因为外部钱包无法保证静默签名。

此接口不会授予 `eth_accounts` 权限，也不会改变 `window.ethereum.selectedAddress`。返回的身份地址可能与当前付款钱包不同。资金连接、`personal_sign`、类型化签名和交易仍使用既有确认流程；DApp 应分别管理身份登录与付款钱包连接。移动端沿用 bridge token 及来源校验，桌面端沿用 IPC 来源校验。
