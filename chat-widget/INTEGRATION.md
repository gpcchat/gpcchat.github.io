# 第三方 DApp 指定群悬浮聊天

## 接入

项目方在自己的 DApp 中加载 SDK，用户可在其他支持 EIP-1193 的 EVM 钱包浏览器中使用。群地址直接作为 groupId，不需要 appId 或域名登记。当前群合约与登录链均为 BNB Smart Chain 主网（56）。

GitHub Pages 接入地址为 `https://gpcchat.github.io/chat-widget/`，SDK 与示例放在该目录中。

```html
<script src="https://gpcchat.github.io/chat-widget/chat-widget.js?v=20260915-h5"></script>
<script>
  // 由项目方先判断自己的合约条件。
  const chat = GPCChat.init({
    groupId: '0x你的现有GPC群合约地址',
    provider: connectedWalletProvider,
    position: 'bottom-right',
  });
  // 不调用 open 时只显示气泡，点击气泡后才加载聊天页。
  // chat.open();
  // chat.minimize();
  // 路由离开、项目资格失效或更换 provider 实例时：
  // chat.destroy();
</script>
```

SDK 自动使用脚本所在目录作为聊天页面根地址。如果将脚本复制到 DApp 自己的服务器，必须显式传 `chatUrl: 'https://实际聊天站点/'`。SDK、网页构建和类型声明应使用同一版本。一个页面同时保留一个实例，再次 init 会销毁前一个。

- `groupId`：非零的 20 字节群合约地址，内部转换为 `group:地址`。
- `provider`：建议显式传入 DApp 已连接的钱包，避免选错多个注入钱包中的一个。未传时使用 `window.ethereum`。钱包主密钥不传给聊天页。
- `position`：`bottom-right`（默认）或 `bottom-left`。
- `chatUrl`：完整网页构建根 URL，生产必须 HTTPS；本地测试允许 localhost/127.0.0.1 HTTP。
- `open/minimize/destroy` 可从 init 返回值或全局 GPCChat 调用。SPA 卸载时调用 destroy；SDK 会移除 DOM、监听器并卸载 iframe。

线上示例页：`https://gpcchat.github.io/chat-widget/demo.html`。TypeScript 类型位于 `https://gpcchat.github.io/chat-widget/chat-widget.d.ts`，可复制到项目类型目录使用。

## 窗口行为

只呈现指定群，不包含其他会话入口。顶部有可关闭的“下载 GPC App，体验完整聊天”横幅，下载按钮打开 `https://www.gpcchat.com/#download-title`，官网提供 Android 与 App Store 入口。关闭状态保留到当前 iframe 卸载。

打开聊天窗口后会复用已连接钱包，先恢复有效聊天会话；无法恢复时自动请求一次签名授权聊天设备。没有已连接账户时保留手动连接入口。拒签后不自动重试，用户可以主动点击登录按钮重试；不会自动发送聊天或加入群。未入群时显示加入入口，执行已有的入群、付费、审批和交易确认流程。后续文字发送使用设备密钥加密，支持 Unicode 表情；图片、语音等扩展消息显示占位提示。链上禁言、仅管理员发言及服务端发送授权继续生效。

收起窗口保留连接并显示新消息计数；尚未展开并登录的气泡不显示历史未读数。窗口打开后清零本次计数。账号、链或断连事件会重新加载 iframe，立即隐藏旧窗口内容，并丢弃旧会话 RPC 返回值。账号变更后需要新账号登录。无事件的 provider 仍会在刷新/发送前检查当前账户；更换 provider 对象应由宿主重新 init。

气泡未打开时不自动弹签名。聊天窗首次展开时自动登录；会话过期或浏览器存储失效时需要钱包重新确认签名。设备密钥、登录和本地记录按宿主来源及群隔离，不复用完整钱包网页的存储。浏览器也可能进一步按站点划分或限制 iframe 存储；不承诺不同 DApp、浏览器、设备之间共享登录或历史。

## 权限和合约边界

不设置接入域名白名单。桥接依然验证当前 iframe/父窗口、双方实际来源及随机会话 ID；这用于避免其他窗口伪造请求。钱包 RPC 限于登录、网络、入群交易所需方法，不开放 eth_sign 或私钥导出。SDK 不向宿主传消息正文、设备密钥或聊天 JWT，只返回窗口状态和未读数量。

DApp 的自定义合约判断负责入口展示。群地址必须是系统识别的 GPC 群，原有服务端成员及链上发言权限不能跳过。如果项目用 NFT/质押等额外条件约束群内读写，需将其接入群成员流程或增加可信后端验证；前端条件不会自动转成群权限。

本地历史只包含此设备已接收的消息。新增授权设备无法自动解密授权前发给其他设备的历史密文，清理存储不会触发历史恢复。离线推送、跨设备历史迁移和音视频不属于这一版。

## 构建与部署

需要 Node >=20.19.4：

```sh
npm run typecheck
npm run test:unit -- tests/unit/chatEmbedConfig.test.ts tests/unit/chatEmbedBridge.test.ts tests/unit/chatEmbedApp.test.ts
npm run web:build
npm run test:e2e -- tests/e2e/chat-widget.spec.ts
```

`dist-web` 包含完整可部署网页、`chat-widget.js`、声明与示例。必须上传整个目录，不能仅上传 SDK。建议部署到专用 HTTPS 聊天来源；生产 iframe 不应与项目方页面同源。当前复用 Expo 网页构建，SDK 本身很小，但聊天页仍加载现有应用依赖。

示例 Caddy 配置（占位域名与路径）：

```caddy
chat.example.com {
  root * /srv/gpc-chat/current
  encode zstd gzip
  header {
    Content-Security-Policy "frame-ancestors https: http:"
    -X-Frame-Options
    X-Content-Type-Options nosniff
    Referrer-Policy no-referrer
  }
  @entry path / /index.html /chat-widget.js /chat-widget.d.ts
  header @entry Cache-Control "no-cache"
  @assets path /_expo/* /assets/*
  header @assets Cache-Control "public, max-age=31536000, immutable"
  try_files {path} /index.html
  file_server
}
```

宿主 DApp 如设置 CSP，需要允许 SDK 域名的 `script-src` 和聊天域名的 `frame-src`。聊天服务 API、消息节点的 HTTPS/WSS 和资源域名也必须允许新聊天来源访问；正式部署时验证 CORS 预检和节点连接。不要直接套用官网的 `X-Frame-Options: DENY`。域名开放嵌入不等于开放消息访问。

## 验证范围

新增组件测试验证非成员不加载消息、申请入群、指定群的消息解密与加密发送调用、发送前禁言校验、未读过滤、官方横幅链接。桥接测试验证来源/会话伪造、拒签、超时。浏览器测试使用两个不同本地来源，在桌面、390px 与 360px 宽度验证实际网页、iframe、钱包 RPC 转发、账号切换、窗口生命周期和横幅弹窗。

测试使用模拟钱包、业务服务或隔离网络，不向生产发消息或提交交易。真实钱包内置浏览器的签名、付费/审核入群、实际节点双向消息、手机键盘、后台恢复及存储限制仍需真机验收；这些不得据本地测试标记为已通过。

2026-09-14 本地结果：类型检查通过；相关 11 个测试文件共 59 项通过；3 种视口共 9 项浏览器检查通过（含跨域设备签名登录和身份存储隔离）；正式网页构建、跨平台安全配置与生产 mock 边界检查通过。已人工检查 360px 小屏截图。此处记录本地验收结果；真实钱包/真实群节点联调尚未完成。

GitHub Pages 子目录构建使用 `GPC_WEB_BASE_PATH=/chat-widget`，上传到 `gpcchat/gpcchat.github.io` 的 `chat-widget/` 目录；保留根目录已有 DApp 与 gpcapp 网站。根目录 demo.html 由 public/chat-widget/demo.html 复制并将脚本路径改为 ./chat-widget.js。

## GitHub Pages 发布记录（2026-09-14）

已发布到 `gpcchat/gpcchat.github.io` 的 main 分支。功能部署提交为 `cc8417e50955aae86e78aecb67b6223d20747d80`，源码已推送到私有仓库 `gpcchat/gpcwallet` 的 `codex/chat-widget-20260914` 分支。

- 示例：https://gpcchat.github.io/chat-widget/demo.html
- SDK：https://gpcchat.github.io/chat-widget/chat-widget.js
- 接入说明：https://gpcchat.github.io/chat-widget/INTEGRATION.md

GitHub Pages 返回 built；已验证线上 SDK 内容与源码完全一致、线上示例与下载横幅可见、不同来源的页面可以加载线上 SDK 并将请求转发到模拟宿主钱包，原有首页内容与发布前一致。此次线上验证没有连接真实用户钱包、加入真实群或发送生产消息。

2026-09-15 更新：按手机钱包浏览器 H5 适配，600px 及以下展开为接近全屏面板，隐藏展开状态的悬浮按钮，使用 visualViewport 跟随软键盘导致的高度与偏移变化。有效会话免签名恢复；已连接钱包首次授权自动请求一次签名，拒签后保留手动重试。浏览器模拟视口检查不等于全部手机钱包真机验收。

本次更新验证：类型检查通过；相关 62 项单元测试通过；14 项浏览器检查通过，另 1 项仅针对手机的布局测试在桌面项目中按条件跳过。新增覆盖自动签名登录、有效会话免签名恢复、拒签后不循环请求，以及手机 visualViewport 高度变化。GitHub Pages 子目录构建成功。

## 自定义悬浮按钮颜色

```js
GPCChat.init({
  groupId: '0x真实群地址',
  provider: window.ethereum,
  buttonColor: '#2563eb',
  buttonTextColor: '#ffffff',
});
```

`buttonColor` 设置悬浮按钮背景色，`buttonTextColor` 设置文字颜色，支持浏览器识别的 CSS 颜色值。两项均可省略，默认沿用绿色 `#176447` 和白色文字；无效颜色保留默认值。颜色只作用于悬浮按钮，不改变聊天面板与下载横幅。已有接入代码无需调整。
