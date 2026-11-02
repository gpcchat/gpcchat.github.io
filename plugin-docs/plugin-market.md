# GPC 插件市场接入指南

插件以独立 HTTP／HTTPS 网页和业务后端运行。开发者使用 GPC SDK 调用宿主能力；用户将已审核的版本安装到个人应用，群主或管理员将插件安装到群菜单或聊天工具栏。插件内容由开发者托管，GPC 审核版本声明并执行权限边界。

## 开发者中心与发布

使用现有控制台账号登录 `/console/plugin-developer`，登记开发者名称、联系渠道并接受接入规范，然后创建插件。填写版本、名称、介绍、分类、图标、HTTP／HTTPS 入口、隐私政策和支持地址，选择安装位置、必需权限、可选权限与屏幕方向，提交审核。

版本使用 `主版本.次版本.修订号`，如 `1.2.3`。提交后的版本快照不可编辑，同一应用版本号不可重复。待审核和被拒绝版本不出现在公开市场。开发者可以查看审核意见、提交新版本、下架自己的应用、生成和撤销服务端密钥、设置事件回调、重试失败投递。

管理员在 `/console/plugin-market` 查看版本声明，打开入口、隐私与支持页面，核对实际功能和权限后，通过并上架或填写原因拒绝。管理员可以推荐、下架、封禁和恢复应用。应用封禁不会因通过另一版本而自动解除。下架、封禁、审核和密钥变更保留审计记录。

审核的是入口与权限等声明快照；远端网页由开发者运营，不等于 GPC 对远端每次文件更新做了代码完整性担保。更换入口、增减权限或改变重要行为应提交新版本。客户端始终以安装记录和实时授权限制宿主调用。

## 安装与授权

点击钱包消息页左上角头像进入个人中心，再打开“插件市场”，即可搜索、分类筛选、查看详情和管理已安装插件。群资料的“群插件”和群聊天工具栏提供群内入口。

安装前展示开发者域名、版本、隐私政策、必需权限及可选权限。用户明确同意后才创建安装记录。群安装由服务端实时核对当前链上成员与管理角色；普通成员可以打开群已安装的插件，安装、更新或卸载需群主或管理员。个人安装只允许本人访问。

安装固定到具体的已审核版本。市场发布更新不会自动扩展权限或改变既有安装；更新时重新展示权限并确认。卸载保留独立存档，再次安装可恢复；授权和旧会话立即失效。应用下架或封禁后不能继续获取宿主能力；恢复上架后旧会话仍不会复活，需要重新打开。

## 获取 SDK

文档目录附带 `gpc-plugin.js`、`index.mjs`、`index.d.ts` 和 `gpc-plugin-sdk.tgz`。可下载包后安装：

```sh
npm install ./gpc-plugin-sdk.tgz
```

```js
import { createPlugin } from '@gpc/plugin-sdk';
const gpc = createPlugin();
const context = await gpc.getContext();
console.log(context.appId, context.version, context.permissions, context.group);
```

或直接引入自行托管的 SDK：

```html
<script src="./gpc-plugin.js"></script>
<script>
  const gpc = GPCPluginSDK.createPlugin();
  gpc.getContext().then(console.log).catch(console.error);
</script>
```

移动端和桌面端使用注入 Provider。钱包浏览器网页宿主使用独立 iframe 和校验来源的消息桥接；插件页面应允许钱包网页来源嵌入，且插件必须与钱包网页不同源。普通浏览器直接打开开发者网页不会产生插件安装授权。

## 声明清单

```json
{
  "name": "群投票",
  "version": "1.0.0",
  "description": "在当前群发起活动投票，并分享投票链接。",
  "category": "群工具",
  "iconUrl": "https://plugins.example/logo.png",
  "entryUrl": "https://plugins.example/vote",
  "privacyUrl": "https://plugins.example/privacy",
  "supportUrl": "https://plugins.example/support",
  "permissions": ["identity.login", "group.context", "storage.read", "storage.write"],
  "optionalPermissions": ["chat.share", "device.vibrate"],
  "placements": ["personal", "group", "chat_toolbar"],
  "orientation": "portrait"
}
```

所有地址支持公网 HTTP 和 HTTPS，无 URL 用户名密码。入口、图标、隐私政策与支持地址必填。不接受私网 IP、localhost 等本地来源。权限只能来自下表，必需与可选权限不能重复。安装位置为 `personal`、`group`、`chat_toolbar`，至少一个；方向为 `portrait` 或 `landscape`。

HTTP 与 HTTPS 是不同来源，自定义端口也分别绑定授权；授权页显示实际协议、主机及端口。移动端在内置 WebView 打开两种地址。HTTPS 网页宿主按[浏览器混合内容规范](https://www.w3.org/TR/mixed-content/)不能直接嵌入 HTTP 页面，因此会提示用户点击打开继承沙箱的独立插件窗口，继续使用同一安装授权及 SDK。HTTP 网页插件请使用随文档提供的 SDK 1.0.1 或更高版本；浏览器需允许插件窗口。该窗口不能导航钱包主页，关闭窗口或返回个人中心后停止桥接；全屏由浏览器自身管理。HTTP 传输为明文，插件图标加载失败时显示默认图标。

| 权限 | SDK 调用 | 作用 |
| --- | --- | --- |
| `identity.login` | `login({ nonce })` | 当前身份钱包的登录证明与展示昵称 |
| `wallet.request` | `wallet.request({ method, params })` | 标准钱包连接、读取、签名与交易；保留原确认流程 |
| `group.context` | `getContext().group` | 仅当前安装群的资料和当前调用人的实时角色 |
| `chat.share` | `shareToGroup(card)` | 用户选择群并确认发送卡片 |
| `storage.read` | `storage.get(key)` | 读取本插件、本安装、本身份的数据 |
| `storage.write` | `storage.set/remove` | 写入或删除独立存储 |
| `device.motion` | `gravity.start/stop/calibrate/onChange/onStop` | 重力控制与真实水平度 |
| `device.vibrate` | `vibrate/cancelVibration` | 有时长和频率限制的震动 |
| `ui.fullscreen` | `requestFullscreen/exitFullscreen` | 请求宿主布局全屏 |
| `ads.rewarded` | `ads.getCapabilities/load/show` | 沿用现有激励广告框架 |

`getCapabilities()` 返回市场 SDK 协议与已授予权限；`device.getCapabilities()` 和 `ads.getCapabilities()` 查询实际宿主能力。授权表示可以请求，不保证当前系统、基座或广告平台可用。重力与水平度需要包含相应原生模块的 429 完整基座；旧基座不能靠 JS 更新获得模块。当前真实广告开关保持关闭，接入插件市场不会自动启用广告。桌面和网页没有移动传感器及广告适配器时返回明确不可用。

## 身份与业务后端

```js
const { nonce } = await fetch('/auth/challenge').then(r => r.json());
const proof = await gpc.login({ nonce });
await fetch('/auth/verify', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(proof)
});
```

业务后端生成 16～128 位字母数字随机、一次性、绑定登录会话的 nonce。验证自己的预期来源、网络、时间、固定消息模板及签名，原子消费 nonce 后建立业务会话。昵称是展示资料，不在签名内，不能作为身份或管理权限。详见 [身份登录协议](identity-login-api.md)。外部身份钱包不能保证静默签名，会返回 `4200`，业务应提供明确的外部钱包登录方式。

身份钱包和付款钱包可能不同。身份登录不会授予付款、资产、聊天记录或付款签名权限。标准钱包请求保持既有确认和支付密码规则；目前链服务范围沿用宿主的 BSC 配置。

## 当前群与独立存储

```js
const ctx = await gpc.getContext();
if (ctx.group) console.log(ctx.group.id, ctx.group.role, ctx.group.member);
await gpc.storage.set('preferences', { reminder: true });
const preferences = await gpc.storage.get('preferences');
await gpc.storage.remove('preferences');
```

个人入口没有 `group` 字段。没有 `group.context` 授权时群上下文不返回。群角色由服务端查询，前端参数不能指定用户身份或角色。离群后原会话不能继续使用。插件不能读取全部群列表或历史聊天明文。

存储键为 1～100 位字母、数字、下划线、点、冒号或连字符。值由 SDK 序列化为 JSON，每值最多 65,535 字节，每安装／身份最多 128 个键、1 MiB。群插件的个人存储也按实际调用身份隔离，不会把群主的数据交给群成员。多人共享投票、订单或游戏状态由开发者自己的业务后端管理。

## 分享、设备与生命周期

```js
if (ctx.permissions.includes('chat.share')) {
  await gpc.shareToGroup({ title: '周末活动投票', text: '请选择时间', url: 'https://plugins.example/vote/123' });
}
```

分享由宿主展示卡片和选群界面，开发者不能指定群静默发送。发送成功不代表阅读，也不能充当可信奖励依据。重力、设备和广告的完整参数沿用对应接口文档。插件退出时调用 `gpc.destroy()` 清理 SDK 自身监听；业务同时清理定时器与网络订阅。宿主负责页面离开和后台时释放传感器与取消等待中的操作。

## 对外 HTTP API

API 基址与客户端环境一致，生产默认 `https://api.gpcchat.com/api`。完整机器可读协议为 [plugin-market-openapi.json](plugin-market-openapi.json)。

| 调用方 | 路径 | 用途 |
| --- | --- | --- |
| 公开 | `GET /public/plugins?q=&category=&page=` | 已审核上架目录，每页 40 条 |
| 控制台登录用户 | `GET /plugin-market/self/`、`POST /plugin-market/self/:action` | 开发者登记、应用、版本、密钥、回调 |
| 管理员 | `GET /plugin-market/admin/`、`POST /plugin-market/admin/:action` | 审核、上架状态、推荐与审计 |
| 钱包宿主 | `GET /wallet/plugins/context?groupId=` | 当前群角色及是否可管理安装 |
| 钱包宿主 | `POST /wallet/plugins/installations/:id/request` | 签名代理调用，校验来源、安装、身份与设备 |
| 钱包宿主 | `GET/POST /wallet/plugins/installations` | 安装列表与明确授权安装 |
| 钱包宿主 | `DELETE /wallet/plugins/installations/:id` | 卸载撤权 |
| 钱包宿主 | `POST /wallet/plugins/installations/:id/session` | 签发 15 分钟插件会话 |
| 插件令牌 | `GET /plugins/open/context` | 应用、版本、权限、授权身份与当前群 |
| 插件令牌 | `GET/PUT/DELETE /plugins/open/storage?key=` | 独立存储，PUT body 为 `{ "value": "JSON 字符串" }` |
| 服务端应用密钥 | `GET /plugins/open/events?after=事件ID` | 本应用事件增量读取，每次最多 100 条 |

开发者接口复用已有控制台登录体系。钱包宿主写接口同时要求有效设备 Wallet JWT 和现有规范化钱包请求签名，第三方页面不应直接调用这些宿主接口。

```js
const auth = await gpc.getAuthorization();
// 可交给自己的后端，绝不获取或传递钱包主 JWT。
await fetch('/my-backend/verify-plugin', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: auth.token })
});
```

业务后端用此 `gps_` 令牌调用公开插件 API，并核对返回的 `appId` 等于自己的应用。令牌绑定应用、安装记录、当前身份、设备、权限与版本，默认 15 分钟有效。授权改变、卸载、下架、封禁、设备撤销或身份封禁会使请求被拒绝。浏览器调用还验证 `Origin`；服务端调用可以不发送 Origin。令牌仅应在可信后端和 TLS 连接使用。

`gpk_` 应用密钥只允许读取自己应用的事件，不能冒充用户、读取用户存储或调用钱包。密钥仅显示一次，服务端仅保存摘要；可以单独撤销。事件游标必须属于同一应用，按单调序号增量读取。

## 签名事件回调

开发者中心设置 HTTP／HTTPS 地址并保存一次性显示的回调密钥。服务器需设置 `GPC_PLUGIN_WEBHOOK_KEY`，为 32 字节随机值的 Base64，用来加密落库回调密钥；该配置缺失时明确拒绝启用回调，不会落库明文。示例生成：`openssl rand -base64 32`。多 API 副本须使用同一密钥，并保留受限备份。

回调事件包括 `release.approved`、`release.rejected`、`app.active`、`app.delisted`、`app.suspended`、`installation.authorized`、`installation.revoked`。安装事件包含安装 ID、版本与授权；只有授予 `group.context` 时才附带群 ID，不附带个人钱包或群成员列表。开发者审计中的安装操作者隐藏钱包地址，平台管理员保留完整审计。

请求为 `POST` JSON，头包括 `X-GPC-Event-ID`、`X-GPC-Timestamp` 和 `X-GPC-Signature`。签名为：

```text
HMAC-SHA256(webhookSecret, timestamp + "." + eventId + "." + rawBody)
```

业务后端必须对原始请求字节验签，核对时间窗口及正文 ID／应用 ID，并按事件 ID 事务去重。成功入库或持久化入队后返回 2xx。事件 payload 字段是 JSON 字符串，验签后再解析。平台至少一次投递，失败按 5 秒起步指数退避，10 次后标记失败，可人工重试；副本通过数据库租约争抢，崩溃后可恢复。关闭回调时未投递记录标记暂停；重新启用后在投递列表选择重试。每次启用保存会轮换签名密钥。

回调仅连接解析到公网的 HTTP／HTTPS 地址，DNS 在实际连接时校验并固定 IP，禁止私网和跳转。开发者仍可用事件查询 API 补偿或对账。接收端示例见附带的 `examples/plugin-vote/server.mjs`。

## 错误与兼容

HTTP 返回 `{ success, data }` 或 `{ success:false, code, error }`。常见状态：400 参数无效，401 会话失效，403 未授权，404 不存在，409 版本或状态冲突，413 存储值过大，429 频控，503 依赖暂不可用。

桥接保留 `4001` 用户取消、`4100` 未授权、`4200` 宿主不支持、`-32602` 参数错误。网络失败、超时和重试不能被当作支付或发奖成功。SDK 应显示可恢复状态，付款最终结果以链上确认及业务后端核验为准。

## 运行示例与验证

仓库 `examples/plugin-vote` 提供页面、声明、登录验证、插件令牌核对和原始字节回调验签示例；用自己的实际 HTTP／HTTPS 地址替换示例域名后提交。`sdk/plugin` 同时提供源码、声明和独立测试，不依赖前端框架。

```sh
node --test sdk/plugin/test/*.test.cjs
node --test examples/plugin-vote/test/*.test.mjs
```

本地测试和模拟浏览器不代表真实用户钱包签名、真实付款、真机传感器或广告填充验收。市场代码的实施和验证记录另见仓库技术记录。
