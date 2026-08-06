# 砚习 · 个人写作训练助手

[![Release](https://img.shields.io/github/v/release/risievol2-alt/writing-assistant?display_name=tag)](https://github.com/risievol2-alt/writing-assistant/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-2d5146)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22.13%2B-5FA04E)](https://nodejs.org/)

砚习是面向小说作者、网文新人和长期写作者的本地写作训练系统。它把随机抽题、计时写作、自动保存、作品回顾和成长统计串成每日可重复的训练闭环，并提供可动态扩展的人物身份调查档案。

> 所有作品与人物资料默认只保存在本机 SQLite 数据库中。

## 项目截图

### 写作 Dashboard

![砚习写作 Dashboard](docs/images/dashboard.png)

### 动态人物库

![砚习人物库](docs/images/character-library.png)

## 功能特点

- **每日写作闭环**：随机训练题、训练要求、倒计时、字数统计、自动保存和完成记录。
- **Markdown 写作台**：标题、加粗、强调、引用、分段、写作时长和修改次数。
- **训练题库**：9 类训练、12 道内置题目、难度与字数限制、收藏和完成筛选。
- **作品管理**：练习、章节、人物资料、世界观资料和废稿的增删改查、搜索与标签。
- **成长统计**：连续写作、累计字数、7/30/90 天趋势、训练分布和薄弱项提示。
- **动态人物档案**：99 个默认调查字段，覆盖身份、身体、健康、成长、关系、性格、能力和兴趣。
- **字段管理系统**：字段新增、修改、拖动排序和软删除；人物详情页由字段配置自动生成。
- **本地优先**：SQLite 本机存储，不上传文章；桌面与移动尺寸均可使用。
- **AI 接口预留**：未来只帮助发现问题和给出训练建议，不直接替作者改稿。

## Windows 免安装运行

不想配置开发环境时，可从 [Releases](https://github.com/risievol2-alt/writing-assistant/releases/latest) 下载 `windows-x64.zip`：

1. 完整解压 ZIP。
2. 双击 `Start-Inkstone.cmd`。
3. 浏览器自动打开 `http://127.0.0.1:8787`。

便携版已包含 Node.js 运行时，无需安装 Node.js、pnpm 或 SQLite。写作数据保存在解压目录的 `database/writing-assistant.db`，升级前请备份该文件。

## 技术实现

| 层级 | 技术 | 实现方式 |
| --- | --- | --- |
| 前端 | React 19、Vite、Tailwind CSS 4 | 单页应用，响应式侧边栏/底部导航，生产文件由 Express 托管 |
| 后端 | Node.js、Express 5 | REST API，统一提供训练、作品、统计和人物档案能力 |
| 数据库 | SQLite、`node:sqlite` | 零配置本地持久化，启动时自动建表并初始化题库与人物字段 |
| 人物系统 | 动态键值模型 | `Character`、`Character_Field`、`Character_Value`，新增字段无需修改详情页代码 |
| 测试 | Node.js Test Runner | API、统计、动态字段、搜索筛选和工具函数测试 |
| 发布 | PowerShell、GitHub Releases | 白名单构建 Windows x64 便携 ZIP，运行时与源码分离 |

```text
writing-assistant
├── frontend          # React 页面与交互
├── backend           # Express API
├── database          # Schema、题库与人物字段种子
├── docs              # 架构、接口、路线图与截图
├── scripts           # 便携版构建脚本
├── LICENSE
└── README.md
```

## 源码运行

环境要求：Node.js `22.13+`、pnpm `10+`。

```bash
git clone https://github.com/risievol2-alt/writing-assistant.git
cd writing-assistant
pnpm setup
```

开发时打开两个终端：

```bash
# 终端一：后端
pnpm dev:backend

# 终端二：前端
pnpm dev:frontend
```

访问 `http://127.0.0.1:5173`。数据库会自动创建在 `database/writing-assistant.db`。

生产方式运行：

```bash
pnpm build
pnpm --dir backend start
```

访问 `http://127.0.0.1:8787`。

## 测试与便携版构建

```bash
pnpm test
pnpm portable
```

`pnpm portable` 会在 `artifacts/` 生成 Windows x64 ZIP。构建采用文件白名单，不会包含本地数据库、Cookie、`.env` 或测试/扫描结果。

## API 与数据设计

- [API 说明](docs/API.md)
- [架构设计](docs/ARCHITECTURE.md)
- [开发路线图](docs/ROADMAP.md)

人物档案没有把年龄、身高、性格等字段写死在人物主表中：字段定义保存在 `Character_Field`，人物填写内容保存在 `Character_Value`。用户新增“喜欢的武器”等字段后，所有人物档案会自动显示，无需修改前端页面。

## 简历项目描述

> **砚习 · 个人写作训练助手** — 独立完成 React、Express 与 SQLite 全栈应用，实现每日写作训练、自动保存、成长统计及 99 字段动态人物档案系统；设计可扩展的动态字段数据模型，并提供 GitHub Release **Windows 免安装运行**版本。项目地址：https://github.com/risievol2-alt/writing-assistant

## 路线图

- 多小说项目与人物模板导入/导出。
- 世界观规则库、三幕结构和黄金三章分析。
- 人物关系图与时间线。
- AI 评价与编辑助手接口。
- 云同步与多端数据迁移。

## 数据与隐私

- 仓库忽略本地 SQLite 数据库、`.env`、日志、构建目录和依赖目录。
- 便携版仅打包运行所需的白名单文件，不读取或包含浏览器数据。
- 删除 `database/writing-assistant.db` 会清空本地作品和人物；删除或升级前请先备份。

## License

[MIT](LICENSE) © 2026 [risievol2-alt](https://github.com/risievol2-alt)
