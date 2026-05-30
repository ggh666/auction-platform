# 微信价格变动服务通知配置说明

本文说明“小程序用户出价后，后续价格变动时通过微信服务通知提醒用户”的配置和验证方法。

## 方案说明

本项目使用微信小程序订阅消息实现服务通知，不使用动态消息 `updatable-message`。

- 订阅消息适合给单个用户发送“你的出价被超过”这类服务通知。
- 动态消息 `updatable-message` 更适合更新已分享出去的动态卡片，不适合做单个用户的价格变动通知。
- 订阅消息必须由用户主动授权。当前小程序会在用户成功提交估价后调用 `requestSubscribeMessage` 请求授权，用户拒绝授权不影响本次出价结果。
- 后端在新出价超过历史出价后，仍会创建站内通知；如果用户已授权且模板配置正确，会同时调用微信订阅消息发送接口。

相关微信官方文档：

- `requestSubscribeMessage`: https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html
- `subscribeMessage.send`: https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/mp-message-management/subscribe-message/sendMessage.html
- 动态消息 `updatable-message`: https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/updatable-message/

## 需要你在微信公众平台做的事

1. 登录微信公众平台，进入对应小程序。
2. 进入“功能 -> 订阅消息”，添加一个用于价格变动提醒的一次性订阅模板。
3. 模板标题建议使用“价格变动提醒”或“交换信息价格变动提醒”。
4. 模板关键词必须和代码发送字段对应。当前线上模板字段为：

| 代码字段 | 建议关键词 | 示例内容 |
| --- | --- | --- |
| `amount3` | 设定价格 | 500.00 |
| `amount4` | 当前价格 | 450.00 |
| `thing15` | 产品名称 | 紫色工程珠子 |
| `time11` | 价格变动时间 | 2026-05-30 20:00 |

5. 复制模板 ID，后端和小程序构建都要使用同一个模板 ID。
6. 如果模板审核后微信返回的关键词编号不是 `amount3/amount4/thing15/time11`，需要调整模板关键词顺序，或者同步调整后端发送字段。
7. `amount3` 使用被提醒用户原来的出价金额，`amount4` 使用当前最新价格。金额字段只发送数字，不带“元宝”，避免微信 `amount` 类型校验失败。

## 需要配置的环境变量

API 服务端：

```env
WECHAT_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID=微信订阅消息模板ID
WECHAT_SUBSCRIBE_MESSAGE_MINIPROGRAM_STATE=formal
```

`WECHAT_SUBSCRIBE_MESSAGE_MINIPROGRAM_STATE` 可选值：

- `formal`: 正式版小程序，生产环境默认使用这个。
- `trial`: 体验版小程序，灰度验证时可临时使用。
- `developer`: 开发版小程序，本地开发环境默认使用这个。

小程序构建：

```bash
UNI_APP_API_BASE=https://api-auction.toolmatrix.top \
UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID=微信订阅消息模板ID \
  npm run build:mp-weixin --workspace @auction/miniapp
```

如果小程序构建时没有配置 `UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID`，成功出价后不会弹出订阅授权，但出价和站内通知仍正常工作。

小程序构建已显式开放 `UNI_APP_` 环境变量前缀；也兼容 `VITE_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID`。线上建议统一使用 `UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID`，并确保它和服务端 `WECHAT_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID` 是同一个模板 ID。

## 线上验证方法

1. 使用真实微信登录小程序，不能用后端 mock 登录；微信服务通知依赖用户 `openid`。
2. 用户 A 打开某个已上架宝贝详情，提交一次估价。
3. 出价成功后应弹出微信订阅消息授权弹窗，选择允许。
4. 用户 B 对同一个宝贝提交更高估价。
5. 用户 A 应收到微信“服务通知”，点击后跳转到该宝贝详情页。
6. 同时检查小程序首页、交换列表或个人中心仍能看到站内未读价格变动提醒。

如果没有收到微信服务通知：

- 确认用户 A 提交估价时选择了允许订阅。
- 确认 API 环境变量 `WECHAT_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID` 和小程序构建变量 `UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID` 是同一个模板 ID。
- 确认 `WECHAT_APPID`、`WECHAT_APP_SECRET` 正确，服务端能获取微信 access token。
- 确认 `WECHAT_SUBSCRIBE_MESSAGE_MINIPROGRAM_STATE` 和当前小程序版本一致，体验版用 `trial`，正式版用 `formal`。
- 查看 API 日志中是否有 `failed to send price change subscribe message`。
- 如果微信返回用户未订阅或拒绝，服务通知不会发送，但站内通知仍会保留。

## 已实现代码路径

- 小程序订阅授权：`miniapp/pages/auctions/detail.vue` -> `miniapp/utils/subscribeMessage.ts`
- 出价入口：`POST /api/bids`
- 站内通知创建：`api/src/modules/bids/bids.routes.ts` -> `notifications.createMany`
- 微信订阅消息发送：`api/src/modules/subscribeMessages/subscribeMessage.service.ts`

## 限制与注意事项

- 一次性订阅授权通常只能发送一条对应服务通知；用户每次出价时都可以再次授权。
- 用户拒绝授权、模板 ID 未配置、微信发送失败时，不阻断出价，不影响站内通知。
- 信誉分 70 分及以下用户不能出价，因此也不会触发订阅授权。
- 微信模板内容要避免“拍卖”等表达，建议统一使用“交换信息”“价格变动”“估价”等文案。
