# ZCode Account Switcher / ZCode 账号切换器

> 🔗 **广告**：[sharellm.net](https://sharellm.net/dashboard/shared) — AI 模型共享平台，海量模型一键体验

[English](#english) · [中文](#中文)

![Version](https://img.shields.io/badge/version-1.0.2-blue) ![License](https://img.shields.io/badge/license-MIT-green)

给 [ZCode](https://zcode.z.ai) 桌面端加上「多账号一键切换」功能：登录过的账号（z.ai / BigModel）保存为本地 Profile，之后点一下即可切换账号并自动重启 ZCode，无需重新输入密码或扫码。头像菜单、设置侧边栏、模型设置页三处入口。

Give the [ZCode](https://zcode.z.ai) desktop app one-click multi-account switching: accounts you have logged in (z.ai / BigModel) are snapshotted locally, and switching is one click + auto restart — no re-login, no QR scan. Entries in the avatar menu, settings sidebar, and model settings page.

---

## 📌 版本对应表 / Version Matrix

**打补丁前请先核对你的 ZCode 版本！**

| 补丁版本 | 适配 ZCode 版本 | 状态 | 主要变化 |
|---|---|---|---|
| **v1.0.2（最新）** | **3.10.1 / 3.10.2** | ✅ 当前维护版本 | **修复切换不完整**：套餐/额度状态（config builtin token、providerFamily、套餐缓存）随账号一并切换 |
| v1.0.1 | 3.10.1 / 3.10.2 | ✅ | 模型设置页「切换账号」按钮 + 广告横幅；广告可见性修复；`/api/diag` 诊断 |
| v1.0.0 | 3.10.1 | ✅ | 首个版本：多账号切换、备注、渠道徽章、三处入口 |

> ⚠️ 本项目是**社区第三方补丁**，通过修改 ZCode 的 `app.asar`（主进程 + 渲染层注入）实现，**与 ZCode 官方无关**。使用前请阅读 [DISCLAIMER.md](DISCLAIMER.md)，仅在你自己拥有并有权使用的账号之间切换。
>
> ⚠️ This is a **community third-party patch**. It works by modifying ZCode's `app.asar` (main process + renderer injection) and is **not affiliated with ZCode**. Read [DISCLAIMER.md](DISCLAIMER.md) before use, and only switch between accounts you own.
>
> **ZCode 是闭源应用且更新频繁**——每次官方更新都可能让补丁失效。若你的 ZCode 版本不在上表中，请勿直接打补丁；可以提 Issue 告知你的版本号，我会评估适配。

---

<a name="english"></a>
## English

### Features

- 🔁 **One-click account switching**: each logged-in account is saved as a local profile (encrypted credential snapshot); switching writes it back and auto-restarts ZCode
- 👥 **Profile management**: add current account, delete, per-account **custom remark**, provider badge (**z.ai / BigModel**)
- 🧭 **Three entries**: bottom-left avatar menu, settings sidebar, model settings page
- 🔐 Supports both **z.ai OAuth** and **BigModel** login (different user-info schemas are auto-detected)
- ✨ **Model settings page**: a「切换账号」button and a sharellm.net banner ad, self-healing every 1.5s
- 🩺 `/api/diag` diagnostics channel — the renderer reports scan results to the local service for remote debugging
- 💾 All data stays local: `~/.zcode/account-profiles/profiles.json` + ZCode's own `~/.zcode/v2/credentials.json`. Nothing is uploaded.

### Install

**Prerequisites**: Windows 10/11, Python 3, Node.js (`npx`).

1. **Fully quit ZCode** (right-click the tray icon → Quit, not just closing the window)
2. Edit `patch-account-switcher.bat` — set `ASAR_PATH` to your ZCode install path (`...\resources\app.asar`)
3. Double-click `patch-account-switcher.bat`, wait for `[SUCCESS]`
4. Reopen ZCode → log in account A → avatar menu →「切换账号」→「添加当前账号」; repeat for account B; then switch with one click

### Uninstall

1. Quit ZCode
2. Double-click `unpatch-account-switcher.bat`
3. Restores `app.asar.acctbak` (created automatically on first patch) — removes this patch only, keeps other injections (e.g. zcode-skin-manager)

### Coexistence with other patches

`patch-account-switcher.bat` extracts from the **current** `app.asar` (not an old backup) and re-injects idempotently, so it preserves other patches such as [zcode-skin-manager](https://github.com/Adam1290-0/zcode-skin-manager) — and vice versa. Any order, any number of runs.

### Files

```
├── patch-account-switcher.bat         # one-click patch (extract → inject → repack)
├── unpatch-account-switcher.bat       # one-click restore (account patch only)
├── inject-account-switcher.py         # injection helper (called by patch.bat)
├── zcode-account-switcher-main.mjs    # main-process module (local service + relaunch)
└── ui_accounts.js                     # renderer UI injected into ZCode
```

### FAQ

**Q: The switcher disappears after ZCode auto-updates?**
A: Updates overwrite `app.asar`. Re-run `patch-account-switcher.bat` (the first run of each ZCode version creates a fresh backup). If ZCode jumped several versions, check the [Version Matrix](#-版本对应表--version-matrix) first.

**Q: Why does switching require a restart?**
A: The login token is cached in memory after startup; there is no hot-reload API. `app.relaunch()` makes the restart a few seconds — you never re-enter credentials.

**Q: Is my account data safe?**
A: Profiles live in `~/.zcode/account-profiles/` on your machine only. The local service binds `127.0.0.1` and is reachable from your PC alone. Still, review the source before use.

**Q: Conversation history is shared?**
A: Yes — only the login state switches; history and settings are global (isolating them would mean swapping a 600 MB+ database).

### How it works

ZCode stores all login credentials in `~/.zcode/v2/credentials.json` (AES-256-GCM with a key derived from the machine environment). This tool injects:

1. **Main process** (`out/main/index.js`, ESM): a dynamically imported module that serves `127.0.0.1:27890` — profile CRUD, credential swap (atomic write), and `app.relaunch()` + `app.exit()` for restart.
2. **Renderer** (`out/renderer/index.html`): an inline script that anchors UI elements to stable runtime signatures — the avatar menu's Radix DropdownMenu items (forceMounted, found by text「断开连接」/「Disconnect」), the settings nav (`aria-label`), and the model settings description. A 1.5s self-healing scan re-attaches elements that React reconciliation removes.

---

<a name="中文"></a>
## 中文

### 功能

- 🔁 **一键切换账号**：每个登录过的账号保存为本地 Profile（加密凭据快照），切换 = 回写凭据 + 自动重启 ZCode
- 👥 **账号管理**：添加当前账号、删除、每账号**自定义备注**、渠道徽章（**z.ai / BigModel**）
- 🧭 **三处入口**：左下角头像菜单、设置窗口侧边栏、模型设置页
- 🔐 同时支持 **z.ai OAuth** 与 **BigModel** 登录体系（user_info 结构不同，自动识别）
- ✨ **模型设置页**：「切换账号」按钮 + sharellm.net 广告横幅，每 1.5 秒自愈挂载
- 🩺 `/api/diag` 诊断通道：渲染层把扫描结果上报给本地服务，可远程排障
- 💾 数据全部本地化：`~/.zcode/account-profiles/profiles.json` + ZCode 自身的 `~/.zcode/v2/credentials.json`，不上传任何数据

### 安装

**前置条件**：Windows 10/11、Python 3、Node.js（`npx`）。

1. **完全退出 ZCode**（右键系统托盘图标 → 退出，不是关窗口）
2. 编辑 `patch-account-switcher.bat`，把 `ASAR_PATH` 改成你的 ZCode 安装路径（`...\resources\app.asar`）
3. 双击 `patch-account-switcher.bat`，等待出现 `[SUCCESS]`
4. 重新打开 ZCode → 登录账号 A → 头像菜单 →「切换账号」→「添加当前账号」；换登账号 B 重复一次；之后即可一键切换

### 卸载

1. 退出 ZCode
2. 双击 `unpatch-account-switcher.bat`
3. 恢复 `app.asar.acctbak`（首次打补丁时自动备份）——只移除本补丁，保留其他注入（如 zcode-skin-manager）

### 与其他注入补丁共存

`patch-account-switcher.bat` 从**当前** `app.asar` 解包（不是老备份）且注入幂等——重打会自动替换旧注入、保留其他补丁（如 [zcode-skin-manager](https://github.com/Adam1290-0/zcode-skin-manager)）的修改，两个补丁可以任意顺序反复打，互不覆盖。

### 使用说明

| 你想做什么 | 怎么做 |
|---|---|
| 添加账号 | 登录该账号 → 头像菜单 →「切换账号」→「添加当前账号」 |
| 切换账号 | 面板中点选目标账号 →「切换并重启」 |
| 加备注 | 账号行点 ✎，回车或失焦保存 |
| 删除账号 | 选中后点「删除」（两段式确认，防误删） |
| 模型设置页快速切换 | 直接点页面头部的「切换账号」按钮 |

### 文件说明

```
├── patch-account-switcher.bat         # 一键打补丁（解包 → 注入 → 重打包）
├── unpatch-account-switcher.bat       # 一键还原（仅本补丁）
├── inject-account-switcher.py         # 注入辅助脚本（patch.bat 调用）
├── zcode-account-switcher-main.mjs    # 注入主进程的模块（本地服务 + 重启）
└── ui_accounts.js                     # 注入到 ZCode 渲染层的 UI 脚本
```

### 常见问题

**Q：ZCode 自动更新后切换器没了？**
A：更新会覆盖 `app.asar`，重新双击 `patch-account-switcher.bat` 即可（Profile 数据在 `~/.zcode/account-profiles/`，不会丢）。若 ZCode 跨了多个版本，先对照上方[版本对应表](#-版本对应表--version-matrix)确认。

**Q：为什么切换要重启？**
A：登录态在启动后缓存在内存里，没有热切换接口；`app.relaunch()` 重启只要几秒，且全程不需要重新输密码/扫码。

**Q：账号数据安全吗？**
A：Profile 只存本机 `~/.zcode/account-profiles/`；本地服务只绑定 `127.0.0.1`，仅本机可访问。当然，使用前请自行审查源码。

**Q：对话历史会隔离吗？**
A：不会——只切换登录态，历史与设置是全局共享的（隔离需要换 600MB+ 的会话数据库，成本过高）。

### 原理

ZCode 的全部登录凭据存放在 `~/.zcode/v2/credentials.json`（AES-256-GCM 加密，密钥由本机环境推导）。本工具注入：

1. **主进程**（`out/main/index.js`，ESM）：动态 import 的模块，监听 `127.0.0.1:27890`——Profile 增删改查、凭据原子回写、`app.relaunch()` + `app.exit()` 重启。
2. **渲染层**（`out/renderer/index.html`）：内联脚本把 UI 挂到稳定的运行时特征上——头像菜单的 Radix DropdownMenu 菜单项（forceMount 常驻，按「断开连接」/「Disconnect」文本定位）、设置侧边栏（`aria-label`）、模型设置页描述文本；1.5 秒自愈扫描补回被 React 重渲染移除的元素。

---

### 更新日志 / Changelog

### v1.0.2

- 🐛 **重大修复：账号切换不完整**——除 `credentials.json` 外，登录态还散落在 `config.json`（`builtin:*` 供应商的 apiKey，拉套餐/额度用的真 token）、`setting.json`（`providerFamilyDomain` 等渠道域字段）和 `coding-plan-cache.json`（套餐状态缓存）。此前切换只回写了凭据，导致模型设置页仍显示上一账号的套餐/赠送额度，重启也无效
- 📦 「添加当前账号」现在会同时快照上述三处登录衍生状态；切换时按账号完整恢复
- 🧠 `config.json` 只替换 `builtin:*` 条目，用户自定义供应商（SHARELLM/KIMI 等）不受影响；`setting.json` 只补丁渠道域字段，其余设置保留
- 🕐 旧版本创建的 Profile 没有 aux 快照：面板会显示「旧快照」标记——登录该账号后重新「添加当前账号」即可升级；降级路径下切换至少会清掉套餐缓存强制刷新
- ✅ 合成环境全链路测试：跨渠道切换（bigmodel↔zai）config/setting/缓存三处全部正确恢复，自定义供应商与无关设置零改动

### v1.0.1

- 🆕 模型设置页新增「切换账号」按钮与 sharellm.net 广告横幅
- 🐛 修复广告不可见：从头部 flex 行移出，独占一行全宽横幅（诊断通道定位：广告一直在 DOM 里，被挤在行尾不可见）
- ✨ 广告醒目化：渐变蓝紫底 + 亮蓝边框 + 加粗亮色文字，面板底部广告同步提亮
- 🩺 新增 `/api/diag` 诊断通道：渲染层扫描结果上报，可远程排障
- 🔧 描述定位改为元素无关（不依赖 `<p>` 标签）；`<style>` 改为原位热更新
- 🆙 验证适配 ZCode 3.10.2（主进程/渲染层/全部文本锚点未变，隔离注入通过）

### v1.0.0

- 首个版本：多账号切换、本地 Profile、备注、渠道徽章、三处入口、z.ai/BigModel 双体系支持

## License

[MIT](LICENSE)
