# 插件业务开放能力

入口为 Wallet 个人中心「插件市场」。群管理者也可从群资料管理本群插件。添加插件及群机器人免费；个人 AI 助理免费使用。链上付款、创建群机器人合约或更新链上知识仍可能产生 BNB Gas。

安装 `gpc-plugin-sdk.tgz`，浏览器使用 `@gpc/plugin-sdk`，Node.js 服务端使用 `@gpc/plugin-sdk/server`。服务端密钥 `gpk_` 仅存放在开发者后端；页面不能持有它。浏览器的短时 `gps_` 授权绑定应用、安装、身份和设备，不能代替 Wallet JWT。

这五项业务能力由宿主 API 2 提供。页面先调用 `plugin.getCapabilities()`，检查 `apiVersion >= 2` 及对应权限；旧宿主需要更新 Wallet。Node.js SDK 要求 Node.js 20+；可下载的完整业务示例使用 Node.js 22.13+ 内置 SQLite，包含收款对账、持久事件队列和卡片更新。

## 开发者后台与审核

在应用版本中选择所需权限，并配置「开放能力配置」。机器人名称、指令、订阅事件、支付网络/收款地址/资产、通知主题均随不可变版本一起审核。变更配置须提交新版本；已安装用户保持原版本，主动更新并确认权限后才使用新配置。后台「业务运行记录」展示订单、卡片最新版本、通知投递和订阅状态；失败卡片或只留在收件箱的通知可重新投递。开发者只能查询自己应用的记录。

示例 Manifest 扩展：

```json
{
  "permissions": ["identity.login", "group.context", "bot.receive", "bot.send", "group.events", "orders.pay", "links.create"],
  "optionalPermissions": ["notifications.subscribe", "files.choose", "media.choose", "camera.scan"],
  "bot": {"name":"活动助手","commands":["/help"],"events":["command","button","member.joined","member.left"]},
  "payments": {"chainId":56,"recipient":"0x开发者收款地址","assets":["native","0x允许的ERC20代币地址"]},
  "notificationTopics": [{"id":"order_status","name":"订单进度","description":"通知报名确认和活动时间变化"}]
}
```

完整 Manifest 仍需填写名称、三个地址页面、入口、图标、版本、分类、简介、方向和安装位置。`payments.assets` 的 `native` 是 BNB；金额使用最小单位的十进制整数字符串。订单 API 的配置网络支持 BSC 56/97，服务端必须连通对应网络 RPC；当前正式 Wallet 的付款网络为 BSC 主网 56，97 仅用于隔离开发联调，不能在正式 Wallet 中自动切换付款网络。

## 群机器人与可更新卡片

机器人由群主或管理员免费安装。只接收本群明确发给它的消息：`@活动助手 问题` 或 `/help@活动助手`。普通聊天、聊天历史和其他插件的消息不转交。成员变化仅通过已核验、达到 12 个区块确认的链上加入/移除日志产生，直接链上操作也能被索引；从授权时的链上位置开始，不补发授权之前的历史。索引游标持久化，重启和失败重试不丢失已确认的事件。

用户在「我的插件 → 管理授权」可暂停机器人或单独关闭指令、按钮、成员加入和成员退出事件。授权取消后停止新投递；卸载后短时会话、机器人和待发提醒失效。机器人使用稳定、独立的宿主身份，不能冒用群成员。

开发者服务端通过签名回调或事件轮询接收 `bot.command`、`bot.button`、`bot.member.joined`、`bot.member.left`。事件 `payload` 是 JSON 字符串，包含 `installationId`、`groupId`、应用内 `subject` 和稳定的 `botEventId`；指令含 `text`，按钮含 `messageId`、`buttonId`、`data`、`cardVersion`。

```js
import {createServerClient} from '@gpc/plugin-sdk/server';
const server = createServerClient({apiKey:process.env.GPC_PLUGIN_API_KEY});
const card = await server.cards.send({
  installationId, idempotencyKey:'registration-created:873',
  title:'周末活动报名', text:'请确认你的报名信息。', status:'待确认',
  buttons:[{id:'confirm',label:'确认报名',data:'registration:873'}]
});
const updated = await server.cards.update(card.id, {
  idempotencyKey:'registration-confirmed:873', expectedVersion:card.version,
  text:'你已成功报名，请准时参加。', status:'已报名',
  buttons:[{id:'confirm',label:'已完成',disabled:true}]
});
```

更新接口是 `PATCH /api/plugins/open/bot-messages/{messageId}`，兼容 `POST .../{messageId}/update`。按需提交 `text`、`title`、`status`、`buttons`，未提交字段保留。`expectedVersion` 与幂等键必填，版本从 1 开始；同一消息更新后仍使用原 ID。`GET .../{messageId}` 查询最新内容和版本。

旧版本更新返回 `409 CARD_VERSION_CONFLICT`。先重新查询，再由业务决定是否更新，不能盲目覆盖。相同幂等键与相同内容重试返回已执行结果；同键不同内容返回 `409 IDEMPOTENCY_CONFLICT`。按钮是整组替换；空数组关闭所有按钮。每个按钮可设 `disabled`，或配置 `sceneId` 跳转本应用场景。普通按钮回调必须匹配当前卡片版本，旧按钮或禁用按钮不能执行。客户端按递增版本替换消息，重连/打开历史时查询服务器最新卡片；投递重试不会重复插入消息。每个群安装每分钟最多 30 条新卡片；每应用每分钟最多 120 次更新，按钮最多 4 个。

业务端仍需对 `event.id`、`botEventId` 和自己的报名/订单 ID 做事务幂等。收到按钮只表示用户提交动作；确认名额、履约和实际业务状态由开发者决定。

## 统一订单和付款核验

服务端创建订单，页面只能查看本人订单、唤起确认或取消未广播订单：

```js
// 插件页面：把短时授权交给自己的后端，订单金额由后端商品规则决定。
const authorization = await plugin.getAuthorization();
const response = await fetch('/api/orders', {
  method:'POST', headers:{'Content-Type':'application/json'},
  body:JSON.stringify({productId:'ticket',customerAuthorization:authorization.token,requestId})
});
const order = await response.json();
const submitted = await plugin.orders.pay(order.id);
// submitted 通常处于 submitted；应展示「确认中」，最终 paid 由服务端回调确认。
```

```js
// 开发者后端：勿直接采用页面传入的收款方、资产或价格。
const order = await server.orders.create({
  customerAuthorization,reference:'merchant-order-873',title:'活动票',
  asset:'native',amount:'1000000000000000',expiresIn:900
});
```

宿主先展示绑定订单/网络/资产/金额/收款方/付款钱包/有效期的 EIP-191 签名，再调用原有交易确认。签名不授予自动扣款权限。身份钱包可与付款钱包不同；签名验证确保实际付款钱包同意此订单。用户可以拒绝任一步骤。

服务端读取可信 RPC 的实际交易、成功回执和规范区块，验证链 ID、付款钱包、收款地址、最小单位金额及转账调用；ERC20 还须有匹配的 Transfer 日志。达到 12 个区块确认后才置为 `paid`。收费代币、会扣除转账税或需要特殊转账过程的资产不受该直接转账订单支持。单个链上交易全局只能用于一个订单。不会根据客户端成功提示或单独提交的哈希发货。

状态：`pending → prepared → submitted → paid/failed/expired`；未广播订单可 `cancelled`。订单有效期 60 秒至 24 小时，缺省 15 分钟；链上实际成交须在订单有效期内。提交交易后服务端持续核验，插件关闭不停止核验。广播后本地保留待提交哈希；再次调用 `orders.pay` 会先恢复该哈希，不重新付款。网络异常时应保持「确认中」，不能立刻让用户重复支付。

若用户关闭页面或清理本机存储后只剩 `prepared`，宿主不会再次广播，避免不确定情况下重复付款。用户核实钱包交易记录后，可调用 `plugin.orders.submit(order.id, txHash)` 补交实际交易哈希；服务端仍执行相同的全套链上验证。已过期但在有效期内成交的已准备订单也可补交并核验。

事件包括 `order.created`、`order.submitted`、`order.paid`、`order.failed`、`order.expired`、`order.cancelled`。开发者收到 `order.paid` 后应再次 `server.orders.get(id)` 校对自身业务记录和金额，以订单 ID 幂等履约。框架不托管资金、不自动退款、不执行奖励转账。

## 用户订阅通知

```js
const topics = await plugin.notifications.topics();
const subscription = await plugin.notifications.subscribe('order_status');
// 宿主展示主题名称和用途，用户确认后才生效。
await plugin.notifications.unsubscribe('order_status');
```

订阅成功产生 `notification.subscribed` 事件，后端记录其中的 `subscription.id` 与 `subject`。服务端密钥不能替用户订阅：

```js
await server.notifications.send({
  subscriptionId,idempotencyKey:'event-start:873',
  title:'活动即将开始',body:'距离开始还有 15 分钟',sceneId,
  deliverAt:Math.floor(Date.now()/1000)+60
});
```

支持即时或未来 30 天内定时投递。同安装同用户每天最多 10 条，重复幂等请求不计新条目。消息先持久化；原生推送按设备保存回执并重试，推送不可用时保留在插件消息收件箱。原生推送只显示通用提醒，不在锁屏暴露业务正文。用户可在个人中心的插件市场查看消息，在授权管理取消各主题订阅；取消、撤权或卸载会取消尚未发送的任务。

`delivered` 表示推送提供方接受，不表示用户已阅读；`readAt` 表示用户在收件箱打开。系统层通知权限和设备的离线推送选择仍有效。

## 插件场景链接、分享和二维码

```js
const link = await plugin.links.create({path:'/events/873',params:{source:'group'},expiresIn:86400});
await plugin.shareToGroup({title:'周末活动',text:'点开报名',url:link.url});
const launch = await plugin.getLaunchContext();
if (launch) showPage(launch.path,launch.params);
```

服务端也可调用 `server.links.create({path,params,expiresIn})` 创建公开场景。群场景还须提交当前有效、已授予 `links.create` 的 `installationId`，分享后仍按当前群成员身份校验。不要把公开场景参数当作用户授权。

链接格式为 `https://download.gpcchat.com/share/plugin/{appId}?scene={sceneId}`，也可转换成应用协议 `gpc://share/plugin/{appId}?scene={sceneId}`。同一链接可生成标准二维码。App 链接路由、剪贴板识别、群卡片和扫一扫均识别该场景；市场会查验应用仍上架、场景有效。已有安装直接恢复指定场景；未安装者先查看详情并确认安装，随后恢复同一场景。群场景使用群内安装及当前成员权限。

场景只包含逻辑页面路径和小型字符串参数，宿主继续加载审核后的准确入口 URL；参数不能把钱包导航到任意来源，也不能携带主 JWT 或私钥。场景最长 90 天，参数 JSON 最多 2 KB。公开场景链接可被转发，不能把订单读取授权或敏感信息放进参数中；业务页须另行验证登录身份。

## 扫码、文件与媒体

```js
const qrText = await plugin.camera.scan();
const attachment = await plugin.files.choose({accept:['application/pdf','image/*']});
const photo = await plugin.media.choose();
// 仅把返回的附件 ID 交给自己的后端。
const bytes = await server.files.download(attachment.id);
```

宿主显示当前插件的用途说明，由用户点击选择文件、图片/视频、拍照或开始扫码。相机使用系统权限与 Wallet 隐私同意，二维码在本机识别，只返回识别文本；取消使用标准 `4001`。文件选择不会暴露本机路径、相册目录或其他文件。

文件最多 20 MB，同安装同用户有效附件最多 50 个、总计 100 MB，24 小时过期并清理。服务端检测 MIME、计算 SHA-256，返回不透明文件 ID、名称、大小、类型、摘要和有效期。下载须有该应用服务端密钥，或同安装同用户有效会话；卸载/撤权后禁止下载。下载强制附件和 nosniff，不能作为可执行页面嵌入。开发者需要长期保存时，在有效期内下载至自己的业务存储。

自行部署 Wallet API 时，`GPC_PLUGIN_FILE_ROOT` 必须指向私有、持久化的专属目录；不能挂到公开上传目录或静态下载站。API 上传是带 Wallet 设备签名和插件短时会话的原始二进制请求，常规开发者通过 SDK 选择文件即可。

## 回调、错误与联调

回调使用已有的加密密钥和持久化重试。通过 `X-GPC-Timestamp`、`X-GPC-Event-ID`、`X-GPC-Signature` 验证 **原始请求字节**；签名为 `HMAC-SHA256(secret, timestamp + '.' + eventId + '.' + rawBody)`。服务端 SDK 的 `verifyWebhook` 同时检查时间窗和常量时间签名。先把事件以唯一 ID 持久入库，再返回 2xx 并执行异步业务；不依赖单次内存回调，重试不可重复发货或重复报名。

常见错误：`PERMISSION_NOT_GRANTED`、`PLUGIN_AUTHORIZATION_CHANGED`、`BOT_EVENT_DISABLED`、`CARD_VERSION_CONFLICT`、`IDEMPOTENCY_CONFLICT`、`ORDER_NOT_PAYABLE`、`PAYMENT_SIGNATURE_INVALID`、`TRANSACTION_ALREADY_USED`、`NOTIFICATION_NOT_SUBSCRIBED`、`PLUGIN_FILE_EXPIRED`。授权错误要求回到宿主重新确认；版本冲突先查询最新值；用户取消不自动重试付款或重新请求权限。

本机测试应使用测试身份、测试网和隔离业务数据库。不要把服务端密钥嵌入 H5，不要把已广播交易视为已支付，不要在未订阅时反复申请推送。完整端点与参数见同目录 `plugin-market-openapi.json`。
