# 写实小兔子桌宠 · Windows v2.0.0

Windows x64 独立桌宠，采用 hatch-pet 制作的透明动画图集。无需安装 Node.js 或 DSH，下载便携版 EXE 即可运行。

**[下载 Windows v2.0.0](https://github.com/zdjmrq/rabbit-desktop-pet/releases/tag/v2.0.0)**

## 这版和最初版有什么区别？

| 版本 | 平台与定位 | 外观与动画 |
| --- | --- | --- |
| v1.0.0 | 最初的 Windows 便携版 | 原始兔子图片与互动实现 |
| v1.1.0 | 历史 Apple Silicon macOS 版 | 原版系列，见对应历史发布 |
| **v2.0.0（当前）** | **Windows x64 动画更新版** | **无草帽、透明逐帧动画图集、安静模式、较低自主活动频率、拖拽边界修正** |

主分支从此维护 Windows v2 系列；历史 v1.x 标签及 Release 保留用于辨认原版。v2.0.0 不提供 macOS 包，也不包含试验性的分层骨骼动画。这次发布采用回退后确认的图集版本。

## 下载与运行

1. 下载 `RabbitDesktopPet-2.0.0-portable.exe`，放在固定目录并双击。
2. 如果正在运行旧版，先从托盘退出，再启动新版。
3. 下载页同时提供 `SHA256SUMS.txt`，可用 PowerShell `Get-FileHash .\RabbitDesktopPet-2.0.0-portable.exe -Algorithm SHA256` 核对文件。

程序未进行商业代码签名；Windows 可能显示来源确认提示。只从本仓库 Release 下载。便携版无需安装；启用开机启动后请不要移动 EXE。

## 操作

- 左键长按兔子：抚摸；右键短按：菜单；右键长按：拎起移动。
- 菜单包含喂食、睡眠、跳跃、转身、梳毛、观察和安静模式。
- 左键长按胡萝卜可拖动，兔子会追过去吃。
- 普通模式每 35–60 秒检查自主行为，约一半检查不触发动作；安静模式停止自主活动，睡眠几乎静止。
- 拎起到屏幕上边缘时停止继续上移；松手后平滑落下。
- 托盘可显示/隐藏、重新加载、设置鼠标穿透、开机启动和退出。
- `Ctrl + Alt + R` 快速显示/隐藏。

## 动画与性能说明

使用 Canvas 2D、独立帧缓存、静止画面复用和合成层位移，移除了旧 Three.js 依赖。梳毛单次约 3.2 秒，动作之间保留较长休息。

渲染跟随显示器刷新率；本机 120 Hz 环境测试刷新周期中位数约 8.3 ms。但原画每个动作只有 5–8 张，**120 Hz 刷新不等于每秒 120 张独立动作原画**，仍可能看到逐帧感。此版不是 3D 模型或连续骨骼动画。

## 开发与打包

Windows、Node.js 22+、npm：

```powershell
npm ci
npm start
npm run check
npm run smoke -- --interaction-test --capture-test
npm run dist
```

`npm run dist` 输出 `release/RabbitDesktopPet-2.0.0-portable.exe`。打包复用 `npm ci` 安装的 Electron，避免重复下载运行时。`release/`、`dist/`、`node_modules/` 不进入 Git；成品在 GitHub Releases 下载。

## 工程

- `src/`：状态、交互和图集渲染。
- `main.cjs`、`preload.cjs`：透明窗口、托盘、鼠标穿透。
- `assets/rabbit-atlas.webp`、`assets/rabbit-extra.webp`：正式动画图集。
- `scripts/runtime-check.cjs`：拖拽、动作、刷新周期和安静模式回归检查。
- `assets/` 中保留正式运行素材；临时美术制作目录与测试输出不进入发布源码。
- `CHANGELOG.md`：版本变化与发布边界。

源自 [rabbit-desktop-pet](https://github.com/zdjmrq/rabbit-desktop-pet)，沿用 MIT 许可。原始图片、手部和胡萝卜素材保留；动画素材由 hatch-pet/imagegen 制作。
