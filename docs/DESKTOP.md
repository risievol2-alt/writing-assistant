# Tauri 桌面版

## 架构

桌面版没有重写现有 Express API。Tauri 负责窗口、应用生命周期和安装包；内置 Node.js 负责启动 Express，Express 继续提供 React 生产文件、REST API 和 `node:sqlite` 数据访问。

正式版启动顺序：

1. Tauri 选择一个空闲的 `127.0.0.1` 端口。
2. 从安装资源启动内置 Node.js，并传入端口与应用数据目录。
3. 等待 Express 端口就绪。
4. 创建只允许访问该本地端口的 WebView2 窗口。
5. 窗口销毁时终止后端子进程。

## 本地数据

正式桌面版使用 Tauri 的 app data 目录：

```text
%APPDATA%\com.risievol2.inkstone\writing-assistant.db
%APPDATA%\com.risievol2.inkstone\backend.log
```

安装包只包含 `schema.sql` 与两份种子 JSON，不包含开发数据库。首次运行会自动建表和初始化默认题库、人物字段；升级安装不会覆盖 app data。

## 开发与构建

先安装 Tauri Windows 前置依赖：Rust stable MSVC、Microsoft C++ Build Tools、WebView2，以及项目要求的 Node.js 和 pnpm。

```bash
pnpm setup
pnpm test
pnpm desktop:dev
pnpm desktop:build
```

`desktop:build` 会依次：

1. 构建 `frontend/dist`。
2. 在 `src-tauri/resources` 暂存 Node、后端、生产依赖、前端和数据库初始化文件。
3. 编译 Rust 桌面壳。
4. 生成 Windows x64 NSIS `setup.exe`。

暂存资源和 Rust `target` 均受 Git 忽略。

## CI 与 GitHub Release

发布前同步修改 `package.json` 版本。`src-tauri/tauri.conf.json` 直接读取该版本。

| 触发方式 | 测试 | Windows 构建 | 签名 | 发布 |
| --- | --- | --- | --- | --- |
| 普通分支 push / Pull Request | 是 | 是 | 否 | 不发布 |
| `vX.Y.Z-beta` / `vX.Y.Z-beta.N` | 是 | 是 | 允许 unsigned | GitHub Pre-release |
| `vX.Y.Z` | 是 | 是 | 必须 Signed | 正式 GitHub Release |

当前 Beta 版本示例：

```bash
git tag v0.3.1-beta
git push origin v0.3.1-beta
```

标签必须与 `package.json` 完全一致。只有 `-beta` 或 `-beta.N` 后缀允许 unsigned Pre-release；其他预发布后缀会被拒绝。没有预发布后缀的版本全部按照正式签名策略处理，因此 `v1.0.0` 缺少有效证书时不会发布。

### Windows 代码签名

正式 Release 工作流要求仓库配置以下 GitHub Actions Secrets；Beta 通道不读取这些 Secret：

| Secret | 内容 |
| --- | --- |
| `WINDOWS_CERTIFICATE` | 含私钥的代码签名 `.pfx` 文件经过 Base64 编码后的完整文本 |
| `WINDOWS_CERTIFICATE_PASSWORD` | 导出 `.pfx` 时设置的密码 |

可在 PowerShell 中生成 Base64 文件：

```powershell
$pfx = Resolve-Path .\certificate.pfx
[Convert]::ToBase64String([IO.File]::ReadAllBytes($pfx)) |
  Set-Content -NoNewline .\certificate.pfx.base64
```

然后在 GitHub 仓库的 `Settings → Secrets and variables → Actions` 中添加两个 Secret。证书必须是包含私钥且未过期的 Windows 代码签名证书，普通 SSL 证书不能使用。

发布正式版本时，工作流会：

1. 在临时目录解码 PFX 并导入当前用户证书库。
2. 将证书指纹通过临时 Tauri 覆盖配置传入构建，不把证书或指纹写进仓库。
3. 使用 SHA-256 与 RFC 3161 时间戳签署应用程序和 NSIS 安装包。
4. 以草稿形式创建 Release，并验证两个 `.exe` 的 Authenticode 状态。
5. 只有签名状态均为 `Valid` 才公开 Release，最后从 Runner 证书库移除证书。

任一 Secret 缺失、PFX 无私钥、证书尚未生效、证书过期或签名验证失败都会终止正式发布。Base64 只是一种文本编码，真正的保护来自 GitHub Actions Secrets；不要把 `.pfx`、私钥或 Base64 文件提交到 Git。
