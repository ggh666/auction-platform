# 游戏资产交换平台

这是一个面向微信小程序的游戏资产信息发布与竞价平台。平台提供资产展示、审核、竞价、成交记录、举报处理和违规公示能力，用于帮助运营方管理合规的资产竞价流程。

平台明确不提供支付、担保、交付、评论、私信、联系方式交换，成交后的资金与交付安排不在本系统内完成。

## 当前能力

当前代码已经具备生产运行的核心闭环：`NODE_ENV=production` 下自动接入 MySQL-backed repositories，用户、资产、图片、竞价、站内通知、举报、违规公示、管理员账号、系统配置、图片内容安全结果和后台操作日志会写入 MySQL。图片上传写入 Cloudflare R2，资产记录保存图片 URL。

小程序端已支持登录、首页选择游戏、按“账号 / 道具”拆分浏览交换、列表默认展示最近 7 天发布的数据、关键词搜索默认查询最近 60 天数据、下拉刷新与触底分页、详情图片预览、从当前分类直接发布资产、道具龙珠分类结构化录入和展示、最多 9 张图片选择与删除、图片上传、在线出价、出价人展示、关注/取消关注信息、列表下方查看“我的关注”、被超价站内通知、未读价格变动提醒、个人中心、我的发布/出价/成交记录。成交记录支持分页并展示资产名称。配置微信订阅消息模板后，用户成功提交估价后会请求“价格变动提醒”授权，后续被其他用户超价时会尝试发送微信服务通知，并继续保留站内通知兜底。当前小程序端暂不展示举报入口，后端举报接口和后台举报审核能力保留。后台确认举报并发布违规公示后，仅关联的具体资产列表和详情会展示“该宝贝关联违规公示”标签，不会扩散到同卖家的其他资产；待审核或未公示的举报不会在小程序公开展示。发布和出价节点会弹出统一免责声明：“本平台仅提供信息交换，不涉及任何线上资金交易，请务必走游戏内安全交易渠道，线下转账风险自担”。小程序发布页当前不展示截止时间，服务端会在未传 `originalEndAt` 时填入默认长期有效时间并继续保留数据库截止时间字段；资产审核通过时会把实际交换截止时间改为审核通过后 24 小时，小程序交换列表、关注列表、我的发布和详情页展示该截止时间。资产列表价格优先展示加价后的 `currentPriceCents`，暂无出价时展示起始价。发布资产会受后端风控限制：用户默认每天最多发布 3 条，管理员可以在后台对单个用户设置每日发布次数，`0` 表示禁止发布；用户信誉分默认 100 分，主理人发现资产违规可每次扣减发布者 5 分，信誉分 70 分及以下只能浏览，不能发布信息、上传资产图片、关注/取消关注、出价、举报或标记通知已读，扣分满 3 个月后自动恢复 100 分。被后台封禁的用户即使仍持有旧登录 token，也会被服务端禁止发布信息、上传资产图片、出价和提交举报。举报也受后端限制：必须关联具体资产，且只有参与该资产出价的用户可以提交；管理后台举报列表会展示举报人姓名和用户 ID，便于运营核对。生产环境强制接入微信官方内容安全：资产发布和举报文本会走 `msgSecCheck`，上传图片会走 `mediaCheckAsync`，图片审核未通过或仍在等待回调时不允许后台审核通过；生产环境如果关闭内容安全或 strict 模式，API 会拒绝启动。

本地开发和测试环境仍默认使用内存仓库。API 保留生产安全闸门：如果生产环境没有显式注入持久化仓库，会拒绝启动，避免误用内存数据承载真实业务。

## 目录

- `shared/`: 共享类型、金额工具、状态模型和事件契约。
- `api/`: Fastify API、WebSocket、MySQL 数据访问和 Cloudflare R2 适配。
- `admin/`: React/Vite 管理后台，用于仪表盘、审核、举报、用户和配置管理。
- `miniapp/`: uni-app 微信小程序端，用于用户登录、浏览、发布、图片上传、竞价、个人中心和举报。
- `tests/`: API 与端到端 smoke 测试。
- `docs/`: 系统用户手册、发布记录和阶段性实施计划。
- `deploy/`: 生产部署说明。

## 本地开发

先安装依赖：

```bash
cd products/auction-platform
npm install
```

启动 API：

```bash
npm run dev:api
```

启动管理后台：

```bash
npm run dev:admin
```

启动小程序构建：

```bash
npm run dev:miniapp
```

默认本地地址：

- API: `http://127.0.0.1:3002/`
- 管理后台: `http://127.0.0.1:5174/`

生产构建时需要显式配置前端 API 地址：

- 管理后台: `VITE_API_BASE=https://api.example.com`
- 小程序: `UNI_APP_API_BASE=https://api.example.com`

API 生产环境通过 `CORS_ALLOWED_ORIGINS` 控制跨域白名单，例如 `https://api.example.com,https://servicewechat.com`；未配置时使用当前线上后台域名和微信服务域名作为默认值。

## 验证命令

```bash
npm run typecheck
npm test
npm run verify:content-safety -- local
npm run e2e

VITE_API_BASE=https://api.example.com \
  npm run build --workspace @auction/admin

UNI_APP_API_BASE=https://api.example.com \
UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID=微信订阅消息模板ID \
  npm run build:mp-weixin --workspace @auction/miniapp
```

`npm run e2e` 需要管理后台开发服务已在 `http://127.0.0.1:5174/` 启动。

微信官方 `msgSecCheck` 和 `mediaCheckAsync` 的代码路径、线上冒烟和数据库验证方法见 `docs/content-safety-verification.md`。

微信价格变动服务通知的订阅消息模板配置、环境变量和线上验证方法见 `docs/wechat-price-change-subscribe-message.md`。

小程序端和后台管理端的完整功能、操作流程、角色权限和常见问题见 `docs/system-user-manual.md`。

Git 接入、首次提交、远程仓库、分支规范和发布标签建议见 `docs/git-version-management.md`。

## 后台角色权限

| 角色 | 可见页面 | 页面内主要能力 | 数据范围 |
| --- | --- | --- | --- |
| `super_admin` | 仪表盘、审核管理、资产数据、后台用户、主理人管理、前台用户、系统配置 | 全量管理；可导出资产数据、审核/批量审核资产、扣减违规资产卖家信誉分、确认/驳回举报、发布违规公示、下架/批量下架已上架资产、管理后台账号、绑定主理人、管理前台用户风控和系统配置 | 全部数据，包含未绑定主理人的历史资产 |
| `reviewer` | 仪表盘、审核管理、资产数据 | 查看和导出资产数据；通过/驳回/批量审核待审核资产；扣减自己名下违规资产卖家信誉分；查看、确认、驳回举报并发布违规公示 | 仅绑定主理人名下的数据；未绑定可用主理人时资产/举报列表为空，详情和操作返回 404 |
| `operator` | 仪表盘、资产数据 | 查看和导出资产数据；下架/批量下架已上架资产；当前无审核管理、举报审核、用户管理、主理人管理和系统配置入口 | 仅绑定主理人名下的数据；未绑定可用主理人时资产列表为空，详情和操作返回 404 |

管理后台侧边栏按角色控制页面入口；服务端接口会按 `admin:manage`、`asset:view`、`asset:review`、`asset:remove`、`user:view`、`user:ban`、`report:review`、`violation:publish`、`config:manage` 等权限再次校验。`operator` 当前保留 `auction:cancel` 权限，但还没有独立页面入口。

## 主要接口

小程序端使用的主要接口：

- `POST /api/auth/wechat-login`: 微信登录。
- `GET /api/profile/me`: 当前用户资料，包含 `creditScore` 和 `creditResetAt`。
- `GET /api/assets`: 进行中的交换列表，支持 `gameName`、`assetType`、`keyword`、`page`、`pageSize`、`createdWithinDays` 查询参数；未搜索时默认 `createdWithinDays=7`，带关键词搜索时默认 `createdWithinDays=60`；资产会返回 `principal`、`hasPublishedViolation` 和可选 `dragonBall`，携带用户 token 时还会返回 `followedByMe`。
- `GET /api/assets/:assetId`: 交换详情、资产图片、主理人摘要、卖家摘要、最近出价人信息、可选龙珠信息和已公示违规标签；未登录用户只能查看已上架且未截止的信息，卖家或参与过出价的用户携带 token 时可查看自己相关记录并返回 `followedByMe`。
- `POST /api/images`: 上传资产图片，返回 `objectKey` 和 `publicUrl`；可传 `assetType` 区分 R2 路径，账号图写入 `uploads/accounts/{userId}/...`，道具/装备图写入 `uploads/items/{userId}/...`；封禁用户不可上传。
- `POST /api/assets`: 发布资产，支持携带已上传图片信息，并校验用户每日发布次数和信誉分；`originalEndAt` 非必填，未传时服务端填入默认长期有效时间；道具龙珠可传 `itemCategory="龙珠"` 和 `dragonBall.profession/quality/attributes`，后端会按职业派生系别；封禁用户或信誉分 70 分及以下用户不可发布。
- `POST /api/assets/:assetId/follow`: 关注已上架且未结束的信息；封禁用户不可关注。
- `POST /api/assets/:assetId/unfollow`: 取消关注信息。
- `GET /api/profile/follows`: 我的关注列表，支持 `page`、`pageSize` 分页。
- `POST /api/bids`: 出价；封禁用户不可出价。
- `GET /api/profile/assets`: 我的发布。
- `GET /api/profile/bids`: 我的出价。
- `GET /api/profile/results`: 我的成交/流拍记录，支持 `page`、`pageSize` 分页，并返回资产名称摘要。
- `GET /api/profile/notifications`: 我的站内通知，返回通知列表和 `unreadCount` 未读数量；通知存储异常时降级为空列表并写入服务端错误日志。
- `POST /api/profile/notifications/:notificationId/read`: 标记站内通知已读。
- `POST /api/reports`: 后端保留的举报提交接口；当前小程序不展示入口。请求必须携带 `targetUserId`、`assetId`、`reason`、`evidence`，且当前用户必须参与过该资产出价；封禁用户不可举报。
- `GET /api/violations`: 违规公示列表。
- `WS /ws/auctions?assetId=...`: 交换详情页实时刷新出价和延时事件。
- `GET|POST /api/wechat/events`: 微信消息推送回调，用于 `mediaCheckAsync` 异步图片安全结果。

管理后台使用的主要接口：

- `POST /admin/auth/login`: 管理员登录；同一 IP 和登录名连续错误会短时限流，降低暴力破解风险。
- 后台所有列表查询统一支持 `page`、`pageSize` 分页，并返回 `items`、`total`、`page`、`pageSize`。
- `GET /admin/admin-users`: 后台登录账号列表，返回角色、状态和关联主理人。
- `POST /admin/admin-users`: 创建后台登录账号，角色仅支持 `super_admin`、`reviewer`、`operator`。
- `POST /admin/admin-users/:adminId/update`: 更新后台登录名、角色或启停状态；后台页面使用该接口保存基础信息，避免 PATCH 预检失败。
- `POST /admin/admin-users/:adminId/reset-password`: 为后台账号生成一次新的临时密码，旧密码立即失效，响应返回 `temporaryPassword` 供超级管理员转交。
- `PATCH /admin/admin-users/:adminId`: 兼容旧版调用，可更新后台登录名、密码、角色或启停状态。
- `DELETE /admin/admin-users/:adminId`: 停用后台登录账号，并同步停用绑定主理人。
- `GET /admin/dashboard`: 运营仪表盘统计指标、待审核资产和待处理举报。
- `GET /admin/assets`: 资产数据列表，支持状态、游戏名称、资产类型、关键词和分页。
- `GET /admin/assets/export`: 导出资产数据 Excel，支持与资产数据列表相同的筛选条件和数据权限。
- `GET /admin/assets/review`: 待审核资产分页列表。
- `POST /admin/assets/:assetId/approve`: 审核通过资产。
- `POST /admin/assets/:assetId/reject`: 驳回资产。
- `POST /admin/assets/:assetId/deduct-credit`: 主理人审核自己名下资产时扣减发布者信誉分 5 分，并写入后台操作日志。
- `GET /admin/users`: 用户管理分页列表，支持关键词查询，返回封禁状态、每日发布次数、违规次数和信誉分。
- `POST /admin/users/:userId/ban`: 封禁用户。
- `POST /admin/users/:userId/unban`: 解除封禁。
- `POST /admin/users/:userId/publish-limit`: 设置或清空单个用户每日发布次数。
- `GET /admin/configs`: 平台配置分页列表。
- `POST /admin/configs/:key`: 更新平台配置，例如默认每日发布次数。
- `GET /admin/reports`: 举报分页列表，返回举报人姓名 `reporterDisplayName` 和举报人 ID。
- `POST /admin/reports/:reportId/confirm`: 确认举报。
- `POST /admin/reports/:reportId/reject`: 驳回举报。
- `POST /admin/reports/:reportId/publish-violation`: 发布违规公示。

## 部署概要

生产部署建议使用腾讯云服务器运行 API 和进程守护，使用服务器上已安装的 MySQL 保存业务数据，使用 Cloudflare R2 保存图片资源，使用 Nginx 托管管理后台静态产物并反向代理 API、WebSocket 与微信内容安全回调。

部署前需要准备 `api/.env.example` 中列出的环境变量、执行数据库迁移、配置 HTTPS 证书，并在微信公众平台配置小程序 request、uploadFile、socket 合法域名。详细注意事项见 `deploy/tencent-cloud.md`，发布记录见 `docs/releases.md`。
