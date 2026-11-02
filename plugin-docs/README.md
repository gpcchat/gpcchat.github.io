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
