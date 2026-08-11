# 架构说明

## 设计目标

当前版本优先保证个人本地使用、数据真实落盘、模块边界清晰。没有引入账号、云服务、消息队列或复杂状态管理。

## 请求流

```text
React UI
  ↓ /api
Vite 开发代理（开发环境）
  ↓
Express API
  ↓
node:sqlite
  ↓
database/writing-assistant.db
```

生产环境中由 Express 直接提供 `frontend/dist`，不再需要 Vite。

Tauri 桌面版请求流：

```text
Tauri WebView2 窗口
  ↓ 随机 127.0.0.1 端口
内置 Node.js + Express
  ↓ node:sqlite
%APPDATA%/com.risievol2.inkstone/writing-assistant.db
```

正式构建先将 Node 运行时、标准生产 `node_modules`、后端源码、前端 `dist`、Schema 和种子 JSON 暂存为 Tauri resources。该暂存目录受 Git 忽略且构建脚本会拒绝清理任何非固定目标目录；本地数据库和 `.env` 不会进入安装包。

## 启动模式

- `pnpm dev` 通过统一启动器同时管理 Vite 与 Express，任一服务退出时会停止另一服务。
- `pnpm start` 先构建前端，再只保留一个 Express 应用进程，同时提供页面与 `/api`。
- 两种模式默认都会在服务就绪后打开浏览器；自动化环境可传入 `--no-open`。
- 原有 `pnpm dev:frontend` 与 `pnpm dev:backend` 保留，用于单独排查前端或后端。
- `pnpm desktop:dev` 复用开发服务并打开 Tauri 窗口。
- `pnpm desktop:build` 生成 Windows x64 NSIS `setup.exe`。

## 桌面进程与数据生命周期

- 开发模式由 Tauri 的 `beforeDevCommand` 启动统一 Web 开发入口。
- 正式桌面版从安装资源启动内置 Node 后端，先选择空闲端口，确认服务就绪后再创建窗口。
- 主窗口关闭时，Tauri 会停止它启动的后端子进程。
- 数据库与 `backend.log` 写入系统 app data，而不是只读安装目录，因此升级应用不会覆盖写作数据。
- WebView 仅允许导航到本次启动选择的 `127.0.0.1` 端口，页面不获得 Tauri IPC 权限。

## 桌面发布

`.github/workflows/ci.yml` 监听直接推送 `main` 与 Pull Request，在 Windows x64 Runner 上运行测试并完整构建 unsigned NSIS 安装包，但不上传产物或创建 Release。功能分支只通过 PR 触发，避免同一提交同时运行 push 与 PR 两份构建。

`.github/workflows/release-tauri.yml` 监听 `v*` 标签并要求标签与 `package.json` 版本一致。`-beta` / `-beta.N` 版本明确使用 `--no-sign` 并发布为 GitHub Pre-release；其他预发布后缀会被拒绝。无后缀正式版本从 GitHub Secrets 导入 PFX，Tauri 使用证书指纹、SHA-256 和 RFC 3161 时间戳签署应用程序与 NSIS 安装包。官方 Action 先创建草稿 Release；只有两个 `.exe` 的 Authenticode 状态均为 `Valid` 才公开发布。

## 数据模型

### prompts

保存训练题目、类型、难度、要求、字数限制、建议时间和收藏状态。

### works

同时承载练习作品与自由文稿。训练完成状态、训练类型、字数、写作时长、修改次数都保存在作品记录上。

第一阶段没有单独拆分 `training_sessions`，因为一次训练只对应一篇作品。未来支持同一作品多次训练或多人协作时，再拆分会更合理。

### Character

人物主表只保存 `id`、`name`、`avatar` 和创建/更新时间。姓名与头像同时由稳定的系统字段同步，字段重命名后仍能正常显示人物卡片。

### Character_Field

保存人物调查字段定义：名称、类型、分类、描述、选项、排序、必填状态、默认字段状态和软删除状态。默认调查表由 `database/seed-character-fields.json` 初始化。

人物详情页先读取字段定义，按 `category` 分组、按 `sort_order` 排序，再根据 `field_type` 生成对应输入组件。数据库新增普通字段后不需要修改前端页面。

### Character_Value

通过 `character_id + field_id` 保存每个人物的动态值，并用唯一约束确保一个人物的一个字段只有一份当前值。`tag` 和 `multiple` 以 JSON 数组字符串保存；其他类型以文本保存。

字段删除采用 `Character_Field.is_deleted=1`。查询普通档案时隐藏该字段，但 `Character_Value` 不删除，因此恢复或审计时仍可取回原数据。

## 自动保存

编辑器内容变化后延迟约 700ms 保存。完成训练、手动保存和离开编辑器时也会执行保存。服务端重新计算字数，避免前端显示与数据库统计不一致。

## 统计

统计接口从已完成作品按本地日期聚合，不保存重复汇总表。个人数据量下，这种方式简单、可靠且便于修改。

## 未来扩展边界

- 多小说：为核心表加入 `project_id`。
- 人物模板：增加模板表及字段关联，支持 JSON 导入导出、继承和项目级覆盖。
- 云同步：在数据访问层之上增加同步队列，不直接改 UI。
- AI：保持独立 `/api/ai/*` 命名空间。
- 手机端：当前为响应式 Web；未来可复用 API 包装成 PWA 或原生壳。
