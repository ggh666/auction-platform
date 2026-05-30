# 腾讯云部署说明

本文说明游戏资产交换平台在腾讯云服务器、服务器已安装 MySQL、Cloudflare R2 图片存储组合下的部署注意事项。

## 当前生产能力

当前版本在 `NODE_ENV=production` 下会自动接入 MySQL-backed repositories。用户、资产、资产图片、竞价、个人中心记录、举报、违规公示、管理员账号、图片内容安全结果和后台操作日志会写入 MySQL；本地开发和测试环境仍默认使用内存仓库。

生产环境默认启用微信官方内容安全：资产发布文本和举报文本会调用 `msgSecCheck`，图片上传后会调用 `mediaCheckAsync`，微信回调写入图片审核结果。后台审核资产时，如果资产图片仍是待检测、检测失败或明确违规状态，会先拒绝审核通过；微信返回 `review` 时视为建议人工复核，由后台审核员结合图片内容判断。若图片长期停留在 `pending` 但审核员已人工确认无违规，可在后台二次确认继续通过；该兜底不能绕过 `risky` 高风险图片。

小程序当前首页先选择游戏，目前只有“塔防精灵”入口；进入后按“账号 / 道具”拆分交换列表。列表默认展示最近 7 天发布的数据，支持下拉刷新、触底分页和关键词搜索；带关键词搜索时默认查询最近 60 天数据。用户从对应列表发起发布时，游戏名称和资产类型由页面参数自动带入，不再让用户手动填写分类；道具发布可选择“龙珠”分类，并录入职业、品质和属性。发布页当前不展示截止时间，后端会在未传 `originalEndAt` 时填入默认长期有效时间，数据库截止时间字段继续保留；后台审核通过时，实际交换截止时间会改为审核通过后 24 小时。小程序交换列表、关注列表、我的发布和详情页展示实际截止时间，价格优先展示加价后的当前价。用户可在交换列表关注或取消关注信息，并在列表下方的“我的关注”分页查看关注过的数据。成交记录支持分页并展示资产名称。发布和出价节点会弹出统一免责声明：“本平台仅提供信息交换，不涉及任何线上资金交易，请务必走游戏内安全交易渠道，线下转账风险自担”。用户被其他出价者超价后，API 会创建站内通知，并在游戏首页、交换列表和个人中心展示未读价格变动提醒；配置微信订阅消息模板后，小程序会在成功提交估价后请求服务通知授权，后端会在被超价时尝试发送微信服务通知。前台用户信誉分默认 100 分，主理人可对自己名下违规资产扣减发布者 5 分，信誉分 70 分及以下时只能浏览，不能发布信息、上传资产图片、关注/取消关注、出价、举报或标记通知已读，扣分满 3 个月后自动恢复 100 分。当前小程序端暂不展示举报入口；后端仍保留举报接口和后台举报审核能力。后台封禁用户后，即使该用户仍持有旧登录 token，发布信息、上传资产图片、关注信息、出价和提交举报都会被 API 拦截。后台确认举报并发布违规公示后，仅关联的具体资产列表和详情会展示已公示违规标签，不会扩散到同卖家的其他资产；待审核或未公示的举报不会公开展示。管理后台举报列表会展示举报人姓名和用户 ID，便于运营核对。

生产环境启动时仍保留安全闸门：如果没有通过生产运行时注入 MySQL 仓储，API 会拒绝启动，避免误用内存数据承载真实业务。

## 正式上线闸门

正式上线前必须确认以下事项全部满足：

1. API 已接入 MySQL-backed repositories，用户、资产、资产图片、竞价、个人中心记录、举报、违规记录、管理员账号和后台操作日志都写入 MySQL。
2. API 使用 `NODE_ENV=production` 能正常启动，不再依赖内存仓库和 mock 管理员账号。
3. 管理员账号通过数据库创建，密码使用安全哈希保存，禁用本地开发默认账号。
4. 微信登录、资产发布、图片上传、审核、竞价、个人中心、举报、违规公示流程完成端到端验证。
5. Cloudflare R2 图片上传、图片访问域名、对象 key 规则和容量限制完成验证。
6. 微信内容安全配置完成：服务端环境变量有 `WECHAT_EVENT_TOKEN`，微信公众平台消息推送 URL 指向 `/api/wechat/events`，文本与图片安全冒烟通过。
7. 域名、HTTPS、微信小程序合法域名、备案和隐私合规材料准备完成。

如果以上事项未全部完成，只能作为内部灰度或体验环境部署，不能承载真实用户数据。

## 正式上线 Runbook

以下示例使用：

- API 域名：`api-auction.toolmatrix.top`
- 管理后台域名：`admin-auction.toolmatrix.top`
- API 本机端口：`127.0.0.1:3002`
- 代码目录：`/opt/auction-platform-src`
- 管理后台静态目录：`/var/www/auction-admin`

### 1. 本地打包

在 Mac 本地执行：

```bash
cd /Users/shiran/work/harness

npm --prefix products/auction-platform run typecheck
npm --prefix products/auction-platform test

COPYFILE_DISABLE=1 tar --no-xattrs \
  --exclude='products/auction-platform/node_modules' \
  --exclude='products/auction-platform/*/node_modules' \
  --exclude='products/auction-platform/miniapp/dist' \
  --exclude='products/auction-platform/miniapp/unpackage' \
  --exclude='products/auction-platform/admin/dist' \
  --exclude='.DS_Store' \
  -czf /tmp/auction-platform.tar.gz \
  products/auction-platform
```

上传到服务器：

```bash
scp /tmp/auction-platform.tar.gz root@你的服务器公网IP:/opt/auction-platform.tar.gz
```

### 2. 服务器备份

在服务器执行：

```bash
mkdir -p /root/backups

mysqldump -u auction_user -p --single-transaction auction_platform \
  > /root/backups/auction_platform_$(date +%Y%m%d%H%M%S).sql

tar -czf /root/backups/auction_runtime_$(date +%Y%m%d%H%M%S).tar.gz \
  /opt/auction-platform-src \
  /etc/auction-api.env \
  /www/server/panel/vhost/nginx/auction-platform.conf \
  /var/www/auction-admin 2>/dev/null || true
```

### 3. 解压新版本

```bash
systemctl stop auction-api || true

mv /opt/auction-platform-src /opt/auction-platform-src.bak.$(date +%Y%m%d%H%M%S)
mkdir -p /opt/auction-platform-src

tar --warning=no-unknown-keyword \
  -xzf /opt/auction-platform.tar.gz \
  -C /opt/auction-platform-src \
  --strip-components=2

cd /opt/auction-platform-src
npm ci --include=optional
npm run typecheck
npm test
```

`--include=optional` 必须保留。Vite、Vitest、Rollup、Rolldown、esbuild 等构建工具会按操作系统和 CPU 架构安装原生 optional dependency；如果跳过 optional 依赖，可能出现 `Cannot find module @rollup/rollup-linux-x64-gnu`、`Cannot find native binding` 之类的启动错误。

如果服务器上安装依赖后仍然报原生依赖缺失，优先按当前服务器架构重新安装依赖：

```bash
cd /opt/auction-platform-src

node -p "process.platform + ' ' + process.arch"
npm ci --include=optional
npm run typecheck
npm test
```

### 4. 数据库初始化或迁移

首次部署时创建数据库和账号：

```bash
mysql -u root -p
```

在 MySQL 中执行：

```sql
CREATE DATABASE IF NOT EXISTS auction_platform
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'auction_user'@'127.0.0.1'
  IDENTIFIED BY '替换成强密码';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON auction_platform.*
  TO 'auction_user'@'127.0.0.1';

FLUSH PRIVILEGES;
```

执行初始 schema：

```bash
cd /opt/auction-platform-src
mysql -u auction_user -p auction_platform < api/src/db/migrations/001_initial_schema.sql
```

注意：当前 `001_initial_schema.sql` 是破坏性初始化脚本，会先删除本平台所有业务表再重新创建。只允许在首次部署、空库或明确要重置测试环境时执行。正式环境已有真实数据后，不要重复执行这份 SQL；后续版本应使用迁移脚本或人工差异 SQL。

已有正式数据的环境升级到支持“站内通知/超价提醒”时，执行增量迁移：

```bash
cd /opt/auction-platform-src
mysql -u auction_user -p auction_platform < api/src/db/migrations/002_station_notifications.sql
```

该迁移会创建 `station_notifications` 表，用于保存被超价站内通知和已读状态。执行前仍建议先完成数据库备份。未执行该迁移时，旧版本会在 `GET /api/profile/notifications` 返回 500；当前版本会降级为空列表并记录 `failed to list profile notifications` 日志，但仍需要补齐表结构才能恢复通知功能。

已有正式数据的环境升级到支持“每日发布次数限制”时，执行增量迁移：

```bash
cd /opt/auction-platform-src
mysql -u auction_user -p auction_platform < api/src/db/migrations/003_daily_publish_limit.sql
```

该迁移会给 `users` 表增加 `daily_publish_limit` 字段，并写入系统默认配置 `default_daily_publish_limit=3`。执行前仍建议先完成数据库备份。

已有正式数据的环境升级到支持“微信内容安全”时，继续执行增量迁移：

```bash
cd /opt/auction-platform-src
mysql -u auction_user -p auction_platform < api/src/db/migrations/004_content_safety.sql
```

该迁移会创建 `content_safety_image_checks` 表，用于保存图片异步检测的 `trace_id`、审核状态和微信返回明细。执行前仍建议先完成数据库备份。已有历史待审核资产如果带图片但没有检测记录，后台审核通过时会被拦截；需要重新上传图片、补检测记录，或由管理员按实际情况人工处理。

已有正式数据的环境升级到支持“主理人数据隔离”时，继续执行增量迁移：

```bash
cd /opt/auction-platform-src
mysql -u auction_user -p auction_platform < api/src/db/migrations/005_principals.sql
```

该迁移会创建 `principals` 表，并给 `auction_assets` 增加 `principal_id` 字段。执行前仍建议先完成数据库备份。历史资产默认没有主理人归属，只有超级管理员可见；如需交给主理人处理，需要上线后在后台“主理人管理”选择后台登录用户并绑定主理人，再按业务归属补齐历史资产的 `principal_id`。

已有正式数据的环境升级到支持“小程序关注列表”时，继续执行增量迁移：

```bash
cd /opt/auction-platform-src
mysql -u auction_user -p auction_platform < api/src/db/migrations/006_asset_follows.sql
```

该迁移会创建 `asset_follows` 表，用于保存用户关注的信息关系。执行前仍建议先完成数据库备份；该迁移不修改 `auction_assets` 已有截止时间字段和历史资产数据。

已有正式数据的环境升级到支持“道具龙珠分类”时，继续执行增量迁移：

```bash
cd /opt/auction-platform-src
mysql -u auction_user -p auction_platform < api/src/db/migrations/007_dragon_ball_metadata.sql
```

该迁移会给 `auction_assets` 增加 `item_category`、`dragon_ball_profession`、`dragon_ball_quality`、`dragon_ball_attributes` 可空字段。历史资产、账号和普通道具不会被改写。

已有正式数据的环境升级到支持“用户信誉分”时，继续执行增量迁移：

```bash
cd /opt/auction-platform-src
mysql -u auction_user -p auction_platform < api/src/db/migrations/008_user_credit_score.sql
```

该迁移会给 `users` 表增加 `credit_score` 和 `credit_reset_at` 字段。历史用户默认 100 分；主理人每次扣减 5 分，70 分及以下只能浏览，扣分满 3 个月后由用户读取或写操作校验路径自动恢复到 100 分。

已有正式数据的环境升级到修复“已上架资产仍显示 2099 截止时间”时，继续执行增量迁移：

```bash
cd /opt/auction-platform-src
mysql -u auction_user -p auction_platform < api/src/db/migrations/009_backfill_active_asset_deadlines.sql
```

该迁移会把已上架且仍保留默认长期截止时间的历史资产回填为审核时间后 24 小时；如果历史行没有 `reviewed_at`，则用 `updated_at` 或 `created_at` 兜底。执行前仍建议先完成数据库备份。

### 5. 配置 API 环境变量

```bash
openssl rand -hex 32
vi /etc/auction-api.env
chmod 600 /etc/auction-api.env
```

`/etc/auction-api.env` 示例：

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3002
JWT_SECRET=替换成 openssl 生成的随机字符串
MYSQL_URI=mysql://auction_user:你的数据库密码@127.0.0.1:3306/auction_platform
CORS_ALLOWED_ORIGINS=https://admin-auction.toolmatrix.top,https://servicewechat.com
R2_ENDPOINT=https://你的Cloudflare账号ID.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=你的R2访问Key
R2_SECRET_ACCESS_KEY=你的R2密钥
R2_BUCKET=auction-assets
WECHAT_APPID=你的小程序AppID
WECHAT_APP_SECRET=你的小程序AppSecret
WECHAT_EVENT_TOKEN=你在微信公众平台消息推送中填写的Token
WECHAT_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID=价格变动提醒订阅消息模板ID
WECHAT_SUBSCRIBE_MESSAGE_MINIPROGRAM_STATE=formal
CONTENT_SAFETY_ENABLED=true
CONTENT_SAFETY_STRICT=true
```

`CORS_ALLOWED_ORIGINS` 是生产 API 的跨域白名单，至少应包含管理后台域名；当前线上后台可使用 `https://admin-auction.toolmatrix.top`，微信开发者工具或小程序 WebView 相关请求可保留 `https://servicewechat.com`。未配置时服务端会使用这两个默认值，不再反射任意来源。

`CONTENT_SAFETY_ENABLED=true` 表示启用内容安全；`CONTENT_SAFETY_STRICT=true` 表示微信接口异常、缺少 openid、图片检测未回调时按失败处理。生产环境不允许把这两个变量设置为 `false`，否则 API 会拒绝启动，避免资产发布绕过文本和图片安全校验。

`WECHAT_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID` 用于被超价时发送微信服务通知。该模板需要同时在小程序构建时通过 `UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID` 注入，否则前端不会弹出订阅授权。小程序构建已开放 `UNI_APP_` 环境变量前缀，线上仍建议显式带上该变量再构建。当前订阅消息模板字段必须和代码一致：`amount3` 为设定价格，取被提醒用户原出价；`amount4` 为当前价格，取最新出价；`thing15` 为产品名称；`time11` 为价格变动时间。金额字段只发送数字，不带“元宝”，避免微信 `amount` 类型校验失败。完整配置见 `docs/wechat-price-change-subscribe-message.md`。

### 6. 创建正式管理员账号

首次上线至少创建一个 `super_admin` 后台账号。命令会把密码用 scrypt 哈希后写入 `admin_users` 表；如果用户名已存在，会更新密码、角色并解除禁用。

```bash
cd /opt/auction-platform-src

set -a
source /etc/auction-api.env
set +a

ADMIN_PASSWORD='替换成强密码' \
  npm run admin:create --workspace @auction/api -- \
  --username super \
  --role super_admin
```

也可以创建审核员账号：

```bash
ADMIN_PASSWORD='替换成审核员强密码' \
  npm run admin:create --workspace @auction/api -- \
  --username reviewer \
  --role reviewer
```

不要继续使用本地开发账号 `reviewer/reviewer-pass`、`operator/operator-pass`、`super/super-pass`。这些账号只存在于非生产内存仓库，生产 MySQL 中不会自动创建。

创建审核员账号后，使用 `super_admin` 登录管理后台，在“后台用户”中可继续创建、编辑、生成临时密码、设置 `super_admin / reviewer / operator` 三种角色，并填写关联主理人名称；也可以在“主理人管理”中从后台登录用户下拉列表选择账号并绑定主理人名称。重置密码会生成随机临时密码并让旧密码立即失效，不再使用固定默认密码。删除后台用户会采用停用账号的软删除方式，并同步停用绑定主理人。未绑定主理人的非超级管理员账号无法看到资产和举报数据；这是数据隔离的安全保护。

### 7. 配置 systemd

建议使用独立系统用户运行 API：

```bash
useradd --system --home /var/lib/auction-api --shell /sbin/nologin auction-api || true
mkdir -p /var/lib/auction-api
chown -R auction-api:auction-api /var/lib/auction-api
chown -R auction-api:auction-api /opt/auction-platform-src
```

创建 `/etc/systemd/system/auction-api.service`：

```ini
[Unit]
Description=Auction Platform API
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=/opt/auction-platform-src
EnvironmentFile=/etc/auction-api.env
Environment=HOME=/var/lib/auction-api
ExecStart=/opt/auction-platform-src/node_modules/.bin/tsx api/src/server.ts
Restart=always
RestartSec=5
User=auction-api
Group=auction-api

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
systemctl daemon-reload
systemctl enable auction-api
systemctl start auction-api
systemctl status auction-api --no-pager
journalctl -u auction-api -n 80 --no-pager
curl http://127.0.0.1:3002/health
```

如果日志出现 `Missing required production environment variable`，按提示补齐 `/etc/auction-api.env`。如果日志出现 `Production repositories must be explicitly configured`，说明启动入口没有使用 `api/src/runtimeApp.ts`，需要确认服务器代码已更新到当前版本，且 `ExecStart` 指向 `api/src/server.ts`。

### 8. 构建和部署管理后台

```bash
cd /opt/auction-platform-src

VITE_API_BASE=https://api-auction.toolmatrix.top npm run build --workspace @auction/admin

rm -rf /var/www/auction-admin
mkdir -p /var/www/auction-admin
cp -a admin/dist/. /var/www/auction-admin/
```

### 9. 配置 Nginx

创建或更新 `/www/server/panel/vhost/nginx/auction-platform.conf`：

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    server_name api-auction.toolmatrix.top;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 300s;
    }
}

# HTTPS - API（如果你申请了证书）
server {
    listen 443 ssl;
    server_name api-auction.toolmatrix.top;

    ssl_certificate     /etc/letsencrypt/live/api-auction.toolmatrix.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-auction.toolmatrix.top/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 300s;
    }
}

server {
    listen 80;
    server_name admin-auction.toolmatrix.top;

    root /var/www/auction-admin;
    index index.html;

    location / {
        try_files $uri /index.html;
    }
}

server {
    listen 443 ssl;
    server_name admin-auction.toolmatrix.top;

    ssl_certificate     /etc/letsencrypt/live/api-auction.toolmatrix.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-auction.toolmatrix.top/privkey.pem;

    root /var/www/auction-admin;  # 前端打包文件路径
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;  # SPA 路由支持
    }
}
```

检查并 reload：

```bash
/etc/init.d/nginx start
/etc/init.d/nginx stop
/etc/init.d/nginx restart
/etc/init.d/nginx reload
/etc/init.d/nginx status
```

如果 Cloudflare 代理到源站 80 端口，需在 Cloudflare 中启用 HTTPS，并确认 `api-auction.toolmatrix.top` 和 `admin-auction.toolmatrix.top` 的 DNS 都开启代理。正式生产建议使用 Full 或 Full strict 模式，并给源站配置证书。

### 10. 上线验证

```bash
curl http://127.0.0.1:3002/health
curl -H "Host: api-auction.toolmatrix.top" http://127.0.0.1/health
curl -I -H "Host: admin-auction.toolmatrix.top" http://127.0.0.1/

curl https://api-auction.toolmatrix.top/health
curl -I https://admin-auction.toolmatrix.top/
```

期望：

- API 返回 `{"ok":true,"service":"auction-api"}`。
- 管理后台返回 `200` 或 `304`，并且是 HTML 页面。
- 使用刚创建的 MySQL 管理员账号可以登录管理后台。
- 管理后台仪表盘、资产审核、举报审核页面能正常请求 API。
- 小程序体验版能访问 API，微信开发者工具中无合法域名错误。

正式上线前建议再做一轮业务冒烟：

1. 小程序微信登录成功，数据库 `users` 表出现用户。
2. 从“塔防精灵 -> 账号”或“塔防精灵 -> 道具”列表进入发布页，发布一条带图片资产；发布道具龙珠时应能选择职业、品质并填写属性；提交前应弹出免责声明，发布页应自动带入游戏和分类，图片可选择、删除和预览；数据库 `auction_assets` 表出现 `pending_review` 记录，`asset_images` 表出现图片记录。
3. 数据库 `content_safety_image_checks` 表出现图片检测记录；微信回调后图片状态变为 `pass`，如果仍是 `pending`，后台审核通过应被 API 拦截。
4. 后台审核通过，资产状态变成 `active`。
5. 另一个用户出价，提交前应弹出免责声明；出价成功后若小程序构建配置了订阅消息模板 ID，应弹出微信订阅授权；数据库 `bids` 表有记录，资产 `current_price_cents` 和 `highest_bidder_id` 更新，详情页能显示出价人昵称；小程序列表默认能看到最近 7 天数据，搜索关键词时能查到最近 60 天内的匹配资产，并可触底加载下一页。
6. 发生超价后，数据库 `station_notifications` 表出现记录；上一位出价用户能在小程序首页、交换列表或个人中心看到未读价格变动提醒，并能在站内通知页看到被超价通知。若已配置订阅消息模板且上一位出价用户在成功提交估价后允许订阅，还应收到微信服务通知；模板卡片中 `设定价格` 应显示上一位出价用户原出价，`当前价格` 应显示最新出价，`产品名称` 应显示资产标题，`价格变动时间` 应显示本次通知创建时间。
7. 后台用户管理能设置单个用户每日发布次数；设置为 `0` 后，该用户发布资产应被 API 拦截。主理人在资产审核或详情页扣减信誉分后，用户信誉分应减少 5 分；70 分及以下时公开列表和详情仍可浏览，发布、上传图片、关注、出价、举报和标记通知已读应被 API 拦截。
8. 小程序个人中心的“我的发布”“我的出价”“成交记录”“站内通知”能从真实接口读取数据；成交记录应展示资产名称并支持分页加载，不再额外弹出免责声明。
9. 当前小程序端不展示举报入口；如需验证后端保留接口，可直接调用 `POST /api/reports`，未参与该资产出价的用户提交举报应被 API 拦截；后台举报列表应展示举报人姓名和用户 ID；后台确认、发布违规公示后，`reports` 与 `violation_records` 表有记录，小程序对应资产列表和详情应展示已公示违规标签。

### 11. 微信小程序发布

小程序建议在 Mac 本地构建：

```bash
cd /Users/shiran/work/harness/products/auction-platform

npm install --include=optional

UNI_APP_API_BASE=https://api-auction.toolmatrix.top \
UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID=xnfSOrsId25WJBEWJkbG8UDRp4PD8pyHAx2F_47_2X0 \
  npm run build:mp-weixin --workspace @auction/miniapp
```

如果本地构建或 `npm test` 报以下错误：

```text
Cannot find module @rollup/rollup-darwin-x64
Cannot find module @rollup/rollup-darwin-arm64
Cannot find native binding
```

通常是 Mac 上混用了 x64 / arm64 Node，或 npm 没有把当前架构需要的 optional dependency 装完整。先确认 npm 脚本实际使用的 Node 架构：

```bash
cd /Users/shiran/work/harness/products/auction-platform

npm run env --silent | grep '^npm_config_user_agent='
```

如果输出里是 `darwin x64`，执行：

```bash
npm install --include=optional --os=darwin --cpu=x64
npm test
```

如果输出里是 `darwin arm64`，执行：

```bash
npm install --include=optional --os=darwin --cpu=arm64
npm test
```

不要在同一个 `node_modules` 目录里频繁切换 x64 和 arm64 Node。切换 Node 架构后，需要按新架构重新执行上面的安装命令。

用微信开发者工具导入：

```text
/Users/shiran/work/harness/products/auction-platform/miniapp/dist/build/mp-weixin
```

上传体验版前，在微信公众平台配置：

- request 合法域名：`https://api-auction.toolmatrix.top`
- uploadFile 合法域名：`https://api-auction.toolmatrix.top`
- socket 合法域名：`wss://api-auction.toolmatrix.top`

当前小程序图片上传通过 `POST /api/images` 走 `uni.request` JSON 请求，实际仍需要 request 合法域名；保留 uploadFile 合法域名配置是为了后续切换原生 multipart 上传时不用重新补域名。

### 12. 回滚

如果新版本启动失败：

```bash
systemctl stop auction-api || true

mv /opt/auction-platform-src /opt/auction-platform-src.failed.$(date +%Y%m%d%H%M%S)
mv /opt/auction-platform-src.bak.替换成备份时间戳 /opt/auction-platform-src

chown -R auction-api:auction-api /opt/auction-platform-src
systemctl start auction-api
systemctl status auction-api --no-pager
curl http://127.0.0.1:3002/health
```

如果数据库迁移已执行且需要回滚，先停止 API，再从 `/root/backups` 中的 `mysqldump` 备份恢复。

## 服务组成

- API 服务运行在腾讯云服务器，监听内网或本机端口，例如 `127.0.0.1:3002`。
- MySQL 使用服务器上已安装实例，建议为本平台创建独立数据库和最小权限账号。
- 图片资源使用 Cloudflare R2 bucket 存储，API 通过 R2 endpoint、access key 和 secret key 写入对象，资产记录保存图片 URL。
- 管理后台使用 `npm run build --workspace @auction/admin` 构建后由 Nginx 托管静态文件。
- 小程序端上传到微信公众平台，生产接口统一访问 HTTPS 域名。
- 管理后台构建时设置 `VITE_API_BASE=https://api.example.com`。
- 小程序构建时设置 `UNI_APP_API_BASE=https://api.example.com`。

## 环境变量

API 生产环境变量参考 `api/.env.example`，至少需要配置：

- `NODE_ENV`
- `HOST`
- `PORT`
- `JWT_SECRET`
- `MYSQL_URI`
- `CORS_ALLOWED_ORIGINS`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `WECHAT_APPID`
- `WECHAT_APP_SECRET`
- `WECHAT_EVENT_TOKEN`
- `WECHAT_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID`，启用价格变动服务通知时填写
- `WECHAT_SUBSCRIBE_MESSAGE_MINIPROGRAM_STATE`，正式版填 `formal`，体验版填 `trial`
- `CONTENT_SAFETY_ENABLED`
- `CONTENT_SAFETY_STRICT`

`JWT_SECRET` 必须使用足够长的随机字符串。`MYSQL_URI` 建议指向本机 MySQL，并使用只授予本业务库权限的账号。`CORS_ALLOWED_ORIGINS` 使用英文逗号分隔生产允许跨域访问 API 的来源，例如 `https://admin-auction.toolmatrix.top,https://servicewechat.com`。

`WECHAT_EVENT_TOKEN` 必须和微信公众平台“开发管理 -> 开发设置 -> 消息推送”中的 Token 完全一致。`CONTENT_SAFETY_ENABLED` 和 `CONTENT_SAFETY_STRICT` 正式环境必须设置为 `true`；如果设置为 `false`，生产 API 会拒绝启动。

不要在生产环境使用本地开发的内存管理员账号。管理员账号应使用 `npm run admin:create --workspace @auction/api` 写入 MySQL，密码会以 scrypt 哈希保存。

## Nginx 与 HTTPS

- 为 API 和管理后台准备正式域名，例如 `api.example.com` 和 `admin.example.com`。
- 使用可信 CA 证书启用 HTTPS，可通过腾讯云证书服务或其他证书渠道签发。
- Nginx 将 API HTTPS 请求反向代理到本机 API 端口。
- WebSocket 路由需要保留 `Upgrade` 与 `Connection` 头，并设置合适的超时时间。
- 管理后台静态资源可由 Nginx `root` 指向构建产物目录，前端路由需要回退到 `index.html`。

## 微信合法域名

上线前需要在微信公众平台配置并确认：

- request 合法域名包含生产 API HTTPS 域名。
- uploadFile 合法域名包含图片上传接口域名。
- socket 合法域名包含 WebSocket HTTPS 域名。
- 所有域名必须已备案并能通过 HTTPS 访问。
- 微信登录所需的 appid 和 secret 应只放在服务端环境变量或安全配置中。

## 微信内容安全

当前服务端接入微信官方内容安全接口：

- `msgSecCheck`: 发布资产时检查游戏名称、区服、资产类型、标题和描述；提交举报时检查举报原因和证据描述。
- `mediaCheckAsync`: 图片上传到 R2 后，把图片公开 URL 提交给微信异步检测。
- `/api/wechat/events`: 微信消息推送回调，保存 `mediaCheckAsync` 的检测结果。

服务端还内置一层基础高危词兜底。发布文本命中 `赌博`、`卖淫`、`偷盗` 等明确违规词时，会先返回 `content_safety_risky`，再由微信 `msgSecCheck` 覆盖更广的风险模型。

微信公众平台配置步骤：

1. 进入小程序后台“开发管理 -> 开发设置 -> 消息推送”。
2. URL 填写 `https://api-auction.toolmatrix.top/api/wechat/events`。
3. Token 填写和 `/etc/auction-api.env` 中 `WECHAT_EVENT_TOKEN` 完全一致的值。
4. EncodingAESKey 可选择随机生成；当前服务端按明文模式处理消息，消息加解密方式建议先选明文模式。
5. 提交配置前，确认 Nginx 会把 `/api/wechat/events` 转发到 API，且 `GET` 校验能返回微信传入的 `echostr`。

上线后检查：

```bash
npm run verify:content-safety -- local
npm run verify:content-safety -- env
journalctl -u auction-api -n 100 --no-pager
mysql -u auction_user -p auction_platform -e "SELECT public_url,status,trace_id,label,updated_at FROM content_safety_image_checks ORDER BY updated_at DESC LIMIT 10;"
```

正常流程是：图片上传后表中出现 `pending`，微信回调后变为 `pass`、`review` 或 `risky`。`review` 代表建议人工复核，不等于明确违规；后台审核员确认图片无问题后可以继续通过。`risky` 代表明确高风险，会阻断审核通过。如果一直停留在 `pending`，优先检查 R2 图片 URL 是否能被公网访问、微信消息推送 URL/Token 是否正确、Nginx 是否转发了 `POST /api/wechat/events`。运营急需处理时，可在后台审核页确认“已人工查看图片”后继续通过 pending 图片，操作会写入后台操作日志；`risky` 图片仍不能绕过。

完整的 `msgSecCheck` 和 `mediaCheckAsync` 验证步骤见 `docs/content-safety-verification.md`，其中包含小程序 token、主理人 ID、图片上传和后台审核拦截的可执行命令。

## 数据库与迁移

- 创建独立数据库，例如 `auction_platform`。
- 创建独立 MySQL 用户并限制访问来源与权限。
- 部署新版本前先备份数据库。
- 首次部署需要执行项目数据库初始化。
- 后续升级不要重复执行破坏性初始化 SQL，应使用增量迁移或人工差异 SQL。
- 迁移失败时应停止发布，保留日志并从备份或迁移脚本状态恢复。

当前可手动执行初始 schema：

```bash
cd products/auction-platform
mysql -u auction_user -p auction_platform < api/src/db/migrations/001_initial_schema.sql
```

注意：`001_initial_schema.sql` 会先删除再创建本平台所有表。正式环境已有数据后不要重复执行。

已有正式数据的升级环境执行站内通知迁移：

```bash
cd products/auction-platform
mysql -u auction_user -p auction_platform < api/src/db/migrations/002_station_notifications.sql
```

已有正式数据的升级环境执行每日发布次数迁移：

```bash
cd products/auction-platform
mysql -u auction_user -p auction_platform < api/src/db/migrations/003_daily_publish_limit.sql
```

已有正式数据的升级环境执行微信内容安全迁移：

```bash
cd products/auction-platform
mysql -u auction_user -p auction_platform < api/src/db/migrations/004_content_safety.sql
```

已有正式数据的升级环境执行主理人数据隔离迁移：

```bash
cd products/auction-platform
mysql -u auction_user -p auction_platform < api/src/db/migrations/005_principals.sql
```

已有正式数据的升级环境执行关注列表迁移：

```bash
cd products/auction-platform
mysql -u auction_user -p auction_platform < api/src/db/migrations/006_asset_follows.sql
```

已有正式数据的升级环境执行道具龙珠分类迁移：

```bash
cd products/auction-platform
mysql -u auction_user -p auction_platform < api/src/db/migrations/007_dragon_ball_metadata.sql
```

已有正式数据的升级环境执行用户信誉分迁移：

```bash
cd products/auction-platform
mysql -u auction_user -p auction_platform < api/src/db/migrations/008_user_credit_score.sql
```

已有正式数据的升级环境执行已上架资产截止时间回填迁移：

```bash
cd products/auction-platform
mysql -u auction_user -p auction_platform < api/src/db/migrations/009_backfill_active_asset_deadlines.sql
```

## Cloudflare R2

- 创建专用 bucket，例如 `auction-assets`。
- 创建最小权限 R2 access key，只允许本 bucket 所需操作。
- 确认 `R2_ENDPOINT` 使用账号级 endpoint。
- 当前 API 会把图片 URL 生成为 `${R2_ENDPOINT}/${R2_BUCKET}/${objectKey}`。正式环境必须确认该 URL 能被小程序和微信内容安全接口直接访问；如果账号级 endpoint 不能公开读图，需要给 bucket 配置公开访问域名，或后续把代码改成使用独立的公开图片域名。
- 小程序端当前会先把本地图片转成 base64，通过 `POST /api/images` 上传到 API；API 校验 MIME 类型、大小限制后写入 R2。当前限制：最多 9 张，单张最大 5MB，仅允许 JPEG、PNG、WebP。
- 小程序发布页会把当前资产分类传给图片上传接口；账号图 objectKey 前缀为 `uploads/accounts/{userId}/`，道具和历史装备图前缀为 `uploads/items/{userId}/`。Cloudflare 可分别针对 `/uploads/accounts/*` 和 `/uploads/items/*` 配置不同缓存或有效期；未传分类的旧客户端仍使用兼容前缀 `uploads/{userId}/`。
- 图片写入 R2 后，API 会立即请求微信 `mediaCheckAsync`，并把返回的 `trace_id` 写入 `content_safety_image_checks`。后台审核通过资产前会校验这些图片记录。
- 不要把 R2 secret key 写入前端、小程序包或仓库。

## 已接入 API

小程序端已接入：

- `POST /api/auth/wechat-login`: 微信登录。
- `GET /api/profile/me`: 当前用户资料，包含 `creditScore` 和 `creditResetAt`。
- `GET /api/assets`: 交换列表，支持 `gameName`、`assetType`、`keyword`、`page`、`pageSize`、`createdWithinDays` 查询参数，用于按游戏和“账号 / 道具”拆分列表；未搜索时默认查最近 7 天，带关键词搜索时默认查最近 60 天；返回 `principal`、可选 `dragonBall` 和 `hasPublishedViolation`，携带用户 token 时返回 `followedByMe`。
- `GET /api/assets/:assetId`: 交换详情、图片、主理人摘要、卖家摘要、最近出价人、可选龙珠信息和已公示违规标签；未登录用户只能查看已上架且未截止的信息，卖家或参与过出价的用户携带 token 时可查看自己相关记录并返回 `followedByMe`。
- `POST /api/images`: 上传资产图片；可传 `assetType` 区分 R2 objectKey 前缀；封禁用户不可上传。
- `POST /api/assets`: 发布资产，受每日发布次数和信誉分限制；`originalEndAt` 非必填，未传时服务端填入默认长期有效时间；道具龙珠可传 `itemCategory="龙珠"` 和 `dragonBall.profession/quality/attributes`；封禁用户或信誉分 70 分及以下用户不可发布。
- `POST /api/assets/:assetId/follow`: 关注已上架且未结束的信息；封禁用户不可关注。
- `POST /api/assets/:assetId/unfollow`: 取消关注信息。
- `POST /api/bids`: 出价；封禁用户不可出价。
- `GET /api/profile/assets`: 我的发布。
- `GET /api/profile/follows`: 我的关注列表，支持 `page`、`pageSize` 分页。
- `GET /api/profile/bids`: 我的出价。
- `GET /api/profile/results`: 成交/流拍记录。
- `GET /api/profile/notifications`: 站内通知，返回 `items` 和 `unreadCount`；通知存储异常时降级为空列表并记录服务端错误日志。
- `POST /api/profile/notifications/:notificationId/read`: 标记通知已读。
- `POST /api/reports`: 后端保留的举报提交接口；当前小程序不展示入口。请求必须携带 `targetUserId`、`assetId`、`reason`、`evidence`，且当前用户必须参与过该资产出价；封禁用户不可举报。
- `GET /api/violations`: 违规公示。
- `WS /ws/auctions?assetId=...`: 交换详情实时事件。
- `GET|POST /api/wechat/events`: 微信消息推送回调，用于图片安全异步结果。

管理后台已接入：

- `POST /admin/auth/login`: 管理员登录；同一 IP 和登录名连续错误会短时限流。
- 后台所有列表查询统一支持 `page`、`pageSize` 分页，并返回 `items`、`total`、`page`、`pageSize`；包括资产审核、资产数据、举报审核、前台用户、后台用户、主理人和系统配置。
- `GET /admin/admin-users`: 后台登录账号列表，返回角色、状态和关联主理人。
- `POST /admin/admin-users`: 创建后台登录账号，角色仅支持 `super_admin`、`reviewer`、`operator`。
- `POST /admin/admin-users/:adminId/update`: 更新后台登录名、角色或启停状态；后台页面使用该接口保存基础信息，避免 PATCH 预检失败。
- `POST /admin/admin-users/:adminId/reset-password`: 为后台账号生成新的临时密码，旧密码立即失效，响应返回 `temporaryPassword`。
- `PATCH /admin/admin-users/:adminId`: 兼容旧版调用，可更新后台登录名、密码、角色或启停状态。
- `DELETE /admin/admin-users/:adminId`: 停用后台登录账号，并同步停用绑定主理人。
- `GET /admin/dashboard`: 运营仪表盘统计指标、待审核资产和待处理举报。
- `GET /admin/assets`: 资产数据列表，支持状态、游戏名称、资产类型、关键词和分页。
- `GET /admin/assets/export`: 导出资产数据 Excel，支持与资产数据列表相同的状态、游戏名称、资产类型和关键词筛选，并按登录管理员数据范围隔离。
- `GET /admin/assets/review`: 待审核资产。
- `POST /admin/assets/:assetId/approve`: 审核通过资产，并把实际交换截止时间设置为审核通过后 24 小时；可传 `{ "imageSafetyOverride": true }` 对已有检测记录但仍为 `pending` 或 `failed` 的图片进行人工确认通过，无检测记录或明确 `risky` 图片仍会被服务端拦截。
- `POST /admin/assets/:assetId/reject`: 驳回资产。
- `POST /admin/assets/:assetId/deduct-credit`: 主理人审核自己名下资产时扣减发布者信誉分 5 分，并写入后台操作日志。
- `POST /admin/assets/remove/batch`: 批量下架已上架资产，逐条返回成功和失败明细。
- `POST /admin/assets/:assetId/remove`: 下架已上架资产。
- `GET /admin/users`: 用户管理列表，返回封禁状态、每日发布次数、违规次数和信誉分。
- `POST /admin/users/:userId/ban`: 封禁用户。
- `POST /admin/users/:userId/unban`: 解除封禁。
- `POST /admin/users/:userId/publish-limit`: 设置或清空单个用户每日发布次数。
- `GET /admin/configs`: 平台配置列表。
- `POST /admin/configs/:key`: 更新平台配置。
- `GET /admin/reports`: 举报列表，返回举报人姓名 `reporterDisplayName` 和举报人 ID。
- `POST /admin/reports/:reportId/confirm`: 确认举报。
- `POST /admin/reports/:reportId/reject`: 驳回举报。
- `POST /admin/reports/:reportId/publish-violation`: 发布违规公示。

后台角色页面权限：

| 角色 | 可见页面 | 页面内主要能力 | 数据范围 |
| --- | --- | --- | --- |
| `super_admin` | 仪表盘、审核管理、资产数据、后台用户、主理人管理、前台用户、系统配置 | 全量管理；可导出资产数据、审核/批量审核资产、扣减违规资产卖家信誉分、确认/驳回举报、发布违规公示、下架/批量下架已上架资产、管理后台账号、绑定主理人、管理前台用户风控和系统配置 | 全部数据，包含未绑定主理人的历史资产 |
| `reviewer` | 仪表盘、审核管理、资产数据 | 查看和导出资产数据；通过/驳回/批量审核待审核资产；扣减自己名下违规资产卖家信誉分；查看、确认、驳回举报并发布违规公示 | 仅绑定主理人名下的数据；未绑定可用主理人时资产/举报列表为空，详情和操作返回 404 |
| `operator` | 仪表盘、资产数据 | 查看和导出资产数据；下架/批量下架已上架资产；当前无审核管理、举报审核、用户管理、主理人管理和系统配置入口 | 仅绑定主理人名下的数据；未绑定可用主理人时资产列表为空，详情和操作返回 404 |

管理后台侧边栏按角色控制页面入口，服务端接口按具体权限二次校验。当前 `operator` 保留 `asset:remove` 和 `auction:cancel` 权限，其中下架已在“资产数据”页开放，取消交换能力暂无独立后台页面入口。

后续可扩展更细的图表、趋势统计和运营漏斗分析。

## 进程守护与日志

- 使用 systemd、PM2 或腾讯云进程管理方案守护 API 进程。
- 进程启动命令应加载生产环境变量，并在异常退出后自动重启。
- 标准输出和错误日志需要落盘或接入日志服务。
- 发布新版本后确认健康检查、登录、图片上传、微信内容安全回调、发布、仪表盘、审核、竞价、个人中心、举报和 WebSocket 连接正常。
- 建议配置磁盘、CPU、内存、端口存活和 5xx 告警。

## 站内通知排查

如果小程序控制台出现 `GET /api/profile/notifications 500`，或个人中心通知入口一直为空，优先检查通知表和 API 日志：

```bash
mysql -u auction_user -p auction_platform -e "SHOW TABLES LIKE 'station_notifications';"
mysql -u auction_user -p auction_platform -e "DESCRIBE station_notifications;"
mysql -u auction_user -p auction_platform -e "SELECT id,user_id,type,asset_id,bid_id,read_at,created_at FROM station_notifications ORDER BY created_at DESC LIMIT 10;"
journalctl -u auction-api -n 100 --no-pager
```

正常情况下，未登录请求 `GET /api/profile/notifications` 返回 401；已登录用户请求返回 200，响应包含 `items` 和 `unreadCount`。当前版本在通知存储异常时会返回空列表并记录 `failed to list profile notifications`，这只是可用性降级，仍需执行 `002_station_notifications.sql` 或修复表结构。

## 发布检查

1. 安装依赖并执行全部工作区检查；服务器和本地构建都需要包含 optional dependency。
2. 执行 `npm run typecheck` 和 `npm test`。
3. 首次部署执行数据库初始化；升级环境先备份并执行增量 SQL，例如 `002_station_notifications.sql`、`003_daily_publish_limit.sql`、`004_content_safety.sql` 和 `005_principals.sql`。
4. 创建或确认 MySQL 管理员账号，并在后台绑定主理人与后台用户。
5. 更新 API 环境变量并重启受守护的 API 进程。
6. 部署管理后台构建产物到 Nginx 静态目录。
7. 检查 Nginx 配置并 reload。
8. 在微信公众平台确认合法域名、消息推送 URL/Token 和体验版小程序接口可用。
9. 更新 `docs/releases.md`，记录发布日期、迁移要求、验证命令、已知风险和回滚注意事项。
