# 游戏资产交换平台

这是一个面向微信小程序的游戏资产信息发布与竞价平台。平台提供资产展示、审核、竞价、成交记录、举报处理和违规公示能力，用于帮助运营方管理合规的资产竞价流程。

平台明确不提供支付、担保、交付、评论、站内私信、平台内联系方式交换；已登录用户可通过微信官方客服入口咨询，客服沟通不写入本系统会话数据库，成交后的资金与交付安排不在本系统内完成。

## 当前能力

当前代码已经具备生产运行的核心闭环：`NODE_ENV=production` 下自动接入 MySQL-backed repositories，用户、资产、图片、竞价、成交跟进、站内通知、举报、违规公示、管理员账号、系统配置、图片内容安全结果和后台操作日志会写入 MySQL。图片上传写入 Cloudflare R2，资产记录保存图片 URL。

小程序端已支持登录、首页选择游戏、按“账号 / 道具”拆分浏览交换、列表默认展示最近 7 天发布的数据、关键词搜索默认查询最近 60 天数据、道具列表按主理人/龙珠职业/龙珠品质筛选、下拉刷新与触底分页、详情图片预览、在线出价、出价人展示、关注/取消关注信息、个人中心点击进入“我的关注”和“我的资产”、顶部“通知中心”、被超价站内通知、未读价格变动提醒、我的出价和成交记录。提交估价前必须确认出价承诺，成交后由主理人在后台根据线下跟进结果确认完成或取消；小程序成交记录只展示已完成且当前用户为最终最高出价者的记录，支持分页并展示资产名称、成交价、记录时间和成交状态，用户不能自行确认成交、放弃成交或补充联系方式。当前阶段不采集手机号、不提供站内私信；小程序仅在个人中心提供微信官方客服入口，通过出价承诺、成交跟进、后台备注和失联限制形成运营闭环。

配置微信订阅消息模板后，用户提交估价时会在确认免责声明后、发起估价请求前请求“价格变动提醒”授权，后续被其他用户超价时会尝试发送微信服务通知，并继续保留站内通知兜底。通知中心支持单条已读和全部已读。当前小程序端暂不展示举报入口，后端举报接口和后台举报审核能力保留。后台确认举报并发布违规公示后，仅关联的具体资产列表和详情会展示“该宝贝关联违规公示”标签，不会扩散到同卖家的其他资产；待审核或未公示的举报不会在小程序公开展示。出价节点会弹出统一免责声明：“本平台仅提供信息交换，不涉及任何线上资金交易，请务必走游戏内安全交易渠道，线下转账风险自担”。小程序“我的资产”常驻展示当前用户提交过的资产列表，支持分页查看待审核、已上架、已拒绝、已成交、已下架等状态；用户提交能力由后台平台配置 `user_asset_publish_enabled` 控制，默认开启，关闭时仅隐藏“提交资产”按钮并展示“暂未开放用户提交资产”，服务端仍会强制拒绝提交和图片上传。用户提交资产页的游戏名称为固定下拉选项，当前只允许“塔防精灵”；选择“道具”后可选择“普通道具”或“龙珠”，龙珠需要填写职业、品质和属性。用户提交资产后状态为 `pending_review`，必须由主理人后台审核通过后才会上架；后台“发布资产”页仍支持主理人受控发布并选择截止时间，发布后直接上架。资产列表价格优先展示加价后的 `currentPriceCents`，暂无出价时展示起始价；前台、后台、Excel 导出和微信订阅消息中的金额统一按整数元宝展示，不显示小数。

管理后台资产数据列表默认展示待审核和已上架资产，并按创建时间倒序排列；选择具体状态后可查看历史已结束、已取消、已下架等数据。资产数据列表支持把历史资产复制为发布草稿，停留在发布编辑页供主理人调整后再发布；资产详情支持修改草稿、待审核和已上架资产的截止时间，已结束、已成交、下架、驳回或取消的资产不可修改。后台新增成交跟进页，主理人可记录已联系、买家失联、已成交或取消；买家第 2 次失联会限制出价 7 天，第 3 次及以后限制出价 30 天，前台用户页会展示失联次数和出价限制截止时间。资产数据页“完成交易”和成交跟进页标记 `completed` 是同一个业务动作，任一入口完成后资产都会变为已结束，成交跟进单变为已成交，小程序详情、我的出价和关注列表会显示“成交”盖章，买家无法继续出价。后台资产详情可对疑似抬价的单条出价执行“撤销并限制”，限制时长支持 30 分钟、1 天或永久，解除入口在资产详情和前台用户管理页。用户信誉分默认 100 分，主理人发现资产违规可每次扣减发布者 5 分，信誉分 70 分及以下只能浏览，不能关注/取消关注、提交资产、上传资产图片、出价、举报或标记通知已读，扣分满 3 个月后自动恢复 100 分。被后台封禁的用户即使仍持有旧登录 token，也会被服务端禁止关注、取消关注、提交资产、上传资产图片、出价、标记通知已读和提交举报。举报也受后端限制：必须关联具体资产，且只有参与该资产出价的用户可以提交；管理后台举报列表会展示举报人姓名和用户 ID，便于运营核对。生产环境强制接入微信官方内容安全：用户提交资产文本和举报文本会走 `msgSecCheck`，用户上传资产图片会走 `mediaCheckAsync`；图片审核提交给微信时使用 API 后端短期签名代理 URL，由 API 从 R2 读取原图返回给微信，数据库和前台仍保留 Cloudflare 图片展示 URL；微信回调返回 `errcode=-1008` 媒体下载失败时，API 默认在回调处理中同步重新提交检测，最多重试 3 次，并在 `detail_json.mediaCheck` 记录本次是否使用后端代理；后台审核列表、图片预览和资产详情会展示每张图片的审核状态；生产环境如果关闭内容安全或 strict 模式，API 会拒绝启动。

本地开发和测试环境仍默认使用内存仓库。API 保留生产安全闸门：如果生产环境没有显式注入持久化仓库，会拒绝启动，避免误用内存数据承载真实业务。

## 目录

- `shared/`: 共享类型、金额工具、状态模型和事件契约。
- `api/`: Fastify API、WebSocket、MySQL 数据访问和 Cloudflare R2 适配。
- `admin/`: React/Vite 管理后台，用于仪表盘、审核、举报、用户和配置管理。
- `miniapp/`: uni-app 微信小程序端，用于用户登录、浏览、竞价、关注、站内通知、客服入口和个人中心。
- `scripts/`: 本地验证和生产发布辅助脚本。
- `tests/`: API 与端到端 smoke 测试。
- `docs/`: 系统用户手册、发布记录和阶段性实施计划。
- `deploy/`: 生产部署说明。

## 本地开发

先安装依赖：

```bash
cd products/auction-platform
npm install
```

项目默认通过 `.npmrc` 安装 optional 原生依赖，并在 `postinstall` 自动执行 `scripts/ensure-native-deps.mjs`。本地 Mac x64、Mac arm64 或 Linux arm64 服务器共用同一份代码时，如果 Rollup/esbuild 原生包缺失，可直接执行：

```bash
npm run fix:native-deps
npm run check:native-deps
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

API 生产环境通过 `CORS_ALLOWED_ORIGINS` 控制跨域白名单，例如 `https://api.example.com,https://servicewechat.com`；未配置时使用当前线上后台域名和微信服务域名作为默认值。生产图片安全代理依赖 `API_PUBLIC_BASE_URL` 生成微信可访问的短期签名图片下载地址，线上应配置为 `https://api-auction.toolmatrix.top`。

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
| `super_admin` | 仪表盘、审核管理、资产数据、发布资产、成交跟进、后台用户、主理人管理、前台用户、系统配置 | 全量管理；发布资产；复制历史资产为发布草稿；修改未结束资产截止时间；可导出资产数据、审核/批量审核资产、扣减违规资产卖家信誉分、确认/驳回举报、发布违规公示、完成交易、撤销疑似抬价出价并限制出价者、解除出价限制、下架/批量下架已上架资产、成交跟进、管理后台账号、绑定主理人、管理前台用户风控和系统配置 | 全部数据，包含未绑定主理人的历史资产 |
| `reviewer` | 仪表盘、审核管理、资产数据、发布资产、成交跟进 | 发布自己主理人名下资产；复制自己主理人名下历史资产为发布草稿；修改自己主理人名下未结束资产截止时间；查看和导出资产数据；通过/驳回/批量审核待审核资产；扣减自己名下违规资产卖家信誉分；查看、确认、驳回举报并发布违规公示；撤销自己资产范围内疑似抬价出价并限制出价者；解除自己资产范围内出价限制；跟进成交；完成自己名下有出价资产交易 | 仅绑定主理人名下的数据；未绑定可用主理人时资产/举报/成交跟进列表为空，详情和操作返回 404 |
| `operator` | 仪表盘、资产数据、发布资产、成交跟进 | 发布自己主理人名下资产；复制自己主理人名下历史资产为发布草稿；修改自己主理人名下未结束资产截止时间；查看和导出资产数据；跟进成交；完成自己名下有出价资产交易；下架/批量下架已上架资产；当前无审核管理、举报审核、用户管理、主理人管理和系统配置入口 | 仅绑定主理人名下的数据；未绑定可用主理人时资产/成交跟进列表为空，详情和操作返回 404 |

管理后台侧边栏按角色控制页面入口；服务端接口会按 `admin:manage`、`asset:view`、`asset:review`、`asset:remove`、`auction:confirm_deal`、`user:view`、`user:ban`、`report:review`、`violation:publish`、`config:manage` 等权限再次校验。

## 主要接口

小程序端使用的主要接口：

- `POST /api/auth/wechat-login`: 微信登录。
- `GET /api/profile/me`: 当前用户资料，包含 `creditScore`、`creditResetAt`、`buyerUnreachableCount`、`bidRestrictedUntil`、`bidRestrictionPermanent`、`bidRestrictionReason` 和 `bidRestrictionStartedAt`。
- `GET /api/assets`: 进行中的交换列表，支持 `gameName`、`assetType`、`principalId`、`dragonBallProfession`、`dragonBallQuality`、`keyword`、`page`、`pageSize`、`createdWithinDays` 查询参数；未搜索时默认 `createdWithinDays=7`，带关键词搜索时默认 `createdWithinDays=60`；资产会返回 `principal`、`hasPublishedViolation` 和可选 `dragonBall`，携带用户 token 时还会返回 `followedByMe`。
- `GET /api/assets/:assetId`: 交换详情、资产图片、主理人摘要、卖家摘要、最近出价人信息、可选龙珠信息和已公示违规标签；未登录用户可查看已上架且未截止的信息，以及已确认成交的信息；卖家或参与过出价的用户携带 token 时可查看自己相关记录并返回 `followedByMe`。
- `GET /api/asset-publish-context`: 用户提交上下文，返回发布开关、关闭提示、可选主理人、默认最低加价、当日剩余提交次数和图片策略；需要登录且账号可操作。
- `POST /api/images`: 用户提交资产图片上传；发布开关开启、账号未封禁且信誉分可操作时可用，写入 R2 并带当前用户 `openid` 发起微信图片内容安全检测。
- `POST /api/assets`: 用户提交资产；发布开关开启、账号未封禁且信誉分可操作时可用，校验每日发布上限、主理人、字段、文本安全和图片归属/安全记录，创建 `pending_review` 待审资产；小程序端游戏名称来自固定下拉，龙珠作为 `assetType=道具` 下的 `itemCategory=龙珠` 提交。
- `POST /api/assets/:assetId/follow`: 关注已上架且未结束的信息；封禁用户不可关注。
- `POST /api/assets/:assetId/unfollow`: 取消关注信息。
- `GET /api/profile/follows`: 我的关注列表，支持 `page`、`pageSize` 分页。
- `POST /api/bids`: 出价；请求必须携带 `commitmentAccepted=true`；封禁用户、信誉分 70 分及以下用户、临时或永久出价限制用户不可出价；出价限制会返回 `bid_restricted` 和原因、到期时间或永久限制标记。
- `GET /api/profile/assets`: 我的资产列表，只返回当前用户提交过的资产，支持 `page`、`pageSize` 分页，并包含待审核、已上架、已拒绝、已成交、已下架等状态。
- `GET /api/profile/bids`: 我的出价。
- `GET /api/profile/results`: 我的成交记录，仅返回已完成且当前用户为最终最高出价者的资产，支持 `page`、`pageSize` 分页，并返回资产名称摘要。
- `GET /api/profile/deal-followups`: 我的成交跟进，支持 `page`、`pageSize` 分页。
- `POST /api/profile/deal-followups/:followupId/confirm`: 兼容旧客户端的只读保护接口，当前返回 `buyer_followup_readonly`。
- `POST /api/profile/deal-followups/:followupId/abandon`: 兼容旧客户端的只读保护接口，当前返回 `buyer_followup_readonly`。
- `GET /api/profile/notifications`: 我的站内通知，返回通知列表和 `unreadCount` 未读数量；通知存储异常时降级为空列表并写入服务端错误日志。
- `POST /api/profile/notifications/:notificationId/read`: 标记站内通知已读。
- `POST /api/profile/notifications/read-all`: 将当前用户全部未读站内通知标记为已读。
- `POST /api/reports`: 后端保留的举报提交接口；当前小程序不展示入口。请求必须携带 `targetUserId`、`assetId`、`reason`、`evidence`，且当前用户必须参与过该资产出价；封禁用户不可举报。
- `GET /api/violations`: 违规公示列表。
- `WS /ws/auctions?assetId=...`: 交换详情页实时刷新出价和延时事件。
- `GET|POST /api/wechat/events`: 微信消息推送回调，用于 `mediaCheckAsync` 异步图片安全结果。
- `GET /api/wechat/media-check-image/*`: 微信图片安全专用的短期签名下载代理，微信 `mediaCheckAsync` 通过该接口下载原图；前台不要直接调用。

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
- `GET /admin/asset-publish-context`: 后台发布资产上下文，返回当前管理员可用主理人范围和默认截止时间。
- `POST /admin/images`: 后台受控图片上传，支持 JPG、PNG、WebP，单张最多 5MB；按账号/道具写入不同 R2 前缀，不触发微信图片审核。
- `POST /admin/assets`: 后台主理人发布资产，发布后直接上架；字段包含主理人、游戏、卖家游戏ID、区服、账号/道具、龙珠信息、标题、描述、起估价、最低加价、截止时间和图片。
- `GET /admin/assets`: 资产数据列表，支持状态、游戏名称、资产类型、关键词和分页；未传状态时默认返回待审核和已上架资产，并按创建时间倒序排序。
- `GET /admin/assets/:assetId/copy-draft`: 读取历史资产并生成发布页复制草稿；不创建新资产，不复制出价、成交、关注或通知，只带入发布所需基础信息和图片元数据，并遵守登录管理员的数据范围。
- `POST /admin/assets/:assetId/end-time`: 修改草稿、待审核或已上架资产的截止时间；请求体为 `{ "endAt": "ISO 时间" }`，必须是未来时间，同时更新原始截止时间和当前截止时间，并写入后台操作日志。
- `GET /admin/assets/export`: 导出资产数据 Excel，支持与资产数据列表相同的筛选条件和数据权限。
- `GET /admin/assets/review`: 待审核资产分页列表。
- `POST /admin/assets/:assetId/approve`: 审核通过资产。
- `POST /admin/assets/:assetId/reject`: 驳回资产。
- `POST /admin/assets/:assetId/deduct-credit`: 主理人审核自己名下资产时扣减发布者信誉分 5 分，并写入后台操作日志。
- `POST /admin/assets/remove/batch`: 批量下架已上架资产，逐条返回成功和失败明细。
- `POST /admin/assets/:assetId/remove`: 下架已上架资产，前台不可见且不能继续出价。
- `POST /admin/assets/:assetId/confirm-deal`: 完成有出价的已上架资产交易，资产变为已结束并按已成交展示，前台详情会展示“成交”盖章且不能继续出价；若成交跟进单同步失败，资产完成状态不回滚，后台操作日志会记录 `followupSyncError` 便于排查。
- `POST /admin/assets/:assetId/bids/:bidId/revoke-and-restrict`: 撤销资产详情中被点击的单条出价，并限制该出价者 30 分钟、1 天或永久；资产当前价和最高出价者会按剩余有效出价重算。
- `POST /admin/assets/:assetId/bidders/:userId/bid-restriction/release`: 主理人在资产详情中解除该出价者的出价限制，遵守主理人资产范围。
- `GET /admin/deal-followups`: 成交跟进列表，支持状态筛选和分页，并按主理人数据范围隔离。
- `POST /admin/deal-followups/:followupId/status`: 更新成交跟进状态，支持 `principal_contacted`、`buyer_unreachable`、`completed`、`cancelled`；标记 `completed` 与资产数据页“完成交易”语义一致，会把有出价的资产确认为已成交并结束交换；标记买家失联会累计失联次数并触发出价限制。
- `GET /admin/users`: 用户管理分页列表，支持关键词查询，返回封禁状态、每日发布次数、违规次数、信誉分、买家失联次数、临时/永久出价限制状态、限制原因和限制开始时间。
- `POST /admin/users/:userId/ban`: 封禁用户。
- `POST /admin/users/:userId/unban`: 解除封禁。
- `POST /admin/users/:userId/publish-limit`: 设置或清空单个用户每日发布次数。
- `POST /admin/users/:userId/bid-restriction/release`: 超级管理员在前台用户管理页解除用户出价限制。
- `GET /admin/configs`: 平台配置分页列表。
- `POST /admin/configs/:key`: 更新平台配置，例如默认每日发布次数和 `user_asset_publish_enabled` 用户发布开关。
- `GET /admin/reports`: 举报分页列表，返回举报人姓名 `reporterDisplayName` 和举报人 ID。
- `POST /admin/reports/:reportId/confirm`: 确认举报。
- `POST /admin/reports/:reportId/reject`: 驳回举报。
- `POST /admin/reports/:reportId/publish-violation`: 发布违规公示。

## 部署概要

生产部署建议使用腾讯云服务器运行 API 和进程守护，使用服务器上已安装的 MySQL 保存业务数据，使用 Cloudflare R2 保存图片资源，使用 Nginx 托管管理后台静态产物并反向代理 API、WebSocket 与微信内容安全回调。

部署前需要准备 `api/.env.example` 中列出的环境变量、执行数据库迁移、配置 HTTPS 证书，并在微信公众平台配置小程序 request、uploadFile、socket 合法域名。HTTPS 可使用 Let's Encrypt 免费证书，部署文档已记录 `certbot` 申请和自动续期步骤。当前“通知中心与用户资产发布”版本需要发布后端 API 服务、执行 `013_user_asset_publish_switch.sql` 配置迁移、发布管理后台静态资源并重新构建/上传小程序包；不需要调整 Nginx、R2、微信客服、订阅消息或内容安全环境变量。用户图片上传内容安全依赖真实微信登录用户 `openid`，如果发布后仍遇到缺少 openid 的旧登录态，需让用户重新登录后再上传。Mac 本地打包需使用部署文档中的 `COPYFILE_DISABLE=1 tar --no-xattrs --no-fflags` 命令，并排除 `.git`、各 workspace `node_modules` 与构建产物，打包后先校验发布脚本和关键 marker。无数据库变更的常规发布可在服务器上传 `/opt/auction-platform.tar.gz` 后执行 `scripts/prod-release.sh`，脚本会解压到 staging 目录、安装依赖、类型检查、测试、切换运行目录、校验 active 目录内容和 API 进程 cwd、重启 API、健康检查并部署管理后台静态资源；WebSocket 容量评估和 Redis Pub/Sub 多实例升级路径见部署文档“后续扩容计划”；发布记录见 `docs/releases.md`。
