# 通用广告核验与业务回调 API v1

首次接入请先看[业务接入指南与可运行示例](ad-rewards-integration-guide.md)，覆盖申请凭证、DApp 调用、回调验签和幂等事务。

当前版本：多 SDK 内部分流、宿主自动绑定用户已于 2026-10-21 11:06／11:07 发布后端及 Android/iOS 426 全量 stable OTA，广告保持关闭。见[本轮发布记录](../tech/ad-routing-identity-release-20261021.md)。下述 10:33 记录为首轮发布。

2026-10-21：后端及 Android/iOS 426 OTA 已发布，生产 PostgreSQL 完成四张空表迁移；功能默认关闭，未注册真实平台适配器。详见[发布记录](../tech/ad-rewards-release-20261021.md)。

## 职责与调用链

框架负责广告凭证签发、宿主预检、平台回调核验和可靠通知业务端。奖励完全由业务端定义和发放；框架不保存奖励余额、不提供领奖／转账接口、不操作游戏存档，也不判断 Token 是否到账。

```text
业务端提交广告位和业务关联信息 → 向框架申请凭证 → 把凭证交给 DApp
DApp 调用 window.gpc.ads.show({ placement, rewardTicket })
宿主取得当前认证身份 → 首次绑定凭证 → 按凭证路由展示原生广告
广告平台 → 对应平台适配器验签 → 框架落库核验记录和通知任务
框架 → 带签名的 HTTP 回调 → 业务端幂等处理自己的奖励
```

无论业务奖励是复活、权益、积分、优惠券还是 Token 空投，框架流程相同。`context` 是业务端提供的最多 2048 字节字符串，框架原样绑定并透传，不解释其中的金额、资产或业务规则。建议只放业务关联 ID，不放密钥或其他敏感数据。

广告客户端“播放完成”只更新界面，不构成业务发奖依据。真实平台 SDK、原生适配器、平台准入及平台服务端验签仍待后续接入；当前默认配置无法签发可用广告凭证，也不会产生真实广告或奖励。

## 接口与认证

| 接口 | 调用方 | 认证 |
| --- | --- | --- |
| `POST /api/ad-rewards/apps/:appID/tickets` | 业务服务端 | 独立 App API Key |
| `POST /api/ad-rewards/apps/:appID/status` | 业务服务端 | 独立 App API Key |
| `POST /api/wallet/ad-rewards/verify` | Wallet 原生宿主 | 现有 Wallet JWT 和功能访问校验 |
| `GET /api/ad-rewards/callbacks/:provider` | 广告平台 | 对应平台适配器验签 |
| `POST /api/ad-rewards/callbacks/:provider` | 广告平台 | 对应平台适配器验签 |

业务服务端使用 `Authorization: Bearer <APP_API_KEY>`。密钥不得下发给 DApp，不得拿 Wallet 登录 JWT 代替它。业务端不传用户地址或 ID；首次宿主预检从当前 Wallet JWT 取得身份并绑定，请求 body 不接受用户字段。业务端仍负责业务资格与奖励规则，回调通过 `context` 和框架提供的身份关联业务。

所有响应为 `Cache-Control: no-store`。业务接口只接收列出的字段，未知字段拒绝；请求体上限 8 KiB。HTTPS 回调地址和广告代码位由可信宿主配置，不接受客户端传入。

### 签发凭证

```http
POST /api/ad-rewards/apps/example-business/tickets
Authorization: Bearer <APP_API_KEY>
Content-Type: application/json
```

```json
{
  "placement": "bonus",
  "requestId": "business-action-20261021-0001",
  "context": "business-action-20261021-0001"
}
```

`requestId` 为该 App 内唯一的业务动作 ID，1～64 位字母、数字、`_ . : -`，首位为字母或数字。重试同一业务动作必须用同一个 ID；广告位或 context 变化时，复用 ID 返回 `409 IDEMPOTENCY_CONFLICT`。重试不再消耗签发配额，也不重新选择平台。

成功响应：

```json
{
  "success": true,
  "data": {
    "rewardTicket": "v1.<random-ticket-id>.<hmac>",
    "ticket": {
      "id": "<ticket-id>",
      "appId": "example-business",
      "wallet": "",
      "origin": "https://business.example",
      "placement": "bonus",
      "provider": "approved-provider",
      "context": "business-action-20261021-0001",
      "issuedAt": 1792540800,
      "expiresAt": 1792541100,
      "status": "issued"
    }
  }
}
```

凭证包含随机 ID 与服务端 HMAC，服务端记录绑定数据。广告位有效期可配置为 60～900 秒。不要记录完整凭证到 URL 或访问日志。原始签名密钥必须持久保存；本版不支持在保留旧票据的同时直接换密钥，换密钥会使旧凭证无法验证。

签发配额按 App／广告位／UTC 日期计算，`issueDailyLimit` 默认 10000。首次宿主绑定时按 App／身份钱包／广告位／UTC 日期计入 `dailyLimit` 用户配额；重复预检不重复计数，失败事务不绑定身份。计数包括未观看的凭证，是调用保护，不是奖励额度。

### 宿主预检

```json
{
  "origin": "https://business.example",
  "placement": "bonus",
  "rewardTicket": "v1.<random-ticket-id>.<hmac>"
}
```

调用 `POST /api/wallet/ad-rewards/verify`，宿主使用现有登录身份认证，`origin` 必须来自真实 WebView 来源。身份钱包不允许由 body 指定。接口验证签名、有效期、未使用状态、当前来源和广告位配置，首次预检原子绑定身份并计入用户配额，返回绑定票据及宿主专用 `provider`、`adUnitId`。同一身份可重复预检，其他身份不能重新绑定；未绑定凭证不能接受平台证明。预检不标记广告核验成功、不发奖。

来源按协议、域名和端口精确匹配，路径忽略；子域不继承权限。对应广告代码位被删除、更换或禁用后，旧票据预检返回 `REWARD_POLICY_CHANGED`。SDK 接入时必须在 load/show 前调用此接口，并把票据关联到平台支持的服务端透传参数；本次尚未接入 SDK，因此原生端未自动发起此请求。

### 状态查询

请求 `POST /api/ad-rewards/apps/:appID/status`：

```json
{
  "rewardTicket": "v1.<random-ticket-id>.<hmac>"
}
```

只允许查询当前 App 的票据，无需传用户；App 凭据必须保存在业务服务端。返回 `data.ticket`，以及广告核验后出现的 `data.notification`。

- 票据 `issued`：尚未收到有效广告证明；到期后查询显示 `expired`。
- 票据 `verified`：广告平台证明已核验，通知任务已持久化。
- 通知 `pending`：业务回调尚未确认送达。
- 通知 `delivered`：业务回调已返回 HTTP 2xx。

**`delivered` 只代表通知送达，不代表奖励发放或资产到账。** 这些状态由业务端自己的系统管理，不回写为框架广告状态。

## 广告平台适配接口

`new-api/service/adrewards/adapters.go` 定义 `ProviderAdapter`：

```go
type ProviderAdapter interface {
    Verify(context.Context, *http.Request) (VerifiedEvent, error)
    Respond(http.ResponseWriter, error)
}
```

在可信启动代码中调用 `adrewards.DefaultProviders.Register(name, adapter)` 注册；生产代码当前没有注册任何实现，也没有可绕过验签的“通用成功回调”或模拟平台。

`Verify` 需要按平台最新规范验证原始请求的签名、密钥标识、时间、广告事件类型和奖励条件，并确认票据关联及广告代码位。只返回真实达到奖励条件的事件，不能把点击、视频结束或客户端自报完成当作证明。`VerifiedEvent` 必须包含票据、平台交易 ID、用户、来源、广告位、广告代码位和发生时间。平台提供的签名覆盖范围不同，接入时必须确认这些关联信息可信；不能只检验交易 ID 的签名后盲目信任未受保护的参数。

`Respond` 负责各平台不同的成功确认与失败重试协议。只有平台验签和数据库事务成功后才能确认成功；业务回调尚未送达不妨碍平台确认，因为任务已在 SQL outbox 持久化。

框架在同一事务内：消费票据、记录平台交易、写入业务回调任务。每票据只允许一个事件，每平台交易 ID 只允许使用一次，重复回调返回同一事件。发生时间必须落在票据有效期内，允许最多 30 秒的未来时钟误差；首次回调可迟到至票据到期后 24 小时，已接受事件的精确重试不受该窗口限制。

## 框架发送给业务端的回调

框架向注册的 `callbackUrl` 发起 HTTPS POST，示例 body：

```json
{
  "version": 1,
  "type": "ad.reward.verified",
  "eventId": "<stable-event-id>",
  "ticketId": "<ticket-id>",
  "appId": "example-business",
  "wallet": "0x1111111111111111111111111111111111111111",
  "origin": "https://business.example",
  "placement": "bonus",
  "context": "business-action-20261021-0001",
  "provider": "approved-provider",
  "providerTransactionId": "<platform-transaction-id>",
  "occurredAt": 1792540815,
  "verifiedAt": 1792540816
}
```

三个签名头：

```text
X-GPC-Reward-Event-ID: <stable-event-id>
X-GPC-Reward-Timestamp: <current-unix-seconds>
X-GPC-Reward-Signature: v1=<lowercase-hex-hmac-sha256>
```

签名原文为：

```text
timestamp + "." + eventId + "." + 原始 HTTP body 字节
```

用独立的 `callbackSecret` 计算 HMAC-SHA256，常量时间比较签名；接收端应拒绝超过前后 300 秒的时间戳。`adrewards.VerifyBusinessCallback` 提供可执行的 Go 参考实现。验签前不要解析再重新序列化 body，否则签名字节会变。

业务接收端必须：

1. 验证签名、时间戳和 App ID，并确认 body 的 `eventId` 与头部一致。
2. 用 `eventId` 做数据库唯一键，结合 `context` 找到自己保存的业务动作，校验用户和场景。
3. 原子记录事件及业务发奖／业务任务；成功持久化后返回 HTTP 2xx。
4. 相同事件的重试直接返回成功，不重复发奖。具体奖励、风控、资格、金额、链上转账和到账状态均由业务端处理。

框架采取至少一次投递，无法承诺网络层只送一次。业务端如果已处理成功而响应丢失，会再次收到同一个 `eventId`；重试 body 保持不变，头部时间戳与签名更新。

## 重试、配置与默认状态

SQL outbox 保存通知和投递状态，支持进程重启、多 API 实例及回调超时。调度器每 5 秒扫描，每轮最多 20 条、30 秒预算，单次 HTTP 请求最多 10 秒；失败后按 5、10、20 秒递增，最大 15 分钟间隔持续重试。60 秒数据库租约避免正常情况下多个实例同时发送，租约过期或网络不确定时仍可能重复，接收端必须去重。

只有 HTTP 2xx 算确认。3xx 不跟随、4xx/5xx 均保留重试。请求不使用环境代理，DNS 解析后校验并连接公共地址，拒绝本机、私网、链路本地及已列出的保留地址，HTTPS 正常校验证书。不允许 DApp 临时指定回调 URL；`callbackUrl` 在票据签发时绑定，未投递事件的目标不允许因配置变化静默改写，需保留原配置或经运维迁移。

配置全部默认未设置：

```text
AD_REWARDS_ENABLED=false
AD_REWARDS_SIGNING_KEY_BASE64=<独立随机密钥，base64 解码至少 32 字节>
AD_REWARDS_APPS_JSON=<App 配置 JSON 数组>
```

App 配置结构示意（应替换为真实获准平台，不能直接上线）：

```json
[{
  "id": "example-business",
  "origin": "https://business.example",
  "apiKey": "REPLACE_WITH_INDEPENDENT_RANDOM_SECRET_32_BYTES_OR_MORE",
  "callbackUrl": "https://business.example/ad-reward/callback",
  "callbackSecret": "REPLACE_WITH_ANOTHER_RANDOM_SECRET_32_BYTES_OR_MORE",
  "placements": [{
    "id": "bonus",
    "providers": [
      { "provider": "approved-provider-a", "adUnitId": "approved-unit-a" },
      { "provider": "approved-provider-b", "adUnitId": "approved-unit-b" }
    ],
    "issueDailyLimit": 10000,
    "dailyLimit": 10,
    "ttlSeconds": 300
  }]
}]
```

每广告位最多 32 家平台；省略 `weight` 为 1，按权重随机，显式 0 禁用。仅已注册服务端验签适配器的平台参与抽取，使用加密安全随机数。路由在签发时固定，同一 `requestId` 重试不重抽；宿主只调用对应 SDK，失败不静默切换。实际展示比例受无填充、取消等影响。业务端只依赖广告位和统一签名回调，无需按平台写分支。旧单平台 `provider`／`adUnitId` 配置兼容，但不能和 `providers` 同时设置。

默认开关为关闭；即使配置开关，未注册平台适配器也不能签发票据或接受平台证明。配置 API Key 不授予其他 App 的权限。回调调度器只在明确开启功能后启动，不提供任何外部强制核验、强制成功或发奖路由。

四张新表分别为凭证、签发配额、平台收据和通知任务；迁移接入现有 GORM 普通和并行迁移清单，使用跨 SQLite／MySQL／PostgreSQL 的 GORM 操作。本轮发布仅新增四张空表，没有修改任何业务余额或游戏存档。

## 本地验证

新增凭证、HTTP 路由、平台证明和业务回调测试通过；`go test -race ./service/adrewards` 通过。`model`、`middleware`、`controller`、`router` 和 `service/adrewards` 五个相关包完整回归通过。本地业务测试使用独立内存 SQLite；发布时仅对生产 PostgreSQL 做四张空表迁移和只读核验，未写入模拟事件，未对 MySQL 做实库验收，也未向真实业务服务器投递回调。平台适配器仅存在于测试文件，生产注册表保持为空。
