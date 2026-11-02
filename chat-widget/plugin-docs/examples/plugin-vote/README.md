# GPC 插件接入示例

页面演示插件上下文、个人存储、明确分享与身份登录。服务端演示固定登录模板验证、限定应用的令牌核对及原始字节回调验签。

```sh
npm install
PLUGIN_ORIGIN=https://你的插件域名 GPC_PLUGIN_APP_ID=你的应用ID npm start
```

将独立 HTTP／HTTPS 反向代理指向 `127.0.0.1:4399`，配置 `manifest.json` 中的真实入口、图标、隐私和支持页面，再到开发者中心提交。HTTPS 插件在网页宿主内运行时须允许钱包来源嵌入；HTTP 插件在 HTTPS 网页钱包中通过 SDK 1.0.1 的独立窗口桥接运行。使用仓库源码时 SDK 自动从 `sdk/plugin` 读取；从文档下载示例时使用同目录附带的 `gpc-plugin.js`。

配置回调时设置 `GPC_PLUGIN_WEBHOOK_SECRET` 并将地址指向 `/webhook`；链 ID 默认 56，可以用 `GPC_PLUGIN_CHAIN_ID` 指定后端实际支持的网络。平台 API 可由服务端 `GPC_API_BASE` 设置，不接受页面传入任意 API 地址。

示例采用进程内 nonce 与事件去重，只用于演示接入。生产业务应使用数据库事务、持久化去重和任务队列；验证身份后建立自己的业务登录会话。投票选择保存在每个身份的独立存储里，多人共享投票结果需要自己的业务数据库。
