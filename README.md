# ZCode Account Switcher

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

ZCode 桌面端多账号一键切换工具：登录过的账号（z.ai / BigModel 等）保存为本地 Profile，之后点一下即可切换账号并自动重启 ZCode，无需重新输入密码或扫码。

> 🌐 **AI 模型共享，尽在 [sharellm.net](https://sharellm.net)** —— 海量模型按需共享，欢迎访问。

> ⚠️ **风险警告**：本工具通过解包/重打包 `app.asar` 修改 ZCode 客户端，可能违反其服务条款并导致账号受限。请先阅读 [DISCLAIMER.md](DISCLAIMER.md)，仅在你自己的账号上使用。

## 为什么存在

ZCode 的登录态只允许同时保留一个账号。有多个订阅账号（个人、团队、BigModel 等）需要切换时，每次都要退出登录、重新扫码/输密码。本工具把每个账号的登录态"快照"到本地，切换 = 点一下 + 自动重启。

## 工作原理

1. **登录态单点存储**：ZCode 的全部登录凭据在 `~/.zcode/v2/credentials.json`（AES-256-GCM 加密，密钥可由本机环境推导）。
2. **主进程注入**：在 ZCode 主进程（`out/main/index.js`，ESM）注入一个模块，监听 `127.0.0.1:27890`，负责凭据读写、Profile 管理和 `app.relaunch()` 重启。
3. **渲染层注入**：在 `out/renderer/index.html` 注入 UI 脚本：
   - 左下角头像菜单增加「切换账号」项；
   - 设置窗口侧边栏增加「账号切换」入口；
   - 切换面板支持：添加当前账号、删除、备注编辑、渠道徽章（z.ai / BigModel）。
4. **数据本地化**：Profile 存于 `~/.zcode/account-profiles/profiles.json`（含加密凭据快照与备注），不上传任何数据。

## 快速上手

### 前置条件

- Windows 10/11
- 已安装 [ZCode](https://www.zcode.com/) 桌面版
- [Node.js](https://nodejs.org/)（`npx` 可用）+ Python 3

### 步骤

1. 克隆本仓库；
2. 关闭 ZCode；
3. 编辑 `patch-account-switcher.bat`，把 `ASAR_PATH` 改为你的 ZCode 安装目录下的 `resources\app.asar` 路径；
4. 双击运行 `patch-account-switcher.bat`（解包 + 注入 + 重打包，约 4-5 分钟，首次会自动备份 `app.asar.acctbak`）；
5. 打开 ZCode：
   - 登录账号 A → 头像菜单 →「切换账号」→「添加当前账号」；
   - 断开连接，登录账号 B → 同样「添加当前账号」；
   - 之后在面板中点击任意账号 →「切换并重启」即可，无需再次登录。

### 还原

关闭 ZCode 后双击 `unpatch-account-switcher.bat`（恢复 `app.asar.acctbak`，删除本补丁、保留皮肤等其他注入）。

### 与皮肤插件共存

若同时使用 [zcode-skin-manager](https://github.com/Adam1290-0/zcode-skin-manager)：两个补丁脚本均已改为**从当前 `app.asar` 解包**，互相保留对方的注入，任意顺序、任意次数重跑都不冲突。也可用 `patch-combined.bat` 一次打两个补丁（需把皮肤仓库 clone 到本仓库同级目录）。

## 配置

| 项 | 位置 | 说明 |
|---|---|---|
| `ASAR_PATH` | 三个 `.bat` 文件顶部 | ZCode 安装目录下的 `resources\app.asar` |
| `PORT` | `zcode-account-switcher-main.mjs` + `ui_accounts.js` | 本地服务端口，默认 `27890`，仅绑定 `127.0.0.1` |
| 广告位 | `ui_accounts.js` 中搜 `sharellm` | 面板底部与模型设置页各一处，不需要可删除 |

## 安全与隐私

- 所有操作仅在本机进行，凭据与 Profile 不离开本机。
- 请勿把 `profiles.json` / `credentials.json` 提交到任何仓库（`.gitignore` 已排除）。

## 已知限制

- 切换账号后必须重启 ZCode（登录态缓存在内存中，无热切换接口）。
- ZCode 升级会覆盖 `app.asar`，需重新执行补丁；内部结构变化可能导致脚本失效。
- 对话历史全局共享，不按账号隔离。

## License

[MIT](LICENSE) © Adam1290-0
