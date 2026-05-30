# 发布记录

本文记录游戏资产交换平台的线上发布、热修复、迁移要求和验证结果。每次发布前后都应同步更新本文件，并和 `deploy/tencent-cloud.md` 中的发布检查互相校对。

## 2026-05-28：主理人数据隔离与分摊审核

### 背景

- 小程序发布资产时需要选择主理人，后续由对应主理人进入后台审核自己名下资产和举报。
- 普通主理人账号不能查看、审核、下架其他主理人名下的数据；超级管理员保留全量查看和管理能力。
- 后台用户列表、系统配置等全局数据不应继续暴露给普通审核员或运营账号。
- 内容安全需要从“代码路径”和“线上冒烟”两层给出可复用验证方法，避免只用本地高危词兜底误判微信 `msgSecCheck` 已生效。

### 代码变更

- 新增 `principals` 主理人表，并在 `auction_assets` 增加 `principal_id` 归属字段。
- 新增 `GET /api/principals`，小程序发布页读取可用主理人列表并提交 `principalId`；服务端强制校验主理人有效，未选择或停用主理人时返回 `invalid_asset_principal`。
- 新增 `GET /admin/principals`、`GET /admin/admin-users` 和 `POST /admin/principals`，仅 `super_admin` 可管理主理人与后台登录用户的绑定关系；主理人管理页改为下拉选择后台登录用户，避免把前台用户 ID 误填为后台用户 ID。
- 新增后台“后台用户”管理页和 `POST/PATCH/DELETE /admin/admin-users`，超级管理员可创建后台账号、重置密码、设置 `super_admin / reviewer / operator` 三种角色、停用账号；删除采用停用账号的软删除方式，避免破坏历史审核日志。
- 后台用户编辑基础信息改走 `POST /admin/admin-users/:adminId/update`，不再要求输入密码，也避开线上 PATCH 预检导致的 `Failed to fetch`；`POST /admin/admin-users/:adminId/reset-password` 改为生成随机临时密码，旧密码立即失效，不再使用固定默认密码。
- 后台账号停用或删除时会同步停用其绑定主理人，防止小程序继续把信息发布到无法登录处理的主理人名下；服务端禁止超级管理员停用或降权当前登录账号，并保证至少保留一个可登录的超级管理员。
- 小程序发布页主理人改为显式必选：加载主理人列表后不再默认选中第一位，提交前会校验所选主理人仍在当前可选列表中。
- 小程序交换列表和交换详情展示主理人名称，详情页提示用户沟通资产信息时优先联系对应主理人。
- 小程序交换详情和“我的发布”统一使用中文审核状态：草稿、审核中、已上架、已结束、已驳回、已取消、已下架。
- 小程序交换详情在提交出价或收到实时出价推送后，会保留详情页已有的主理人和违规公示补充信息，避免竞价响应覆盖资产对象后主理人信息消失。
- 后台封禁前台用户后，服务端会在用户写操作入口统一拦截旧 token：封禁用户不可发布信息、上传资产图片、出价或提交举报；小程序端对发布、出价和举报分别展示明确的账号限制提示。
- 新增前台用户信誉分：用户默认 100 分；主理人可在资产审核队列或资产详情中对自己名下违规资产扣减发布者 5 分；信誉分 70 分及以下时只能浏览，发布信息、上传资产图片、关注/取消关注、出价、举报和标记通知已读等写操作统一返回 `credit_score_too_low`；扣分满 3 个月后在用户读取或写操作校验路径自动恢复为 100 分。
- 小程序个人中心展示当前用户信誉分；后台前台用户列表展示信誉分，70 分及以下时以风险状态标记。
- 小程序成交记录列表新增分页加载，后端 `GET /api/profile/results` 返回 `total/page/pageSize/hasMore` 和资产名称摘要；页面从展示资产 ID 改为展示资产名称，并移除进入成交记录时的免责声明弹窗。
- 修复历史已上架资产在“我的发布”中仍显示 `2099-12-31 23:59` 的问题：后端读取 active 资产时会对旧默认截止时间做兜底换算，并新增迁移回填线上遗留数据为审核时间后 24 小时。
- 举报入口增加自有资产保护：小程序端禁用自己发布信息的举报按钮，服务端 `POST /api/reports` 对资产发布者请求返回 `self_report_not_allowed`，避免构造请求绕过。
- 小程序发布信息或提交举报触发内容安全拦截时，统一提示“内容包含敏感信息，请修改后再提交”，避免继续落到“确认信息和登录状态”的兜底文案。
- 图片内容安全审核语义调整：微信 `mediaCheckAsync` 返回 `review` 时视为“建议人工复核”，不再按图片违规阻断后台审核通过；只有 `risky` 明确高风险图片会被拦截，并返回中文提示。
- 后台资产审核支持图片检测未完成时的人工确认通过：首次点击通过仍提示 `image_safety_pending`，管理员确认已人工查看图片后会以 `imageSafetyOverride=true` 再次提交；该兜底只覆盖已有检测记录的 pending/failed，不能绕过无检测记录或 `risky` 高风险图片。
- 小程序用户登录 token 增加 30 天有效期；生产 API 的 CORS 改为 `CORS_ALLOWED_ORIGINS` 白名单，不再反射任意 Origin。
- 公开资产详情收紧为未登录用户只能访问已上架且未截止的信息；卖家或参与过出价的用户携带 token 时仍可查看自己相关记录。
- 小程序发布资产时会校验图片必须由当前用户通过 `/api/images` 上传并有图片安全记录，防止直接构造未检测图片 URL。
- 竞价截止时间校验增加 MySQL 事务内锁行复核：即使服务层读取资产后、写入出价前刚好超过 `effectiveEndAt`，也会返回 `auction_ended`，不会继续加价。
- 后台资产审核、资产数据、资产详情、批量审核、下架、批量下架、举报审核、举报确认/驳回/公示、仪表盘资产与举报指标均按登录管理员绑定的主理人过滤。
- 资产数据列表新增勾选和批量下架；后端新增 `POST /admin/assets/remove/batch`，逐条返回成功/失败明细，并复用 `asset:remove` 权限与主理人数据隔离。
- 资产数据列表新增 `导出 Excel`，后端新增 `GET /admin/assets/export`，按当前筛选条件导出 `.xls`，并复用 `asset:view` 权限与主理人数据隔离。
- 小程序首页、交换列表和交换详情接入微信分享：支持右上角菜单和页面内分享按钮，列表分享会保留游戏、类型和搜索词，详情分享会携带资产 ID 和首张图片。
- 小程序交换详情会在成功提交估价后调用 `requestSubscribeMessage` 请求“价格变动提醒”授权；小程序构建显式开放 `UNI_APP_` 环境变量前缀，避免 `UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID` 未进入产物导致授权弹窗被跳过。后端在用户被超价并创建站内通知后，使用微信 `subscribeMessage.send` 尝试发送服务通知，发送失败或用户未授权时不影响出价和站内通知。当前微信模板字段使用 `amount3` 设定价格、`amount4` 当前价格、`thing15` 产品名称、`time11` 价格变动时间，其中设定价格为被提醒用户原出价，当前价格为最新出价，金额字段只发送数字。
- 新增 `docs/system-user-manual.md` 系统用户手册，完整梳理小程序端、后台管理端、角色权限、数据隔离、内容安全、信誉分、封禁、审核、下架、导出、关注、通知和常见问题，便于运营培训和交付验收。
- 小程序发布页临时隐藏截止时间字段；后端 `POST /api/assets` 的 `originalEndAt` 改为非必填，数据库 `original_end_at` / `effective_end_at` 字段继续保留，未传时由服务端填入默认长期有效时间 `2099-12-31T15:59:59.000Z`。
- 资产审核通过时，服务端统一把实际交换截止时间 `effectiveEndAt` 更新为审核通过时间后 24 小时，原始 `originalEndAt` 保留用于审计；小程序交换列表、关注列表、我的发布和详情页展示该实际截止时间。
- 小程序资产列表和我的发布价格优先展示加价后的 `currentPriceCents`，没有出价时才展示起始价；后端增加公开列表回归测试，确保出价后 `/api/assets` 返回最新价。
- 新增 `asset_follows` 关注关系表，以及 `POST /api/assets/:assetId/follow`、`POST /api/assets/:assetId/unfollow`、`GET /api/profile/follows`；关注入口只允许关注已上架且未结束的信息，避免通过 ID 枚举关注隐藏数据。
- `GET /api/assets` 和 `GET /api/assets/:assetId` 在携带小程序用户 token 时返回 `followedByMe`，小程序交换列表卡片支持关注/取消关注，并在列表下方新增“我的关注”分页列表。
- 小程序上传资产图片时会把当前分类传给 `POST /api/images`；服务端按分类生成 R2 objectKey 前缀：账号图写入 `uploads/accounts/{userId}/...`，道具/装备图写入 `uploads/items/{userId}/...`，便于 Cloudflare 对不同路径配置不同缓存或有效期。未传分类的旧客户端仍保持 `uploads/{userId}/...` 兼容路径。
- 道具发布新增“龙珠”分类：小程序选择龙珠后展示职业、品质、属性字段；职业下拉按暗系战士、冰系法师、雷系猎人、幻系召唤、魔系术士、木系牧师、光系熊猫、魂系工程映射，品质支持绿、蓝、紫、金、红；后端保存结构化 `dragonBall` 信息并在列表、关注列表和详情页返回展示。
- 后台管理所有列表查询统一支持分页：资产审核、资产数据、举报审核、前台用户、后台用户、主理人和系统配置接口均返回 `items/total/page/pageSize`，前端统一展示上一页/下一页和总数。
- 当前阶段小程序侧暂时下掉举报入口：移除交换详情举报按钮、个人中心举报菜单、举报提交页路由和小程序 `createReport` 客户端封装；后端举报接口与后台举报审核能力保留。
- 后台资产数据列表价格列改为“当前竞拍价”，优先展示 `currentPriceCents`；后台资产详情接口返回最近 20 条竞拍记录，详情页新增“竞拍信息”区块展示当前竞拍价、最高出价用户和出价明细。
- 违规公示改为宝贝级展示：后台发布某个举报为违规公示后，只在该举报关联资产上返回 `hasPublishedViolation=true` 并展示“该宝贝关联违规公示”，不再按卖家把违规标签扩散到同一卖家的其他资产。
- 非 `super_admin` 且未绑定可用主理人的后台账号，资产/举报列表返回空数据，详情和操作按 404 处理，避免通过 ID 枚举探测其他主理人数据。
- 收紧后台权限：`reviewer` 和 `operator` 不再拥有 `user:view`，用户管理、系统配置和主理人管理仅超级管理员可见且服务端强制鉴权。
- 新增 `docs/content-safety-verification.md` 和 `npm run verify:content-safety -- <mode>`，沉淀微信 `msgSecCheck`、`mediaCheckAsync`、`/api/wechat/events`、`content_safety_image_checks` 和后台审核拦截的可验证步骤。

### 后台角色页面权限

| 角色 | 可见页面 | 页面内主要能力 | 数据范围 |
| --- | --- | --- | --- |
| `super_admin` | 仪表盘、审核管理、资产数据、后台用户、主理人管理、前台用户、系统配置 | 全量管理；可导出资产数据、审核/批量审核资产、扣减违规资产卖家信誉分、确认/驳回举报、发布违规公示、下架/批量下架已上架资产、管理后台账号、绑定主理人、管理前台用户风控和系统配置 | 全部数据，包含未绑定主理人的历史资产 |
| `reviewer` | 仪表盘、审核管理、资产数据 | 查看和导出资产数据；通过/驳回/批量审核待审核资产；扣减自己名下违规资产卖家信誉分；查看、确认、驳回举报并发布违规公示 | 仅绑定主理人名下的数据；未绑定可用主理人时资产/举报列表为空，详情和操作返回 404 |
| `operator` | 仪表盘、资产数据 | 查看和导出资产数据；下架/批量下架已上架资产；当前无审核管理、举报审核、用户管理、主理人管理和系统配置入口 | 仅绑定主理人名下的数据；未绑定可用主理人时资产列表为空，详情和操作返回 404 |

页面入口由管理后台侧边栏按角色控制；关键操作仍由服务端权限二次校验。当前 `operator` 保留 `asset:remove` 和 `auction:cancel` 权限，其中下架已在“资产数据”页开放，取消交换能力暂无独立后台页面入口。

### 数据库与部署要求

- 已有正式数据环境先备份数据库，再执行：

```bash
mysql -u auction_user -p auction_platform < api/src/db/migrations/005_principals.sql
mysql -u auction_user -p auction_platform < api/src/db/migrations/006_asset_follows.sql
mysql -u auction_user -p auction_platform < api/src/db/migrations/007_dragon_ball_metadata.sql
mysql -u auction_user -p auction_platform < api/src/db/migrations/008_user_credit_score.sql
mysql -u auction_user -p auction_platform < api/src/db/migrations/009_backfill_active_asset_deadlines.sql
```

- `006_asset_follows.sql` 会创建用户关注资产关系表，不改变现有资产表字段或历史数据。
- `007_dragon_ball_metadata.sql` 会给 `auction_assets` 增加龙珠道具元数据字段：`item_category`、`dragon_ball_profession`、`dragon_ball_quality`、`dragon_ball_attributes`。历史资产保持 `NULL`，普通账号和普通道具不受影响。
- `008_user_credit_score.sql` 会给 `users` 增加 `credit_score` 和 `credit_reset_at` 字段。历史用户默认 100 分，扣分满 3 个月后自动恢复。
- `009_backfill_active_asset_deadlines.sql` 会把已上架且仍停留在默认 `2099-12-31 23:59` 的历史资产截止时间回填为审核时间后 24 小时；若缺少审核时间，则使用最近更新时间兜底。
- 发布后需要重新部署 API、管理后台静态资源和小程序包。
- 若启用微信价格变动服务通知，需要在微信公众平台配置订阅消息模板，并设置 `WECHAT_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID`、小程序构建变量 `UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID`。详细步骤见 `docs/wechat-price-change-subscribe-message.md`。
- 超级管理员登录后台后，在“主理人管理”中选择对应后台登录用户并绑定主理人。停用的主理人不会出现在小程序发布页。
- 历史资产的 `principal_id` 默认为 `NULL`，只有超级管理员可见；如需交给主理人审核，需要按业务归属补齐 `auction_assets.principal_id`。

### 验证结果

本地验证命令：

```bash
npm --prefix products/auction-platform test
npm --prefix products/auction-platform run typecheck
npm --prefix products/auction-platform run build --workspace @auction/admin
npm --prefix products/auction-platform run build:mp-weixin --workspace @auction/miniapp
```

结果：

- 全量测试 31 个测试文件、254 个测试通过。
- 全工作区 TypeScript 类型检查通过。
- 管理后台生产构建通过。
- 小程序微信端构建通过。

### 回滚与风险

- 回滚代码前不要删除 `principals` 表或 `auction_assets.principal_id` 字段；旧代码会忽略该字段，新代码重新发布后仍可继续使用。
- 回滚代码前也不要删除龙珠元数据字段；旧代码会忽略这些可空字段，新代码重新发布后仍可继续展示已发布的龙珠信息。
- 新版本上线后，未绑定主理人的普通后台账号会看到空资产/举报列表；这是安全保护，不是数据丢失。
- 若历史待审核资产没有 `principal_id`，主理人不会看到这些资产，需要超级管理员分配归属或自行审核。

## 2026-05-27：后台批量审核与资产下架

### 背景

- 后台资产审核只能逐条通过或驳回，待审核资产较多时操作效率低。
- 管理员需要对已经审核通过并上架的信息进行下架处理；即使资产已有出价，也应允许运营下架违规信息。
- 后台左侧导航中“资产审核”和“举报审核”分散展示，需要收拢到同一个审核入口下。

### 代码变更

- 新增 `POST /admin/assets/review/batch`，支持批量通过和批量驳回待审核资产，返回成功和失败明细。
- 新增 `POST /admin/assets/:assetId/remove`，允许具备 `asset:remove` 权限的管理员把已上架资产改为 `removed`，并写入 `asset.remove` 后台操作日志。
- 下架后的资产不再出现在前台公开资产列表；竞价接口会按非 active 状态返回 `asset_not_active`，阻止继续出价。
- 管理后台左侧导航新增统一的“审核管理”，内部 tab 切换“资产审核”和“举报审核”。
- “资产审核”页新增选择、全选本页、清空、批量通过、批量驳回。
- “资产数据”页对已上架资产新增“下架”和“批量下架”操作。
- 新增 `GET /admin/assets/:assetId`，供后台从列表页查看任意状态资产详情。
- 仪表盘待审核资产、仪表盘待处理举报、资产审核、举报审核和资产数据列表支持点击资产编号或标题进入资产详情。
- 后台资产详情页展示资产图片、状态、卖家、价格、截止时间、标题和描述；举报记录会带出关联 `assetId` 便于直接跳转。

### 数据库与部署要求

- 本次不需要新增数据库迁移；`auction_assets.status` 已包含 `removed`。
- 发布后需要重新部署 API 和管理后台静态资源。

### 验证结果

本地验证命令：

```bash
npm --prefix products/auction-platform test -- --run tests/api/admin.test.ts tests/api/assets.test.ts tests/api/reports.test.ts tests/api/bids.test.ts
npm --prefix products/auction-platform run typecheck --workspace @auction/api
npm --prefix products/auction-platform run typecheck --workspace @auction/admin
npm --prefix products/auction-platform run build --workspace @auction/admin
```

结果：

- `tests/api/admin.test.ts`、`tests/api/assets.test.ts`、`tests/api/reports.test.ts`、`tests/api/bids.test.ts` 共 83 个测试通过。
- `@auction/api` 和 `@auction/admin` TypeScript 类型检查通过。
- 管理后台生产构建通过。

### 回滚与风险

- 批量审核逐条处理；部分资产状态不符合条件时不会影响其他资产成功处理，前端会保留失败项提示运营继续处理。
- 资产下架是状态变更，不删除资产、出价或用户数据；如需恢复，需要后续另行提供恢复上架能力或人工修正状态。
- 下架已有出价资产会阻止继续出价，但不会自动生成成交或退款流程；运营需要按业务规则线下跟进已参与用户。

## 2026-05-27：站内通知接口热修复与内容安全强制开启

### 背景

- 小程序访问 `GET /api/profile/notifications` 时出现 500。无 token 访问线上接口返回 401，说明域名、Nginx/Cloudflare 和 API 路由可达；带用户 token 后进入通知读取逻辑才触发服务端错误。
- 本地代码路径显示该接口只读取 `station_notifications` 表并计算 `unreadCount`。线上 500 的高概率根因是升级环境没有执行站内通知迁移，或 `station_notifications` 表结构不完整。
- 同日复核微信内容安全接入：资产发布和举报文本走 `msgSecCheck`，图片上传走 `mediaCheckAsync`，图片异步结果通过 `/api/wechat/events` 写入 `content_safety_image_checks`。线上曾出现敏感文本资产发布成功的情况，当前判断优先排查线上环境变量关闭内容安全或部署版本未更新。

### 代码变更

- `GET /api/profile/notifications` 在通知存储异常时降级返回 `{ "items": [], "unreadCount": 0 }`，避免小程序个人中心被 500 中断。
- 服务端会记录 `failed to list profile notifications` 错误日志，保留排查数据库迁移或表结构问题的线索。
- 新增回归测试覆盖通知存储不可用时的空列表降级。
- 生产环境不再允许 `CONTENT_SAFETY_ENABLED=false` 或 `CONTENT_SAFETY_STRICT=false`。如果这两个变量被设置为 `false`，API 启动会失败，避免发布接口绕过 `msgSecCheck`。
- 文本安全增加本地高危词兜底；资产发布内容命中 `赌博`、`卖淫`、`偷盗` 等明确违规词时，服务端会在调用微信 `msgSecCheck` 前直接返回 `content_safety_risky`，避免微信模型返回 `pass` 时放行。

### 数据库与部署要求

- 首次部署执行 `api/src/db/migrations/001_initial_schema.sql` 时会创建 `station_notifications` 表。
- 已有正式数据的升级环境必须确认执行过：

```bash
mysql -u auction_user -p auction_platform < api/src/db/migrations/002_station_notifications.sql
mysql -u auction_user -p auction_platform < api/src/db/migrations/003_daily_publish_limit.sql
mysql -u auction_user -p auction_platform < api/src/db/migrations/004_content_safety.sql
```

- 生产环境变量必须包含：

```env
CONTENT_SAFETY_ENABLED=true
CONTENT_SAFETY_STRICT=true
WECHAT_APPID=你的小程序AppID
WECHAT_APP_SECRET=你的小程序AppSecret
WECHAT_EVENT_TOKEN=你在微信公众平台消息推送中填写的Token
```

- 发布后检查：

```bash
mysql -u auction_user -p auction_platform -e "SHOW TABLES LIKE 'station_notifications';"
mysql -u auction_user -p auction_platform -e "DESCRIBE station_notifications;"
mysql -u auction_user -p auction_platform -e "SELECT id,user_id,type,asset_id,bid_id,read_at,created_at FROM station_notifications ORDER BY created_at DESC LIMIT 10;"
journalctl -u auction-api -n 100 --no-pager
```

### 验证结果

本地验证命令：

```bash
npm --prefix products/auction-platform test -- --run tests/api/profile.test.ts tests/api/bids.test.ts tests/api/mysql-repositories.test.ts
npm --prefix products/auction-platform test -- --run tests/api/app.test.ts tests/api/content-safety.test.ts tests/api/assets.test.ts
npm --prefix products/auction-platform run typecheck --workspace @auction/api
```

结果：

- `tests/api/profile.test.ts`、`tests/api/bids.test.ts`、`tests/api/mysql-repositories.test.ts` 共 36 个测试通过。
- `tests/api/app.test.ts`、`tests/api/content-safety.test.ts`、`tests/api/assets.test.ts` 共 52 个测试通过。
- `@auction/api` TypeScript 类型检查通过。

### 回滚与风险

- 本次热修复只影响通知列表读取失败时的响应形态，不改变出价、通知创建、标记已读或发布资产的业务数据写入。
- 生产环境内容安全改为 fail-closed；如果线上仍配置 `CONTENT_SAFETY_ENABLED=false` 或 `CONTENT_SAFETY_STRICT=false`，发布后 API 会拒绝启动，需要先修正环境变量再重启。
- 本地高危词兜底用于拦截明确违规词，不替代微信 `msgSecCheck`；仍需保持微信内容安全环境变量、AppID/Secret 和 openid 链路可用。
- 如果需要回滚代码，仍应先补齐 `station_notifications` 表；否则旧版本会继续在通知列表读取时返回 500。
- 降级返回空列表只是前端可用性保护，不等于通知功能正常。日志中若出现 `failed to list profile notifications`，应按数据库检查命令修复根因。
