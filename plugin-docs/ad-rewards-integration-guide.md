# 业务端广告接入指南

本指南对应 2026-10-21 11:06／11:07 已发布的后端和 426 OTA。广告当前关闭，未取得平台准入时接口返回 `AD_REWARDS_DISABLED`。新增 SDK 的 2.0.201（427）Android 基座已更新官网、iOS 已上传 TestFlight；广告继续关闭，Apple 处理与可安装状态待确认。详见[发布记录](../tech/ad-native-base-427-release-20261021.md)。

## 接入材料与职责

业务端向框架登记：业务 App ID、DApp 的精确 origin、业务广告位名、固定 HTTPS 回调地址。框架分别提供服务端 App API Key 和回调签名密钥；两把密钥独立保存，不放入网页、钱包 JS 或 Git。

业务只依赖广告位和统一回调，不传用户、平台 SDK、原始代码位、奖励金额或收款地址。当前用户由 Wallet 宿主使用自己的 JWT 确认；SDK 路由由框架内部选择并固定到凭证。业务会话只用于业务资格和动作关联，不需要把业务用户传给框架。

框架负责广告核验和可靠通知；奖励内容、资格、风控、金额、发放和到账状态全部由业务端处理。前端播放完成不等于已核验，回调投递成功也不等于资产到账。

## 1. 业务服务端申请凭证

```http
POST https://api.gpcchat.com/api/ad-rewards/apps/YOUR_APP_ID/tickets
Authorization: Bearer YOUR_SERVER_ONLY_APP_API_KEY
Content-Type: application/json
```

```json
{
  "placement": "bonus",
  "requestId": "unique-business-action-001",
  "context": "unique-business-action-001"
}
```

`requestId` 在 App 内唯一，为 1～64 位字母、数字、`_ . : -`，首位是字母或数字。同一业务动作超时重试必须使用同一个值；不能每次重试都生成新值。`context` 最多 2048 字节，建议放业务动作 ID，不放密钥或敏感信息。广告位或 context 变化后复用同一 ID 返回冲突。

成功时取得 `data.rewardTicket` 和 `data.ticket.id`，业务端先将票据与自己的动作可靠绑定，再把不透明凭证交给 DApp。首次申请时 `ticket.wallet` 为空，宿主首次预检后绑定当前身份，之后不能更换用户。凭证可能过期；新动作重新申请，重试旧请求不自动延长有效期。

## 2. DApp 由用户主动触发展示

参考 [`examples/ad-rewards-node/dapp.mjs`](../../examples/ad-rewards-node/dapp.mjs)：

```js
const ads = window.gpc?.ads;
if (!ads) return; // 旧客户端和普通浏览器保留正常业务路径
const caps = await ads.getCapabilities();
if (!caps.available || !caps.placements.includes('bonus')) return;

// 调用你自己的业务接口，使用业务会话，绝不是框架 App API Key。
const ticketResponse = await fetch('/ads/tickets', {
  method: 'POST', credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ placement: 'bonus', actionId: 'business-action-001' })
});
if (!ticketResponse.ok) throw new Error('申请广告凭证失败');
const { rewardTicket } = await ticketResponse.json();

try {
  // 允许内部加载；可选预加载须使用同一凭证。
  await ads.show({ placement: 'bonus', rewardTicket });
} finally {
  // 播放完成、关闭、取消、超时都不能单独决定发奖。
  await refreshYourBusinessRewardStatus('business-action-001');
}
```

界面在用户看广告前说明业务奖励条件和关闭行为。无填充、隐私授权不足或不可用时返回正常业务界面，不强制循环观看；超时先查询业务自己的奖励状态。多 SDK 模式中不带凭证的 `load` 返回 `deferred`，表示未预加载。

## 3. 回调验签

框架向登记地址发 HTTPS POST。先读取原始 body 字节，验签成功后才解析 JSON；不能让全局 JSON 中间件先解析再重新序列化。

```text
X-GPC-Reward-Event-ID: <64 位十六进制事件 ID>
X-GPC-Reward-Timestamp: <Unix 秒>
X-GPC-Reward-Signature: v1=<64 位小写十六进制 HMAC>

HMAC-SHA256(callbackSecret,
    timestamp + "." + eventId + "." + 原始 body 字节)
```

用常量时间比较 HMAC，拒绝与当前时间相差超过 300 秒的时间戳。确认 body 的 `eventId` 与头部一致，`version=1`、`type=ad.reward.verified`、App ID、origin、票据 ID、广告位及业务关联信息符合本地记录。以回调中的 `wallet` 作为框架确认的身份，不能用网页传入的地址覆盖它。

完整实现：[`core.mjs` 的 `verifyCallback`](../../examples/ad-rewards-node/core.mjs)。Go 业务也可参考框架的 `adrewards.VerifyBusinessCallback`。业务无需按穿山甲、优量汇或快手分支处理；平台字段仅用于诊断。

## 4. 幂等和业务发放任务

参考示例在一个数据库事务内执行：

1. 检查事件 ID 唯一键；重复事件必须与已保存的 body 哈希一致，匹配时直接确认，不重复创建奖励任务。
2. 用 `context` 查本地业务动作，并核对票据、广告位、业务资格及已绑定身份。
3. 原子保存事件、确认身份和业务奖励任务，事务成功后才返回 HTTP 2xx。
4. 独立业务任务执行具体奖励。游戏余额可与业务记录在同一事务处理；Token 转账需业务自己的链上幂等、nonce、广播／确认恢复机制，不能把简单重试当作“只转一次”。

示例额外对 `ticket_id`、奖励任务的 `action_id` 设置唯一约束，防止一个业务动作换事件 ID 后重复发放。回调先于票据响应落库时返回非 2xx，让框架后续重试。写入失败必须回滚事件和任务，不能先保存“已处理”再调用发奖接口。

框架至少一次投递：相同事件可能重试，body 不变、时间戳与签名更新。只有 2xx 算确认，3xx 不跟随；业务处理已成功而响应丢失时，下一次回调应幂等确认。示例中的 `reward_jobs.pending` 只表示业务任务已持久化，尚未执行奖励。

## 5. 可运行示例与测试

目录：[`examples/ad-rewards-node`](../../examples/ad-rewards-node)。使用 Node.js 22.13+，无需安装 npm 依赖；SQLite 示例使用 Node 内置 `node:sqlite`，Node 22 会提示实验特性。

```sh
cd examples/ad-rewards-node
cp .env.example .env
# 配置正式分配的 App 凭据，以及自己的 BUSINESS_AUTH_MODULE 绝对路径。
node --env-file=.env server.mjs
node --test core.test.mjs
```

服务只监听 `127.0.0.1:4196`，经业务自己的可信反向代理提供 HTTPS；回调需使用可公开访问的固定 HTTPS 地址，框架不会投递到本机或私网。示例不自动部署，不注册广告位、不启用广告。

`BUSINESS_AUTH_MODULE` 导出 `authenticate(req)`，验证业务已有的登录／CSRF／动作资格后返回 `{ subject }`，否则返回 null 或抛错。`subject` 仅留在业务本地，示例用它和动作 ID 派生稳定请求 ID，不下发给框架。`auth.local-example.mjs` 仅供本机 curl 测试，生产模式拒绝运行；本地测试 token 与框架 App Key 必须不同。DApp 示例需使用业务自己的会话和 CSRF 请求封装。

测试覆盖原始字节验签、过期和篡改拒绝、重复事件、业务动作唯一性、身份及任务事务回滚、回调竞态重试、无用户／SDK 字段签发，以及超时后查询业务状态。完整协议、错误与运维配置见[后端 API](ad-reward-callback-api.md) 和 [DApp API](rewarded-ads-api.md)。
