# 微信内容安全接口验证

本文用于验证微信官方 `msgSecCheck` 文本安全和 `mediaCheckAsync` 图片安全是否在当前项目中真实生效。

不要只用 `赌博`、`卖淫`、`偷盗` 这类词验证 `msgSecCheck`。服务端会先命中本地高危词兜底并返回 `content_safety_risky`，这能证明本地策略有效，但不能单独证明微信 `msgSecCheck` 被调用。

## 代码路径

| 能力 | 业务入口 | 项目调用路径 | 微信接口 |
| --- | --- | --- | --- |
| 文本安全 | `POST /api/assets`、`POST /api/reports` | `contentSafety.assertTextAllowed` -> `api/src/modules/contentSafety/wechatContentSafety.service.ts` | `https://api.weixin.qq.com/wxa/msg_sec_check` |
| 图片安全 | `POST /api/images` | `contentSafety.requestImageCheck` -> `api/src/modules/contentSafety/wechatContentSafety.service.ts` | `https://api.weixin.qq.com/wxa/media_check_async` |
| 图片回调 | `GET|POST /api/wechat/events` | `contentSafety.handleImageCheckCallback` | 微信消息推送 |

图片异步检测结果写入 MySQL 表 `content_safety_image_checks`。后台审核资产时会读取该表；图片没有检测记录、仍是 `pending`、`failed` 或明确 `risky` 时，审核通过会被服务端拦截。微信返回 `review` 表示建议人工复核，不再按“图片违规”自动拦截，由后台审核员结合图片内容判断。

## 本地代码路径验证

```bash
npm --prefix products/auction-platform run verify:content-safety -- local
```

该命令会运行：

```bash
npm --prefix products/auction-platform test -- \
  tests/api/content-safety.test.ts \
  tests/api/assets.test.ts \
  tests/api/reports.test.ts
```

重点确认：

- `msgSecCheck` 返回 `risky` 时，发布和举报会被拦截。
- 本地高危词兜底会提前拦截明确违规词。
- 图片上传会触发异步图片安全检测。
- `/api/wechat/events` 会接收微信回调并更新图片检测结果。

## 线上配置验证

在服务器上执行：

```bash
cd /path/to/auction-platform
npm run verify:content-safety -- env
```

默认读取 `/etc/auction-api.env`。如果环境文件路径不同：

```bash
ENV_FILE=/实际路径/auction-api.env npm run verify:content-safety -- env
```

必须满足：

```env
CONTENT_SAFETY_ENABLED=true
CONTENT_SAFETY_STRICT=true
WECHAT_APPID=你的小程序AppID
WECHAT_APP_SECRET=你的小程序AppSecret
WECHAT_EVENT_TOKEN=你在微信公众平台消息推送中填写的Token
```

正式环境如果把 `CONTENT_SAFETY_ENABLED` 或 `CONTENT_SAFETY_STRICT` 设置为 `false`，API 会拒绝启动。

## 微信回调路径验证

微信公众平台消息推送 URL 填：

```text
https://api-auction.toolmatrix.top/api/wechat/events
```

Token 必须和 `WECHAT_EVENT_TOKEN` 完全一致。当前服务端按明文模式解析消息，消息加解密方式建议先选明文模式。

提交微信平台 URL 校验后，在服务器看日志：

```bash
journalctl -u auction-api -n 100 --no-pager
```

预期看到 `GET /api/wechat/events`，并且微信平台校验成功。这个 GET 校验成功后，`mediaCheckAsync` 的异步 POST 回调才有可靠入口。

## 验证 msgSecCheck

先准备变量：

```bash
API_BASE=https://api-auction.toolmatrix.top
TOKEN='替换成小程序用户 token，不要带 Bearer 前缀'
PRINCIPAL_ID='替换成 GET /api/principals 返回的可用主理人 id'
```

运行：

```bash
API_BASE="$API_BASE" TOKEN="$TOKEN" PRINCIPAL_ID="$PRINCIPAL_ID" \
  npm run verify:content-safety -- text
```

预期：

- 正常配置下返回 `200`，资产状态为 `pending_review`。
- 如果在测试环境临时改错 `WECHAT_APP_SECRET`，并保持 `CONTENT_SAFETY_STRICT=true`，同样请求应返回 `502 wechat_content_safety_failed`。这能证明发布接口没有绕过微信 `msgSecCheck`。

## 验证 mediaCheckAsync

准备一张正常 JPG、PNG 或 WebP 图片，然后运行：

```bash
API_BASE=https://api-auction.toolmatrix.top \
TOKEN='替换成小程序用户 token，不要带 Bearer 前缀' \
IMAGE_PATH=./safe-test.jpg \
  npm run verify:content-safety -- image
```

预期响应：

```json
{
  "image": {
    "publicUrl": "...",
    "safetyStatus": "pending",
    "safetyTraceId": "..."
  }
}
```

继续查数据库：

```bash
mysql -u auction_user -p auction_platform -e "
SELECT public_url,status,trace_id,label,updated_at
FROM content_safety_image_checks
ORDER BY updated_at DESC
LIMIT 10;"
```

预期：

- 上传后先出现 `status = pending`。
- `trace_id` 不为空，证明微信 `mediaCheckAsync` 已返回异步检测编号。
- 微信回调后状态变为 `pass`、`review` 或 `risky`。

如果一直停留在 `pending`，优先检查：

- R2 图片 `publicUrl` 是否能被公网访问。
- 微信公众平台消息推送 URL 和 Token 是否正确。
- Nginx 是否转发 `POST /api/wechat/events`。
- `journalctl -u auction-api -n 100 --no-pager` 是否有微信回调请求或签名错误。

## 验证图片审核拦截

把刚上传图片返回的 `objectKey`、`publicUrl`、`mimeType`、`sizeBytes` 带入 `POST /api/assets` 创建资产，然后运行：

```bash
API_BASE=https://api-auction.toolmatrix.top \
ADMIN_TOKEN='替换成后台管理员 token，不要带 Bearer 前缀' \
ASSET_ID='替换成刚发布的资产 id' \
  npm run verify:content-safety -- approve
```

预期：

- 图片仍是 `pending` 时，返回 `400 image_safety_pending`。
- 如果后台审核员已人工查看图片并确认无违规内容，可以在管理后台二次确认“继续通过”；该请求会带 `imageSafetyOverride=true`，只覆盖已有检测记录但仍为 `pending` 或 `failed` 的图片。
- 如果图片没有 `content_safety_image_checks` 记录，返回 `400 image_safety_missing`，必须重新通过 `/api/images` 上传并触发 `mediaCheckAsync`，不能人工绕过。
- 图片回调为 `pass` 后，审核通过。
- 图片回调为 `review` 时，不按违规自动拦截，由后台审核员人工判断。
- 图片回调为 `risky` 时，返回 `400 image_safety_risky`，不能通过人工确认绕过。

## 直接 curl 版本

文本验证：

```bash
curl -i "$API_BASE/api/assets" \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  --data '{
    "gameName":"塔防精灵",
    "serverName":"内容安全验证区",
    "assetType":"账号",
    "principalId":"'"$PRINCIPAL_ID"'",
    "title":"内容安全验证正常标题",
    "description":"这是一条普通资产说明，用于验证微信文本安全接口正常放行",
    "startingPriceCents":100,
    "minIncrementCents":100,
    "originalEndAt":"2026-05-29T12:00:00.000Z",
    "images":[]
  }'
```

图片验证：

```bash
BASE64=$(base64 -i ./safe-test.jpg | tr -d '\n')

curl -i "$API_BASE/api/images" \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  --data '{
    "fileName":"safe-test.jpg",
    "mimeType":"image/jpeg",
    "base64Data":"'"$BASE64"'"
  }'
```
