# 游戏资产交换平台

这是一个面向微信小程序的游戏资产信息发布与竞价平台。平台提供资产展示、审核、竞价、成交记录、举报处理和违规公示能力，用于帮助运营方管理合规的资产竞价流程。

平台明确不提供支付、担保、交付、评论或外部联系方式交换；当前仅支持围绕具体资产或交换资源的站内文本会话，用户可在符合条件时联系资产主理人，也可在自由交换详情中联系发布者。已登录用户仍可通过微信官方客服入口咨询平台规则，成交后的资金与交付安排不在本系统内完成。

## 当前能力

当前代码已经具备生产运行的核心闭环：`NODE_ENV=production` 下自动接入 MySQL-backed repositories，用户、资产、图片、竞价、自由交换资源、主播推荐、龙珠价格参考、成交跟进、站内通知、举报、违规公示、管理员账号、系统配置、图片内容安全结果和后台操作日志会写入 MySQL。图片上传写入 Cloudflare R2，资产记录保存图片 URL。

小程序端已支持登录、资源首页进入“塔防精灵”和“主播推荐”、选择游戏后进入“委托主理人 / 自由交换 / 定价参考”模式选择、按“账号 / 道具”拆分浏览委托主理人资产、自由交换龙珠资源列表、主播推荐列表、龙珠定价参考页、列表默认展示最近 7 天发布的数据、关键词搜索默认查询最近 60 天数据、道具列表按主理人/龙珠职业/龙珠品质筛选、自由交换按龙珠职业/品质筛选并按发布时间倒序展示且展示单图和参考金额、下拉刷新与触底分页、详情图片预览、在线出价、出价人展示、个人中心展示“我的交换”和微信官方客服入口、顶部“通知中心”未读红点、被超价站内通知、未读价格变动提醒、资产详情联系主理人、交换详情联系发布者、游戏模式页/自由交换列表/估值参考页/交换详情右上角微信分享、交换详情页面内分享资源、通知中心消息分区。浏览首页、列表和详情不强制登录；用户提交估价、联系主理人、联系发布者或切换到“我的”时才进入登录页，登录页提供“暂不登录，返回浏览”，登录成功后回到触发登录前的页面；发布页出现“请先登录”时会在文案后提供“去登录”按钮。提交估价前必须确认出价承诺，成交后由主理人在后台根据线下跟进结果确认完成或取消；小程序成交记录页面和接口保留兼容，但个人中心暂不展示“我的出价”“我的资产”和“成交记录”入口。当前阶段不采集手机号，不支持语音、附件或外部联系方式交换；资产会话仅支持文本消息，通过出价承诺、自由交换免责声明、成交跟进、后台备注、资产会话和失联限制形成运营闭环。

小程序底部已新增“攻略”Tab，页面顶部可按配置展示“活动入口”；后台配置了活动材料或活动攻略图片链接时，对应入口才会显示。攻略页还分为“基础功能”、“副本计算”和“其它 / 实用入口”，基础功能包含卡牌升级和赛季挑战；副本计算包含深海之战、大漩涡和天空塔；其它入口包含血量计算、附加计算、签到、龙珠体系和兑换码。卡牌升级、赛季挑战、深海之战、大漩涡、血量计算和附加计算均为本地计算工具；赛季挑战会在小程序本地保存当前进度；天空塔优先读取后台“天空塔设置”的楼层阵容资料；活动材料和活动攻略读取系统配置中的图片链接，活动攻略支持多个图片链接；兑换码读取后台“兑换码设置”；签到入口读取系统配置 `check_in_url`，点击后复制链接并提示用户在微信内打开。攻略首页及新增攻略页面都支持微信分享。

配置微信订阅消息模板后，用户提交估价时会在确认免责声明后、发起估价请求前请求“价格变动提醒”授权，后续被其他用户超价时会尝试发送微信服务通知，并继续保留站内通知兜底。自由交换联系发布者、发布交换资源成功和聊天发送消息时会请求“留言回复通知”订阅授权；用户拒绝授权不影响站内聊天，后端发送微信订阅提醒失败也不会影响消息发送。通知中心支持单条已读、全部已读，以及在“通知 / 消息”两个分区内进入管理模式后多选、全选和删除；未选中的“通知 / 消息”页签使用深色实底和金色描边，当前分区使用金色高亮；通知中心展示消息留存免责声明，提醒站内通知和消息仅保留 3 个月，历史消息会按规则定期删除且清理后无法恢复；聊天页通过 `/ws/messages` 接收实时消息，socket 打开、页面重新显示、连接报错或页面停留期间都会补拉当前会话消息，避免自由交换双方需要退出聊天页才能看到新消息；删除通知会移除当前用户自己的站内通知，删除消息会从当前用户会话列表隐藏该会话，不影响对方或主理人后台历史记录，对方后续回复时会话会重新出现在列表中。当前小程序端暂不展示关注、举报、我的出价、我的资产和成交记录入口，后端关注、举报、我的出价、我的资产和成交记录接口保留，用于兼容旧客户端或后续恢复。后台确认举报并发布违规公示后，仅关联的具体资产列表和详情会展示“该宝贝关联违规公示”标签，不会扩散到同卖家的其他资产；待审核或未公示的举报不会在小程序公开展示。出价节点会弹出统一免责声明：“本平台仅提供信息交换，不涉及任何线上资金交易，请务必走游戏内安全交易渠道，线下转账风险自担”。自由交换联系发布者前会提示“交易需谨慎”，声明平台仅提供信息展示与站内沟通，不参与、不担保、不托管线下交易或资产交割，私下交易损失由交易双方自行承担；发布自由交换前必须勾选免责声明，明确平台不参与交易、不收款、不担保、不托管、不负责线下交付，私下交易风险由双方自行承担；发布者打开自己发布的自由交换详情时，联系按钮会显示“这是你发布的资源”并禁用，服务端也会拒绝自联系。“我的交换”展示当前用户发布过的自由交换资源，支持分页查看图片审核中、展示中、已关闭、已下架和已过期状态，并可关闭展示中的交换资源；自由交换公开列表和“我的交换”页的“发布交换”按钮都会读取 `free_exchange_publish_enabled`，关闭时隐藏按钮且不展示关闭提示。用户提交能力由后台平台配置 `user_asset_publish_enabled` 控制，默认开启，关闭时“提交资产”按钮不展示，服务端仍会强制拒绝提交和图片上传。自由交换发布能力由 `free_exchange_publish_enabled` 控制，默认开启，关闭时拒绝自由交换提交和交换图片上传，并同步隐藏小程序“发布交换”入口和发布页内容。用户提交资产页的游戏名称为固定下拉选项，当前只允许“塔防精灵”；选择“道具”后可选择“普通道具”或“龙珠”，龙珠需要填写职业、品质和属性；提交前会按具体缺失项提示，例如只缺描述时提示“请填写描述”。自由交换发布页当前只允许龙珠，游戏默认选中第一个可用游戏；标题、职业、品质、属性、想换什么和 1 张龙珠图片必填，补充说明和参考金额选填，区服不再前端展示或采集，不需要主理人。用户提交资产后状态为 `pending_review`，必须由主理人后台审核通过后才会上架；自由交换资源文本安全通过且图片安全记录通过后公开展示，图片未通过前状态为 `pending_image_review`，创建 30 天后软过期为 `expired` 并从公开列表和详情隐藏，用户“我的交换”和后台仍可查看；021 迁移前已经存在的历史无图自由交换资源，只要仍为展示中且未过期，会继续出现在公开列表、详情和“我的交换”，小程序显示“暂无图片”占位。后台“发布资产”页仍支持主理人受控发布并选择截止时间，发布后直接上架。资产列表价格优先展示加价后的 `currentPriceCents`，暂无出价时展示起始价；前台、后台、Excel 导出和微信订阅消息中的金额统一按整数元宝展示，不显示小数。

龙珠价格参考按周维护，维度为职业和品质，只记录最低价、最高价且不支持小数。后台“估值参考”页可新增、编辑和删除周批次，也可从周批次列表复制某一周价格到当前周草稿；批量解析支持粘贴 `职业,品质,低价` 三列数据或 `金色牧师 300` 这类紧凑文本，解析后填入对应最低价，最高价仍由管理员确认后填写。保存时覆盖同周同职业/品质的数据。小程序“定价参考”页展示最新周价格表和最近周趋势，自由交换发布页会根据所选职业/品质展示参考区间，并提示“合理填写参考金额，能更快找到新主人”。当前迁移已把图片中的 `6月1日-6日龙珠品类成交价区间统计` 初始化为 `塔防精灵` 价格参考，职业口径与用户发布和自由交换保持一致。

管理后台“主理人资源”列表默认展示待审核和已上架资产，并按创建时间倒序排列；选择具体状态后可查看历史已结束、已取消、已下架等数据。主理人资源列表支持把历史资产复制为发布草稿，停留在发布编辑页供主理人调整后再发布；资产详情支持修改草稿、待审核和已上架资产的截止时间，已结束、已成交、下架、驳回或取消的资产不可修改。后台侧边栏整合为“用户管理 / 资产管理 / 配置管理 / 消息中心”，其中用户管理包含前台用户、后台用户和主理人管理，资产管理包含审核管理、发布资产、交换资源、主播推荐和主理人资源，配置管理包含估值参考、兑换码设置、天空塔设置和系统配置；成交跟进入口先在侧边栏隐藏，相关接口和页面能力保留。后台新增“交换资源”页，可分页查看用户发布的自由交换资源，支持关键词、状态、龙珠职业和品质筛选，列表展示图片、发布者、龙珠信息、参考金额、想换什么、状态、发布时间和过期时间。后台“主播推荐”页维护小程序资源首页公开展示的主播名称、简介和图片链接地址。后台“兑换码设置”使用批量文本维护公开兑换码，后台“天空塔设置”使用批量文本维护楼层阵容、左右战车、英雄位和战术备注。后台“消息中心”展示资产会话列表和文本聊天面板，每条聊天消息展示发送时间，用户发送新消息后后台通过 `/ws/messages` 实时更新，绑定主理人的后台账号只看自己名下会话，超级管理员可查看全部并按主理人筛选。买家第 2 次失联会限制出价 7 天，第 3 次及以后限制出价 30 天，前台用户页会展示失联次数和出价限制截止时间。主理人资源页“完成交易”和成交跟进标记 `completed` 是同一个业务动作，任一入口完成后资产都会变为已结束，成交跟进单变为已成交，小程序详情和我的出价页面会显示“成交”盖章，买家无法继续出价。后台资产详情可对疑似抬价的单条出价执行“撤销并限制”，限制时长支持 30 分钟、1 天或永久，解除入口在资产详情和前台用户管理页。用户信誉分默认 100 分，主理人发现资产违规可每次扣减发布者 5 分，信誉分 70 分及以下只能浏览，不能提交资产、上传资产图片、发布自由交换、出价、举报或标记通知已读，扣分满 3 个月后自动恢复为 100 分；后端保留的旧关注接口同样会受封禁和信誉分限制。被后台封禁的用户即使仍持有旧登录 token，也会被服务端禁止提交资产、上传资产图片、发布自由交换、出价、标记通知已读、旧关注接口操作和提交举报。举报也受后端限制：必须关联具体资产，且只有参与该资产出价的用户可以提交；管理后台举报列表会展示举报人姓名和用户 ID，便于运营核对。生产环境强制接入微信官方内容安全：用户提交资产文本、自由交换文本、资产会话文本和举报文本会走 `msgSecCheck` 或本地内容安全校验，用户上传资产图片和自由交换龙珠图片会走 `mediaCheckAsync`；图片审核提交给微信时使用 API 后端短期签名代理 URL，由 API 从 R2 读取原图返回给微信，数据库和前台仍保留 Cloudflare 图片展示 URL；微信回调返回 `errcode=-1008` 媒体下载失败时，API 默认在回调处理中同步重新提交检测，最多重试 3 次，并在 `detail_json.mediaCheck` 记录本次是否使用后端代理；后台审核列表、图片预览、资产详情和交换资源列表会展示对应图片状态或图片本身；生产环境如果关闭内容安全或 strict 模式，API 会拒绝启动。

本地开发和测试环境仍默认使用内存仓库。API 保留生产安全闸门：如果生产环境没有显式注入持久化仓库，会拒绝启动，避免误用内存数据承载真实业务。

## 目录

- `shared/`: 共享类型、金额工具、状态模型和事件契约。
- `api/`: Fastify API、WebSocket、MySQL 数据访问和 Cloudflare R2 适配。
- `admin/`: React/Vite 管理后台，用于仪表盘、审核、举报、用户和配置管理。
- `miniapp/`: uni-app 微信小程序端，用于用户登录、浏览、竞价、自由交换、站内通知、客服入口和个人中心。
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

微信开发者工具请导入 `miniapp` 源码目录，也就是 `/Users/shiran/work/harness/products/auction-platform/miniapp`；根目录 `project.config.json` 使用空 `miniprogramRoot`，让开发者工具先读取源码根目录下稳定存在的 `app.json`。根目录 `app.json` 会包装 `devtools/mp-weixin/` 里的页面，根目录 `app.js` 会给编译产物中的 `/pages/...` 跳转补上包装前缀并加载 `devtools/mp-weixin/app.js`。日常调试运行并保持 `npm run dev:miniapp`，上传体验版或正式版前执行 `npm run build:mp-weixin --workspace @auction/miniapp`；两种命令都会把最新成功产物同步到 `devtools/mp-weixin/`，清空产物目录内的 `project.config.json` 的 `miniprogramRoot`，并刷新根目录包装入口。若仍提示 `devtools/mp-weixin/app.json`、`dist/dev/mp-weixin/app.json`、`dist/build/mp-weixin/app.json`、`dist/mp-weixin/app.json` 或 `.devtools/mp-weixin/app.json` 不存在，说明微信开发者工具读到了旧项目缓存或旧配置；删除旧项目记录，确认 `miniapp/project.config.json` 里 `"miniprogramRoot": ""` 后重新导入 `miniapp` 源码目录。

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
| `super_admin` | 仪表盘、用户管理（前台用户、后台用户、主理人管理）、资产管理（审核管理、发布资产、交换资源、主播推荐、主理人资源）、配置管理（估值参考、兑换码设置、天空塔设置、系统配置）、消息中心 | 全量管理；发布资产；复制历史资产为发布草稿；修改未结束资产截止时间；可查看自由交换资源；维护主播推荐、龙珠周估值参考、兑换码和天空塔资料；可导出主理人资源、审核/批量审核资产、扣减违规资产卖家信誉分、确认/驳回举报、发布违规公示、完成交易、撤销疑似抬价出价并限制出价者、解除出价限制、下架/批量下架已上架资产、查看和回复全部资产会话、管理后台账号、绑定主理人、管理前台用户风控和系统配置 | 全部数据，包含未绑定主理人的历史资产、全部自由交换资源、主播推荐和全局攻略配置 |
| `reviewer` | 仪表盘、资产管理（审核管理、发布资产、交换资源、主播推荐、主理人资源）、配置管理（估值参考、兑换码设置、天空塔设置）、消息中心 | 发布自己主理人名下资产；复制自己主理人名下历史资产为发布草稿；修改自己主理人名下未结束资产截止时间；查看自由交换资源；维护主播推荐、龙珠周估值参考、兑换码和天空塔资料；查看和导出主理人资源；通过/驳回/批量审核待审核资产；下架/批量下架自己主理人名下已上架资产；扣减自己名下违规资产卖家信誉分；查看、确认、驳回举报并发布违规公示；撤销自己资产范围内疑似抬价出价并限制出价者；解除自己资产范围内出价限制；完成自己名下有出价资产交易；回复自己主理人名下资产会话 | 主理人资产、举报和消息仅限绑定范围；交换资源为只读全量列表；主播推荐、估值参考、兑换码和天空塔资料为全局配置；未绑定可用主理人时资产/举报/消息列表为空，详情和操作返回 404 |
| `operator` | 仪表盘、资产管理（发布资产、交换资源、主播推荐、主理人资源）、配置管理（估值参考、兑换码设置、天空塔设置）、消息中心 | 发布自己主理人名下资产；复制自己主理人名下历史资产为发布草稿；修改自己主理人名下未结束资产截止时间；查看自由交换资源；维护主播推荐、龙珠周估值参考、兑换码和天空塔资料；查看和导出主理人资源；完成自己名下有出价资产交易；下架/批量下架已上架资产；回复自己主理人名下资产会话；当前无审核管理、举报审核、用户管理、主理人管理和系统配置入口 | 主理人资产和消息仅限绑定范围；交换资源为只读全量列表；主播推荐、估值参考、兑换码和天空塔资料为全局配置；未绑定可用主理人时资产/消息列表为空，详情和操作返回 404 |

管理后台侧边栏按角色控制页面入口；服务端接口会按 `admin:manage`、`asset:view`、`asset:review`、`asset:remove`、`auction:confirm_deal`、`user:view`、`user:ban`、`report:review`、`violation:publish`、`config:manage` 等权限再次校验。

## 主要接口

小程序端使用的主要接口：

- `POST /api/auth/wechat-login`: 微信登录。
- `GET /api/profile/me`: 当前用户资料，包含 `creditScore`、`creditResetAt`、`buyerUnreachableCount`、`bidRestrictedUntil`、`bidRestrictionPermanent`、`bidRestrictionReason` 和 `bidRestrictionStartedAt`。
- `GET /api/assets`: 进行中的交换列表，支持 `gameName`、`assetType`、`principalId`、`dragonBallProfession`、`dragonBallQuality`、`keyword`、`page`、`pageSize`、`createdWithinDays` 查询参数；未搜索时默认 `createdWithinDays=7`，带关键词搜索时默认 `createdWithinDays=60`；资产会返回 `principal`、`hasPublishedViolation` 和可选 `dragonBall`，携带用户 token 时还会返回 `followedByMe`。
- `GET /api/assets/:assetId`: 交换详情、资产图片、主理人摘要、卖家摘要、最近出价人信息、可选龙珠信息和已公示违规标签；未登录用户可查看已上架且未截止的信息，以及已确认成交的信息；卖家或参与过出价的用户携带 token 时可查看自己相关记录并返回 `followedByMe`。
- `GET /api/asset-publish-context`: 用户提交上下文，返回发布开关、关闭提示、可选主理人、默认最低加价、当日剩余提交次数和图片策略；需要登录且账号可操作。
- `POST /api/images`: 用户提交资产图片或自由交换龙珠图片上传；对应发布开关开启、账号未封禁且信誉分可操作时可用，写入 R2 并带当前用户 `openid` 发起微信图片内容安全检测。自由交换图片上传会传 `usage=exchange_resource`，受 `free_exchange_publish_enabled` 单独控制。
- `POST /api/assets`: 用户提交资产；发布开关开启、账号未封禁且信誉分可操作时可用，校验每日发布上限、主理人、字段、文本安全和图片归属/安全记录，创建 `pending_review` 待审资产；小程序端游戏名称来自固定下拉，龙珠作为 `assetType=道具` 下的 `itemCategory=龙珠` 提交。
- `GET /api/exchange-resources/context`: 自由交换发布上下文，返回 `free_exchange_publish_enabled` 开关、关闭提示、当前游戏和支持分类；公开可读，用于未登录浏览场景也能隐藏关闭态发布入口。
- `GET /api/exchange-resources`: 自由交换资源公开列表，支持 `gameName`、`dragonBallProfession`、`dragonBallQuality`、`keyword`、`page`、`pageSize`，按发布时间倒序返回；只返回 `active` 且未过期的资源。新发布资源必须有图片并通过图片安全记录，021 迁移前历史无图资源兼容展示。
- `GET /api/exchange-resources/:resourceId`: 自由交换资源详情，仅公开展示 `active` 且未过期资源，包含龙珠图片、参考金额和发布者信息。
- `POST /api/exchange-resources`: 用户发布自由交换资源；当前仅支持龙珠字段，必须提交 1 张图片，参考金额和补充说明选填，区服不再前端采集，不需要主理人、起拍价或最低加价；文本和图片安全通过后公开展示，图片审核中状态为 `pending_image_review`。
- `GET /api/anchor-recommendations`: 小程序资源首页“主播推荐”入口使用，公开返回后台维护的主播名称、简介和图片链接地址。
- `GET /api/dragon-ball-price-references/latest`: 小程序定价参考入口使用，按 `gameName` 返回最新一周龙珠职业/品质最低价和最高价；无数据时返回 `batch=null`。
- `GET /api/dragon-ball-price-references/trend`: 小程序定价参考趋势使用，按 `gameName`、`profession`、`quality` 返回最近周价格区间，价格只支持整数元宝展示。
- `GET /api/app-config`: 小程序公开读取应用配置，当前返回签到入口 `checkInUrl`、活动材料图 `dungeonMaterialImageUrl`、活动攻略首图 `dungeonGuideImageUrl` 和活动攻略图片列表 `dungeonGuideImageUrls`；后台系统配置对应值为 `-` 或空时返回空字符串或空数组。
- `GET /api/redeem-codes`: 小程序攻略兑换码页公开读取后台解析后的兑换码列表。
- `GET /api/sky-tower`: 小程序攻略天空塔页公开读取 1-40 层楼层资料和天空币奖励表。
- `GET /api/profile/exchange-resources`: 我的自由交换资源列表，支持分页并包含图片审核中、已关闭、已下架和已过期资源，按发布时间倒序返回；小程序个人中心“我的交换”入口使用该接口。
- `POST /api/profile/exchange-resources/:resourceId/close`: 发布者关闭自己的自由交换资源。
- `POST /api/exchange-resources/:resourceId/conversations/seller`: 发起或复用与交换资源发布者的 `seller_contact` 会话；登录且非发布者本人可用。
- `POST /api/assets/:assetId/conversations/principal`: 发起或复用资产主理人会话；当前仅资产卖家或参与过该资产出价的用户可用，资产必须绑定主理人。
- `GET /api/profile/asset-conversations`: 我的资产会话列表，支持分页并返回未读消息数。
- `GET /api/profile/asset-conversations/:conversationId/messages`: 我的资产会话消息列表，支持分页，读取后会更新用户侧已读时间。
- `POST /api/profile/asset-conversations/:conversationId/messages`: 用户发送资产会话文本消息，当前仅支持 1 到 500 字文本并走内容安全校验。
- `POST /api/profile/asset-conversations/delete`: 当前用户批量隐藏自己的会话列表项；不会删除对方或后台可见的历史消息。
- `POST /api/assets/:assetId/follow`: 关注已上架且未结束的信息；当前小程序前端暂不展示关注入口，接口保留兼容旧客户端。
- `POST /api/assets/:assetId/unfollow`: 取消关注信息；当前小程序前端暂不展示取消关注入口，接口保留兼容旧客户端。
- `GET /api/profile/follows`: 我的关注列表，支持 `page`、`pageSize` 分页；当前小程序前端不再暴露该列表。
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
- `POST /api/profile/notifications/delete`: 当前用户批量删除自己的站内通知。
- `POST /api/reports`: 后端保留的举报提交接口；当前小程序不展示入口。请求必须携带 `targetUserId`、`assetId`、`reason`、`evidence`，且当前用户必须参与过该资产出价；封禁用户不可举报。
- `GET /api/violations`: 违规公示列表。
- `WS /ws/auctions?assetId=...`: 交换详情页实时刷新出价和延时事件。
- `WS /ws/messages?token=...`: 资产会话实时消息连接；用户订阅自己的主理人会话和自由交换发布者会话，绑定主理人的后台账号只订阅自己主理人的 `principal_contact` 会话，超级管理员只接收主理人会话。
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
- `GET /admin/assets`: 主理人资源列表，支持状态、游戏名称、资产类型、关键词和分页；未传状态时默认返回待审核和已上架资产，并按创建时间倒序排序。
- `GET /admin/exchange-resources`: 后台自由交换资源列表，支持 `status`、`gameName`、`dragonBallProfession`、`dragonBallQuality`、`keyword`、`page`、`pageSize`，返回展示中、已关闭和已下架资源，按发布时间倒序排序。
- `GET /admin/anchor-recommendations`: 后台“主播推荐”读取主播推荐列表。
- `POST /admin/anchor-recommendations`: 新增主播推荐，字段为主播名称、简介和图片链接地址。
- `PUT /admin/anchor-recommendations/:id`: 编辑主播推荐。
- `DELETE /admin/anchor-recommendations/:id`: 删除主播推荐。
- `GET /admin/dragon-ball-price-reference-batches`: 后台“估值参考”周批次列表，支持分页。
- `POST /admin/dragon-ball-price-reference-batches`: 新增或覆盖同游戏同周的龙珠估值参考批次，明细行只包含职业、品质、最低价和最高价。
- `GET /admin/dragon-ball-price-reference-batches/:batchId`: 查看单个估值参考批次。
- `PUT /admin/dragon-ball-price-reference-batches/:batchId`: 编辑单个估值参考批次，价格必须为正整数元宝且最低价不能大于最高价。
- `DELETE /admin/dragon-ball-price-reference-batches/:batchId`: 删除单个估值参考批次及其明细行。
- `GET /admin/redeem-codes/config`: 后台读取兑换码批量文本和解析预览。
- `PUT /admin/redeem-codes/config`: 后台保存兑换码批量文本，格式为 `兑换码|奖励说明|效期`，保存前校验字段、空值和重复码。
- `GET /admin/sky-tower/config`: 后台读取天空塔批量文本、解析预览和楼层奖励表。
- `PUT /admin/sky-tower/config`: 后台保存天空塔批量文本，格式为 `楼层|阵容说明|左侧战车|右侧战车|英雄位|战术备注`，保存前校验楼层范围、重复楼层和英雄位品质。
- `GET /admin/assets/:assetId/copy-draft`: 读取历史资产并生成发布页复制草稿；不创建新资产，不复制出价、成交、关注或通知，只带入发布所需基础信息和图片元数据，并遵守登录管理员的数据范围。
- `POST /admin/assets/:assetId/end-time`: 修改草稿、待审核或已上架资产的截止时间；请求体为 `{ "endAt": "ISO 时间" }`，必须是未来时间，同时更新原始截止时间和当前截止时间，并写入后台操作日志。
- `GET /admin/assets/export`: 导出主理人资源 Excel，支持与主理人资源列表相同的筛选条件和数据权限。
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
- `POST /admin/deal-followups/:followupId/status`: 更新成交跟进状态，支持 `principal_contacted`、`buyer_unreachable`、`completed`、`cancelled`；标记 `completed` 与主理人资源页“完成交易”语义一致，会把有出价的资产确认为已成交并结束交换；标记买家失联会累计失联次数并触发出价限制。
- `GET /admin/asset-conversations`: 后台资产会话列表，支持 `page`、`pageSize`、`principalId`、`type`；普通绑定主理人的后台账号只返回自己主理人名下会话，超级管理员可查看全部并筛选主理人。
- `GET /admin/asset-conversations/:conversationId/messages`: 后台读取会话历史消息，读取后会更新后台侧已读时间。
- `POST /admin/asset-conversations/:conversationId/messages`: 后台发送资产会话文本消息，当前仅支持文本。
- `GET /admin/users`: 用户管理分页列表，支持关键词查询，返回封禁状态、每日发布次数、违规次数、信誉分、买家失联次数、临时/永久出价限制状态、限制原因和限制开始时间。
- `POST /admin/users/:userId/ban`: 封禁用户。
- `POST /admin/users/:userId/unban`: 解除封禁。
- `POST /admin/users/:userId/publish-limit`: 设置或清空单个用户每日发布次数。
- `POST /admin/users/:userId/bid-restriction/release`: 超级管理员在前台用户管理页解除用户出价限制。
- `GET /admin/configs`: 平台配置分页列表。
- `POST /admin/configs/:key`: 更新平台配置，例如默认每日发布次数、`user_asset_publish_enabled` 用户提交资产开关、`free_exchange_publish_enabled` 自由交换发布开关和 `check_in_url` 签到链接。
- `GET /admin/reports`: 举报分页列表，返回举报人姓名 `reporterDisplayName` 和举报人 ID。
- `POST /admin/reports/:reportId/confirm`: 确认举报。
- `POST /admin/reports/:reportId/reject`: 驳回举报。
- `POST /admin/reports/:reportId/publish-violation`: 发布违规公示。

## 部署概要

生产部署建议使用腾讯云服务器运行 API 和进程守护，使用服务器上已安装的 MySQL 保存业务数据，使用 Cloudflare R2 保存图片资源，使用 Nginx 托管管理后台静态产物并反向代理 API、WebSocket 与微信内容安全回调。

部署前需要准备 `api/.env.example` 中列出的环境变量、执行数据库迁移、配置 HTTPS 证书，并在微信公众平台配置小程序 request、uploadFile、socket 合法域名。HTTPS 可使用 Let's Encrypt 免费证书，部署文档已记录 `certbot` 申请和自动续期步骤。当前“主播推荐入口与后台维护”版本需要发布后端 API 服务、发布管理后台静态资源、重新构建/上传小程序包，并在服务器执行 `029_anchor_recommendations.sql` 建表迁移：

```bash
cd /opt/auction-platform-src
mysql -u auction_user -p auction_platform < api/src/db/migrations/029_anchor_recommendations.sql
```

历史“龙珠价格参考与发布定价提示”版本需要发布后端 API 服务、执行 `022_dragon_ball_price_references.sql` 价格参考建表迁移和 `023_seed_dragon_ball_price_references.sql` 图片数据初始化迁移、发布管理后台静态资源并重新构建/上传小程序包；“攻略 Tab、兑换码设置与天空塔资料维护”版本新增 `redeem_code_settings` 和 `sky_tower_settings` 表，发布后需要在服务器执行：

```bash
cd /opt/auction-platform-src
mysql -u auction_user -p auction_platform < api/src/db/migrations/024_redeem_code_settings.sql
mysql -u auction_user -p auction_platform < api/src/db/migrations/025_sky_tower_settings.sql
```

当前“攻略实用入口、签到与血量计算”版本不新增数据库表，不需要执行 MySQL migration；发布时需要重新构建/上传小程序包，若线上还未包含 `GET /api/app-config` 和系统配置 `check_in_url`，也需要发布后端 API 和管理后台静态资源。如果线上还未执行自由交换和消息相关迁移，需要先按顺序补齐 `019_exchange_resources.sql`、`020_profile_message_delete_state.sql` 和 `021_exchange_resource_image_amount_expiry.sql`。留言回复通知模板 ID 固定在 `shared/config/wechat-subscribe-templates.json`，如需临时覆盖再配置 `WECHAT_REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID` 和小程序构建变量 `UNI_APP_REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID`。需要确认 Nginx 对 `/ws/messages` 保留 WebSocket Upgrade。生产 API 的 MySQL 连接池支持 `MYSQL_CONNECTION_LIMIT`、`MYSQL_MAX_IDLE` 和 `MYSQL_IDLE_TIMEOUT_MS`，默认低峰只保留少量空闲连接；`server.ts` 会在 systemd `SIGTERM` / `SIGINT` 停止时优雅关闭 Fastify 并释放 MySQL pool。API 会记录接口耗时，超过 `API_SLOW_REQUEST_THRESHOLD_MS` 的慢请求会以 `api_request_slow` 写入 warn 日志；临时把 `LOG_LEVEL` 调成 `info` 时可查看所有 `api_request_completed` 耗时日志。用户图片上传内容安全依赖真实微信登录用户 `openid`，如果发布后仍遇到缺少 openid 的旧登录态，需让用户重新登录后再上传。Mac 本地打包需使用部署文档中的 `COPYFILE_DISABLE=1 tar --no-xattrs --no-fflags` 命令，并排除 `.git`、各 workspace `node_modules` 与构建产物，打包后先校验发布脚本和关键 marker。无数据库变更的常规发布可在服务器上传 `/opt/auction-platform.tar.gz` 后执行 `scripts/prod-release.sh`，脚本会解压到 staging 目录、安装依赖、类型检查、测试、切换运行目录、校验 active 目录内容和 API 进程 cwd、重启 API、健康检查并部署管理后台静态资源；WebSocket 容量评估和 Redis Pub/Sub 多实例升级路径见部署文档“后续扩容计划”；发布记录见 `docs/releases.md`。

当前“活动材料与活动攻略图片入口”版本新增两条系统配置，并把系统配置值字段放宽为 `TEXT` 以支持活动攻略多图链接，发布后需要执行：

```bash
cd /opt/auction-platform-src
mysql -u auction_user -p auction_platform < api/src/db/migrations/027_dungeon_image_urls.sql
mysql -u auction_user -p auction_platform < api/src/db/migrations/028_system_config_value_text.sql
```

该版本需要发布后端 API、管理后台静态资源并重新构建/上传小程序包。活动材料和活动攻略入口位于攻略页顶部“活动入口”，仅在对应图片链接配置后显示；活动攻略多个链接可用换行、逗号或分号分隔。

当前“攻略卡牌升级与赛季挑战”版本新增本地计算工具，不新增 API、后台页面或数据库迁移；发布时只需要重新构建并上传小程序包，同时带上共享代码更新。
