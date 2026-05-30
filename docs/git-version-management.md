# Git 版本管理指南

本文档用于记录本项目接入 Git 后的版本管理方式。当前项目根目录为：

```bash
/Users/shiran/work/harness/products/auction-platform
```

## 已完成的初始化

项目已经完成本地 Git 初始化：

```bash
git init
```

并已新增 `.gitignore`，默认忽略以下内容：

- `node_modules/` 依赖目录
- `dist/`、`miniapp/unpackage/` 等构建产物
- `.env`、`.env.*` 本地环境变量和密钥文件
- 日志、覆盖率、临时文件和编辑器缓存

`api/.env.example` 会保留在仓库中，方便部署时参考配置项。

## 第一次提交

确认待提交文件：

```bash
git status
```

首次纳入版本管理：

```bash
git add .
git commit -m "chore: initial project import"
```

提交前建议确认没有真实密钥、生产 token、数据库密码或上传图片被误加入暂存区。

## 远程仓库

需要先在 GitHub、GitLab、Gitee 或公司内部 Git 服务中创建一个空仓库。不要勾选自动生成 README、`.gitignore` 或 License，避免和本地已有文件冲突。

创建完成后，在本项目目录执行：

```bash
git branch -M main
git remote add origin <远程仓库地址>
git push -u origin main
```

示例：

```bash
git remote add origin git@github.com:your-org/auction-platform.git
```

## 分支规范

建议保持 `main` 分支为可发布版本，日常开发从 `main` 拉新分支：

```bash
git checkout main
git pull
git checkout -b feature/price-change-subscribe
```

常用分支命名：

- `feature/功能名`：新功能
- `fix/问题名`：问题修复
- `chore/事项名`：配置、文档、构建脚本等维护工作
- `release/日期或版本号`：发布准备分支

功能完成并验证通过后，再合并回 `main`。

## 提交信息规范

建议使用清晰的英文前缀，方便后续检索发布记录：

- `feat:` 新功能
- `fix:` 问题修复
- `docs:` 文档更新
- `style:` 纯样式调整
- `refactor:` 重构
- `test:` 测试相关
- `chore:` 构建、依赖、配置等维护事项

示例：

```bash
git commit -m "feat: add price change subscribe notification"
git commit -m "fix: block bids after asset deadline"
git commit -m "docs: update content safety verification guide"
```

## 日常开发流程

开始开发前：

```bash
git status
git pull
```

完成修改后：

```bash
git status
git add <修改的文件>
git commit -m "fix: describe the change"
git push
```

如果只是想查看某个文件做了哪些修改：

```bash
git diff -- path/to/file
```

如果已经 `git add`，但想取消暂存：

```bash
git restore --staged path/to/file
```

## 发布版本记录

生产发布时建议记录对应提交号：

```bash
git rev-parse --short HEAD
```

发布完成后，可以打标签：

```bash
git tag v2026.05.30
git push origin v2026.05.30
```

同时更新 `docs/releases.md`，记录：

- 发布时间
- 发布提交号
- 涉及服务：API、管理后台、小程序
- 数据库迁移脚本
- 验证命令和结果

## 不能提交的内容

以下内容不要提交到 Git：

- 真实 `.env` 文件
- 微信小程序密钥、JWT 密钥、数据库密码、Cloudflare R2 密钥
- 生产用户 token、管理员 token
- `node_modules/`
- 构建产物，如 `dist/`、`miniapp/unpackage/`
- 本地日志和临时文件
- 用户上传图片、导出文件和数据库备份

如果不确定某个文件是否会被忽略，可以执行：

```bash
git check-ignore -v path/to/file
```

## 需要你完成的事项

1. 选择远程 Git 平台，例如 GitHub、GitLab、Gitee 或内部 Git 服务。
2. 创建一个空仓库，不要自动生成 README 或 `.gitignore`。
3. 配置本机 SSH key 或 HTTPS 凭据，确保可以推送代码。
4. 把远程仓库地址提供给项目维护者，或在本地执行 `git remote add origin <远程仓库地址>`。
5. 确认首次提交前没有敏感配置被加入版本管理。
6. 首次推送后，后续每次生产发布都记录 Git 提交号和发布内容。
