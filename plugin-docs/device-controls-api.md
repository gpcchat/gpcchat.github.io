# DApp／游戏重力方向控制与震动

接口用于倾斜手机控制角色、赛车或小球方向，以及游戏反馈震动。适用于 Wallet 内置 DApp／游戏 WebView，不需要连接付款钱包。重力控制与水平度自 Android/iOS 2.0.203（429）完整安装包提供；旧基座即使安装兼容 JS 更新也不会拥有新原生重力模块。震动可使用已有原生能力，但也须安装包含桥接接口的客户端更新。接入时先查询能力，桌面宿主返回设备能力不可用。iOS 通过 TestFlight 提供，上传接收、处理完成与可安装状态须分别确认。

```js
const gpc = window.gpc;
const capabilities = await gpc.device.getCapabilities();

if (capabilities.gravity.available) {
  const removeChange = gpc.gravity.onChange(({ control }) => {
    // 连续向量，支持任意角度、斜向与组合方向，不限于四个方向。
    // 范围 -1～1，以实际游戏画面为准：x 左负右正，y 上负下正。
    // control.angle 是 0～360° 的方向角，control.strength 是 0～1 的幅度。
    // 把方向输入保存到游戏状态，在游戏自己的逐帧循环里更新角色。
    player.inputX = control.x;
    player.inputY = control.y;
  });
  const removeStop = gpc.gravity.onStop(() => {
    player.inputX = 0;
    player.inputY = 0;
  });
  await gpc.gravity.start({ intervalMs: 50, deadZone: 0.08 });
  // 启动后的首帧会把当前握持姿势设为中立位置。
  // 玩家点击“重新校准”时（已收到至少一帧后）：
  // await gpc.gravity.calibrate();

  // 玩家关闭重力控制或离开游戏时：
  // await gpc.gravity.stop();
  // removeChange(); removeStop();
}

if (capabilities.vibration.available) {
  await gpc.vibrate({ durationMs: 100 });
  // await gpc.cancelVibration();
}
```

## 能力查询

`gpc.device.getCapabilities()` / RPC `gpc_device_getCapabilities`，无参数：

```json
{
  "gravity": {
    "available": true,
    "minIntervalMs": 16,
    "maxIntervalMs": 1000,
    "unit": "m/s2",
    "coordinateSystem": "device"
  },
  "vibration": {
    "available": true,
    "durationControl": true,
    "maxDurationMs": 1000
  }
}
```

`gravity.available` 同时取决于原生模块与设备传感器。没有 Android `TYPE_GRAVITY` 或 iOS Device Motion 的设备返回 false，不以包含运动加速度的原始加速度冒充重力。`vibration.available` 表示宿主提供震动调用，实际触感仍受硬件及系统设置影响；iOS `durationControl` 为 false。

## 重力方向控制

`gpc.gravity.start({ intervalMs?, deadZone? })` / RPC `gpc_gravity_start`，`params: [options]`；也可省略参数。`intervalMs` 为 16～1000 的整数，默认 50；采样与跨桥接回调频率受设备影响，属于期望间隔。`deadZone` 为 0～0.5 的数字，默认 0.08，抑制手部轻微抖动。每个页面同时只能有一个订阅，再次启动返回 `-32002`，需先停止。

成功返回 `{ active: true, subscriptionId, intervalMs, unit: 'm/s2', coordinateSystem: 'device' }`。启动成功表示传感器订阅已登记；无数据、系统拒绝或后续传感器错误会触发停止事件。5 秒仍无首帧会停止。

`gpc.gravity.onChange(handler)` 注册数据回调并返回取消监听函数；也可使用 `ethereum.on('gravityChanged', handler)`。

```js
{
  subscriptionId: 'gravity-...',
  x: 0, y: 0, z: 9.80665, // 原始重力，m/s²，固定设备坐标
  timestamp: 1793330000000, // Unix 毫秒时间
  rotation: 0,             // 0/90/180/270，当前画面相对传感器坐标的旋转
  control: { x: 0, y: 0, angle: null, strength: 0 }, // 连续方向与幅度
  level: { roll: 0, pitch: 0, inclination: 0, faceUp: true }, // 真实水平度，角度单位为度
  unit: 'm/s2',
  coordinateSystem: 'device'
}
```

游戏优先使用 `control`：x、y 是范围 -1～1 的连续值，斜向和任意角度可同时具有两个分量，不使用四方向或八方向枚举。向左倾斜为负 x，向右倾斜为正 x；向画面上方倾斜为负 y，向画面下方倾斜为正 y。`angle` 为 [0, 360) 度，以画面右方为 0°、顺时针增加（下 90°、左 180°、上 270°），中立时为 null；`strength` 为向量长度并限幅到 0～1。原始 x/y/z 仍保留，供业务自行做三轴计算。

横竖屏和 Wallet 为游戏画面额外施加的旋转补偿都参与换算，不需要业务再次旋转 `control`。首次采样及画面坐标发生旋转时会自动设定中立姿势。业务需要按游戏帧率读取最近一次输入，并可自行调整速度、灵敏度或仅使用横向输入。

`level` 提供手机平放时的水平度，始终以真实水平面为基准，独立于游戏中立姿势校准：`roll` 为左右倾角（右侧降低为正，范围 -90～90°），`pitch` 为前后倾角（画面下方降低为正，范围 -90～90°），`inclination` 为屏幕平面相对水平面的总倾角（0～90°）；`faceUp` 区分屏幕朝上与朝下。平放接近 0°、竖起接近 90°，传感器精度影响读数。`level` 的左右／前后同样跟随实际游戏画面。它可用于平衡、小球、坡度或水平仪逻辑，不将玩家校准姿势误当成真实水平面。

`gpc.gravity.calibrate()` / `gpc_gravity_calibrate` 无参数，用最近一帧重新设定中立姿势，返回 `{ calibrated: true }`。尚无数据时返回 `-32002`。校准与死区只影响 `control`，原始 x/y/z 保持。

原始坐标与 Android 传感器约定一致：自然方向下 x 向右、y 向上、z 向屏幕外，屏幕朝上平放时 z 约为 +9.8。iOS 数据已换算为相同单位和符号；原始坐标不跟随画面旋转。

`gpc.gravity.stop()` / `gpc_gravity_stop` 无参数，返回 `{ active: false }`。`gpc.gravity.onStop(handler)` 或 `ethereum.on('gravityStopped', handler)` 接收 `{ subscriptionId, reason }`；reason 包括 `requested`、`background`、`page_hidden`、`page_error`、`navigation`、`reload`、`sensor_error`、`sensor_timeout` 和 `start_failed`。

后台、页面失焦、导航、刷新与退出时释放订阅，迟到事件按原生订阅 ID 和页面桥接标识隔离；回到前台后由游戏重新调用 start，不自动恢复。停止后业务应清零方向输入。重力数据不由 Wallet 上传到服务器。

## 震动

`gpc.vibrate({ durationMs? })` / `gpc_vibrate`，`params: [options]`；也可省略参数。`durationMs` 为 1～1000 的整数，默认 200，不支持无限循环。两次震动请求至少间隔 100 毫秒。

返回 `{ accepted: true, durationMs, durationControl }`，表示已调用系统震动能力，不保证硬件实际发出震动。Android 支持请求时长；iOS 为系统单次震动，约 400 毫秒，忽略请求时长并返回 `durationControl: false`。

`gpc.cancelVibration()` / `gpc_cancelVibration` 无参数，返回 `{ cancelled: true }`。后台或离开页面也会取消该页面发起的震动；iOS 已开始的短脉冲由系统完成，不能保证中途截断。

## 错误与接入边界

`-32602` 参数无效或额外字段；`4100` 页面不在前台或请求已因页面切换取消；`4200` 宿主／设备不支持或原生启动失败；`-32002` 已有重力订阅或校准尚无数据；`-32005` 震动调用过频。原生请求仍经过 Wallet 的来源和 bridge token 校验，不授予资金连接、签名或交易权限。

原生实现依据 [Android 运动传感器](https://developer.android.com/develop/sensors-and-location/sensors/sensors_motion)、[屏幕旋转定义](https://developer.android.com/reference/android/view/Display#getRotation())、[Apple Core Motion](https://developer.apple.com/documentation/coremotion/cmmotionmanager) 和 [React Native 震动接口](https://reactnative.dev/docs/0.83/vibration)。
