# @gpc/plugin-sdk

GPC 插件市场 SDK，支持注入 Provider 和网页宿主跨来源 iframe／独立插件窗口桥接。HTTP 与 HTTPS 插件地址均支持，协议和端口分别绑定安装授权。

```js
import { createPlugin } from '@gpc/plugin-sdk';
const gpc = createPlugin();
const context = await gpc.getContext();
await gpc.storage.set('settings', { sound: true });
```

浏览器脚本：加载 `gpc-plugin.js`，调用 `GPCPluginSDK.createPlugin()`。
完整接入、权限、审核、安装和 HTTP API 见随包文档站的 GPC 插件市场指南。
宿主须包含插件市场桥接；历史钱包客户端不会仅因安装 npm 包而获得新能力。
# 业务能力补充

浏览器提供 `orders.get/pay/cancel`、`notifications.topics/subscribe/unsubscribe/subscriptions`、`links.create`、`getLaunchContext`、`camera.scan`、`files.choose`、`media.choose`。权限、通知主题与收款设置随版本审核，新增权限须用户重新确认。付款和订阅由宿主交互确认。

Node.js 20+ 使用 `import {createServerClient,verifyWebhook} from '@gpc/plugin-sdk/server'`，以服务端密钥调用 `orders.create/get`、`cards.send/get/update`、`notifications.send/get`、`files.download`、`events`。卡片更新必须提供 `expectedVersion` 和 `idempotencyKey`；按消息 ID 原位替换，冲突后先查询最新版本。服务端密钥不能放入网页。

订单广播后通常为 `submitted`，服务端核验真实交易并等待 12 个确认后才为 `paid`。文件 24 小时有效，下载需本应用密钥或同用户授权。完整用法见官网业务接入指南和业务示例。

