# DApp／游戏分享到群

Android/iOS 内置 DApp 和游戏 WebView 提供 `window.gpc.shareToGroup`，RPC 名为 `gpc_shareToGroup`。新增接口须安装包含本功能的 OTA 并重启。外部浏览器、旧客户端及当前桌面宿主不支持此接口。

```js
try {
  const result = await window.gpc.shareToGroup({
    title: '青岚剑境',
    text: '来一起闯关！',
    url: 'https://game.example/play?invite=your-invite-code',
    imageUrl: 'https://game.example/logo.png',
  });
  // 只有消息发送成功后才返回：
  // { shared: true, groupId: 'group:…' }
} catch (error) {
  if (error.code === 4001) {
    // 用户取消、离开当前页面或页面重新加载。
  }
}
```

也可调用 `window.ethereum.request({ method: 'gpc_shareToGroup', params: [options] })`。

`title` 必填，最多 120 字符；`url` 必填，最多 2048 字符，仅 HTTP/HTTPS，不含用户名密码。`text` 可选，最多 1000 字符；`imageUrl` 可选，最多 2048 字符，规则与链接相同。空图片显示默认游戏图标。

Wallet 展示卡片预览和当前身份可用的群列表，用户选择群后通过既有端到端加密聊天发送。业务方不能传群 ID 静默发送，也不能读取完整群列表。发送失败保留窗口，允许重试；发送期间禁用重复点击和主动关闭。成功只表示发送流程已完成，不表示群成员已阅读，不能将其当作可信的服务端奖励凭据。

群消息为独立卡片，包含标题、说明、Logo 和来源域名，支持转发；会话摘要显示 `[游戏] 名称` 或 `[应用] 名称`。点击打开内置游戏/DApp 页面，不自动登录或交易。普通 DApp 分享打开 DApp；游戏分享由宿主附加当前游戏横竖屏，接收方按该配置打开。调用方传入的 `origin`、`groupId`、`gameOrientation` 均不能覆盖宿主判断。来源字段用于展示，不是经过服务器认证的发布者证明；历史客户端可能显示原始文本。

错误码：`4001` 取消，`-32002` 已有分享等待处理，`-32602` 参数无效，`4200` 宿主不支持，`4100` 当前页面不在前台。分享为用户交互请求，无普通 RPC 读请求的超时；切换页面、刷新和退出时会取消等待中的请求。消息已开始发送后，页面离开不能撤回已经提交的消息。
