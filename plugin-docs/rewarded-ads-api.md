# DApp 激励广告 API v1

完整业务链路与示例代码见[业务接入指南](ad-rewards-integration-guide.md)。

新增 SDK 基座 2.0.201（427）：Android 含穿山甲／优量汇，已更新官网；iOS 再含快手，已上传 TestFlight，处理与可安装状态待确认。广告继续关闭，旧 426 不含新增原生模块。见[发布记录](../tech/ad-native-base-427-release-20261021.md)及[集成记录](../tech/ad-native-sdk-integration-20261021.md)。

当前版本：多 SDK 内部分流与宿主自动绑定身份已于 2026-10-21 11:06／11:07 发布后端及 Android/iOS 426 全量 stable OTA，广告保持关闭。见[本轮发布记录](../tech/ad-routing-identity-release-20261021.md)。下述 10:33 记录为首轮发布。

状态：2026-10-21 已发布后端和 Android/iOS 426 stable OTA，未接入真实广告 SDK、未启用广告位。426 需要加载本次 OTA 才有 `window.gpc.ads`，旧客户端需检测接口存在性。详见[发布记录](../tech/ad-rewards-release-20261021.md)。

## 业务调用

广告由 Wallet 主框架展示，业务只传广告位和不透明凭证，无需指定 SDK 或用户。原生 WebView 和桌面 Provider 都暴露同一组方法；当前桌面没有广告适配器上下文，明确返回 `unsupported_platform`。普通浏览器不注入此接口。

```js
const ads = window.gpc?.ads;
if (!ads) {
  // 旧版本或普通浏览器：隐藏广告入口，保留正常游戏路径。
  return;
}
const capabilities = await ads.getCapabilities();
if (!capabilities.available || !capabilities.placements.includes('revive')) return;

// 用户主动点击已说明奖励条件的“看广告复活”按钮后执行：
// 业务后端验证自己的登录会话后，向框架申请广告凭证。
const { rewardTicket } = await businessApi.createRewardTicket({ placement: 'revive' });
try {
  // 可选：同一凭证预加载；show 也可自行加载。
  await ads.load({ placement: 'revive', rewardTicket });
  const result = await ads.show({ placement: 'revive', rewardTicket });
  if (result.rewardStatus === 'pending_verification') {
    // 查询业务端自己的奖励状态，发奖由业务端按签名回调决定。
    await businessApi.refreshRewardStatus({ rewardTicket });
  }
} catch (error) {
  // 无填充、退出、超时等均恢复游戏界面，避免强制反复观看。
  console.log(error.code, error.data?.reason);
}
```

`businessApi` 是业务自己的示意接口，不是已部署服务。框架后端提供凭证签发、宿主预检、平台验签适配与签名回调；奖励由业务端发放，详见[通用后端接入文档](ad-reward-callback-api.md)。真实 SDK／平台验签尚未接入；接口与 426 OTA 已发布，广告默认关闭。

也可直接调用 `window.ethereum.request({ method, params })`：

| 方法 | params | 说明 |
| --- | --- | --- |
| `gpc_ads_getCapabilities` | `[]` 或省略 | 查询宿主当前配置与来源权限，无需解锁／连接付款钱包 |
| `gpc_ads_load` | `[{ placement, rewardTicket? }]` | 带凭证预加载返回 `loaded`；多 SDK 模式无凭证返回 `deferred`，不调用 SDK |
| `gpc_ads_show` | `[{ placement, rewardTicket }]` | 展示激励广告，允许适配器内部加载；不要求先调用 load |

`placement` 为 1～64 位 ASCII 字母、数字、`_ . : -`，首位为字母或数字。`rewardTicket` 为非空、最多 2048 个 JS 字符的不透明字符串。仅接受表内字段，不接受游戏传入原始广告位 ID、回调 URL、用户地址、奖励数量或 SDK 配置。

能力查询示例：

```json
{
  "apiVersion": 1,
  "available": false,
  "formats": [],
  "placements": [],
  "rewardVerification": "server_required",
  "reason": "sdk_not_configured"
}
```

启用后 `available` 为 `true`，`formats` 为 `["rewarded"]`，`placements` 只列出当前来源允许的广告位，并省略 `reason`。这表示平台、配置、来源与同意条件允许请求，不保证有填充或广告已经缓存。

展示返回：

- 达到平台奖励条件：`{ status: 'completed', placement, rewardStatus: 'pending_verification', transactionId? }`。
- 未达到奖励条件而关闭：`{ status: 'closed', placement, rewardStatus: 'not_earned', transactionId? }`。

**没有任何前端结果代表服务端已核验或奖励已发放。** `transactionId` 是可选关联信息，也不能单独作为发奖证据。不要按视频结束、广告关闭或广告点击发奖。

## 错误约定

Promise 拒绝的错误具有 `code`、`message`、`data.reason`。

| code | reason | 处理 |
| --- | --- | --- |
| `4200` | `sdk_not_configured` / `unsupported_platform` | 隐藏广告入口，保留游戏正常路径 |
| `4200` | `consent_required` | 由宿主隐私流程处理；游戏不能代替用户同意 |
| `4100` | `origin_not_allowed` / `placement_not_allowed` | 检查宿主白名单 |
| `-32602` | `invalid_origin` / `invalid_params` | 修正接入参数 |
| `-32010` | `busy` / `rate_limited` | 不要并发展示或立即循环重试 |
| `4001` | `cancelled` | 页面退出、失焦或请求取消，恢复界面 |
| `-32005` | `timeout` | 查询后端奖励状态后再决定是否重试 |
| `-32000` | `adapter_error` | SDK 加载／展示失败或返回非法结果 |
| `-32004` | `no_fill` | 预留给未来适配器报告无可用广告 |
| `4200` | `unsupported_method` | 未支持的广告方法，不会进入链 RPC 或签名流程 |

移动桥接另有 190 秒兜底超时，`data` 为 `{ method, timeoutMs }`；主框架 load 超时 30 秒、show 超时 180 秒，正常由主框架先返回结构化原因。超时不是“肯定没获得奖励”，需要查询游戏服务端状态。

## 主框架适配器接口

接口位于 `src/services/dappAdService.ts`，不依赖 React Native 或特定广告平台。默认单例 `dappAdService` 未配置，注册只允许由可信宿主代码执行，DApp 不能通过桥接注册或切换 SDK。

平台获得准入、原生 SDK 集成并处理隐私初始化之后，宿主可以执行：

```ts
import { dappAdService } from './dappAdService';

// adapterA/B、隐私状态和认证请求均为待接平台的可信宿主实现。
dappAdService.configureProviders(
  { platformA: adapterA, platformB: adapterB },
  [{ origin: 'https://approved-business.example', placement: 'bonus', providers: ['platformA', 'platformB'] }],
  provider => hostPrivacyState.canRequestAds(provider),
  async ({ origin, placement, rewardTicket, signal }) => {
    // 当前 Wallet JWT 不提供给网页，身份不来自网页参数。
    const { data } = await hostAuthenticatedPost('/api/wallet/ad-rewards/verify',
      { origin, placement, rewardTicket }, { signal });
    return data; // wallet、origin、placement、provider、adUnitId
  },
);
```

后端按配置权重随机选取平台并固定到凭证，宿主按可信预检结果分发给对应 SDK。DApp 能力和播放结果不暴露 SDK 标识；宿主分别检查所选 SDK 的支持与隐私授权。失败不静默切换，同一凭证的预加载与展示保持一致。旧单适配器 `configure` 接口保留兼容。

多 SDK 模式无凭证的 `load` 返回 `deferred`，表示未加载。真实 SDK 尚未接入，本轮没有原生依赖变化；后续集成 SDK 按实际原生变更构建完整包。

`RewardedAdAdapter` 必须实现：

- `supports(platform)`：只声明实际已集成的平台；查询时不得触发 SDK 初始化、联网或收集信息。
- `load({ origin, placement, platform, signal, provider, adUnitId, identityWallet, rewardTicket })`：使用可信预检路由与身份，缓存绑定凭证、身份、来源、平台与广告位，不得跨凭证复用。
- `show({ origin, placement, platform, signal, provider, adUnitId, identityWallet, rewardTicket })`：确保隐私条件仍满足、用户主动选择观看，再展示广告；返回 `{ outcome: 'reward_earned' | 'dismissed', transactionId? }`。播放开始后不可立刻返回；奖励事件需要记录，在关闭／结束并清理界面后结算 Promise，防止同时展示第二条广告。

适配器需要处理取消、销毁缓存及监听、恢复方向／状态栏／游戏音频，取消后不再展示新广告。SDK 回调、原生 Activity／ViewController 的生命周期和真机测试在后续接平台时实现。用 `DAppAdError(-32004, 'no_fill', '暂无可用广告')` 报告无填充；普通 SDK 异常会被主框架替换为通用错误，避免向网页泄漏原始异常。主动抛出的 `DAppAdError` 必须使用安全文案，不能包含密钥或奖励凭证。

主框架目前执行：

- 来源取自宿主已有来源校验通道，不接受网页 params 声明；按标准 URL origin 精确匹配协议、域名和端口，路径不参与授权。子域不会自动继承权限。
- 仅前台、聚焦且未取消的移动页面可以 load/show。
- 全局只允许一个进行中的 load/show。页面失焦、导航或 WebView 重建时取消请求，卸载也取消；后台期间不接受新请求。广告过程中应用后台切换由适配器处理，主框架不因 AppState 短暂变化直接认定奖励失败。
- 超时或取消通过 `AbortSignal` 通知适配器。若适配器不响应取消，全局锁保留至它实际完成，阻止重叠展示；需修复适配器，不能靠网页重试解锁。
- 每来源／广告位默认展示间隔 30 秒，从调用适配器展示时计算，失败也占用间隔。这是进程内体验保护，不能替代服务端用户／设备配额或反作弊。
- 新广告方法在访问付款钱包签名器之前分流，不改变登录、交易和签名权限。

## 服务端接入边界

框架只负责凭证、广告核验和可靠业务回调，适用于游戏、权益、Token 空投等业务，不判断或执行具体奖励。

业务服务端使用独立 App 凭据申请凭证，绑定业务动作 `context`，不传用户；原生 SDK 适配器展示前需使用宿主 Wallet 认证调用预检接口，框架取得当前身份并关联真实 WebView 来源与广告位。广告平台适配器负责平台证明验签，核验成功后框架向注册业务地址发送有签名和稳定事件 ID 的回调。业务端验签、去重并自行发奖、提供自己的奖励状态查询。

[通用后端接入文档](ad-reward-callback-api.md) 包含真实源码接口、签名规则、重试和配置。当前默认关闭且未注册真实平台，不提供模拟完成、强制发奖或链上转账功能。实际接平台仍以平台接受 Wallet 宿主及相应业务场景为前提。
