# 砚习 · 个人写作训练助手

砚习是一个面向小说作者、网文新人和长期写作者的本地训练系统。第一阶段已经实现“抽题 → 计时写作 → 自动保存 → 完成训练 → 查看统计 → 回顾作品”的完整闭环；第二阶段已加入动态人物身份调查档案。

## 第一阶段已完成

- 首页 Dashboard：连续写作天数、累计字数、完成次数、专注时长、今日训练、近七天节奏、最近作品。
- 写作训练：9 类训练、随机抽题、训练要求、难度、字数与时间限制、题目收藏。
- Markdown 写作台：标题、H1/H2、加粗、强调、引用、分段、字数统计、计时/暂停、修改次数、自动保存。
- 作品管理：新建、编辑、删除、搜索、分类、状态与最近更新时间。
- 训练题库：12 道内置题目、类型筛选、收藏筛选、完成记录、随机抽取。
- 写作统计：7/30/90 天字数、写作时长、训练次数、训练类型分布和薄弱项提示。
- AI 接口预留：只定义评价入口，不替用户改稿。
- 响应式界面：桌面侧边栏与手机底部导航。

## 人物库已完成

- 人物档案：新建、查看、编辑、删除，以及人物卡片展示。
- 动态调查表：99 个默认调查字段，严格分为身份信息、身体信息、健康信息、成长经历、心理信息、社会关系、职业经济、性格、能力特长、兴趣习惯、其他。
- 动态组件：支持单行文本、数字、日期、多行文本、标签、下拉选择、多选和图片。
- 检索筛选：按姓名搜索，并按一个或多个性格标签筛选。
- 字段管理：新增、修改、分类、描述、排序、拖动排序、上下移动和软删除。
- 数据保留：字段隐藏后，人物已填写的值仍保留在 SQLite 中。
- 自动初始化：首次安装或新建数据库时载入完整默认人物调查字段。

## 技术栈

- 前端：React 19、Vite、Tailwind CSS 4（基础层）与定制样式。
- 后端：Node.js、Express 5。
- 数据库：SQLite，使用 Node.js 自带的 `node:sqlite`。
- 包管理：pnpm。

## 项目结构

```text
writing-assistant
├── frontend          # React 应用与动态人物档案页面
├── backend           # Express API
├── database          # SQLite schema、题库/人物字段种子与本地数据库
├── docs              # 架构与接口说明
├── package.json
└── README.md
```

## 本地运行

环境要求：

- Node.js `22.13` 或更高版本（需要 `node:sqlite`）
- pnpm `10` 或更高版本

首次安装：

```bash
cd writing-assistant
pnpm setup
```

打开两个终端。

终端一启动后端：

```bash
pnpm dev:backend
```

终端二启动前端：

```bash
pnpm dev:frontend
```

浏览器访问 `http://127.0.0.1:5173`。前端会把 `/api` 请求代理到 `http://127.0.0.1:8787`。

数据库会自动创建在 `database/writing-assistant.db`。删除该文件可恢复为空白数据库，下一次启动时会重新载入内置题库和 99 个默认人物调查字段。删除数据库文件会同时删除所有本地作品和人物，请先备份。

## 生产方式运行

```bash
pnpm build
pnpm --dir backend start
```

然后访问 `http://127.0.0.1:8787`。Express 会同时提供 API 与构建后的前端文件。

## 测试

```bash
pnpm test
```

当前覆盖：

- 题库按类型随机抽题与收藏。
- 文稿创建、自动保存、完成训练。
- 30 天统计聚合。
- 中英文混合字数统计与展示格式。
- 99 个默认人物字段及字段类型、分组与顺序。
- 人物创建、编辑、删除、姓名搜索和性格标签筛选。
- 自定义字段新增、修改、排序和软删除后保留已有值。
- 前端生产构建。
- 浏览器实际走通“进入训练 → 写作 → 自动保存 → 完成 → Dashboard 更新”。
- 浏览器实际走通“新建人物 → 填写动态字段 → 添加性格标签 → 保存 → 搜索/筛选 → 查看字段管理”。

## 分模块开发记录

### 1. 项目骨架

新增/调整：

- `frontend/package.json`、`frontend/vite.config.js`、`frontend/index.html`
- `backend/package.json`
- `database/`、`docs/`
- 根目录 `package.json`、`.gitignore`

结果：前后端独立开发，生产环境由 Express 统一提供。

### 2. SQLite、题库与作品 API

新增：

- `database/schema.sql`
- `database/seed-prompts.json`
- `backend/src/db.js`
- `backend/src/app.js`
- `backend/src/server.js`
- `backend/src/utils.js`

结果：题目、作品、完成记录和统计均持久化到 SQLite，不依赖浏览器临时存储。

### 3. 写作训练与编辑器

新增/调整：

- `frontend/src/App.jsx`
- `frontend/src/api.js`
- `frontend/src/utils.js`
- `frontend/src/styles.css`

结果：完成抽题、计时、Markdown 快捷工具、字数统计、自动保存和完成训练。

### 4. 作品、题库与统计

主要文件：

- `frontend/src/App.jsx`
- `frontend/src/styles.css`
- `backend/src/app.js`

结果：实现搜索与分类、收藏与完成筛选、7/30/90 天统计和薄弱项提示。

### 5. 测试与文档

新增：

- `backend/tests/api.test.js`
- `frontend/tests/utils.test.mjs`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/ROADMAP.md`

### 6. 动态人物身份调查档案

新增/调整：

- `database/seed-character-fields.json`
- `database/schema.sql`
- `backend/src/character-routes.js`
- `backend/src/db.js`
- `backend/src/app.js`
- `backend/tests/api.test.js`
- `frontend/src/characters.jsx`
- `frontend/src/api.js`
- `frontend/src/App.jsx`
- `frontend/src/styles.css`

结果：人物档案完全由 `Character_Field` 动态生成；新增、排序或隐藏字段不需要修改人物详情页代码。

## 下一步计划

第二阶段建议按以下顺序推进：

1. 多小说项目管理，为作品、人物和世界观增加 `project_id`。
2. 人物字段模板导入、导出与模板继承。
3. 世界观规则库、组织与历史事件。
4. 三幕结构与黄金三章检查。
5. 人物关系图和时间线。

第三阶段再接入 AI 评价。AI 只标记问题、给训练建议和提出问题，不直接替用户重写文章。
