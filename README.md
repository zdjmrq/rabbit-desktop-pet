# 写实小兔子桌宠（Windows / macOS）

这是 DSH 写实小兔子插件的独立桌面版，不需要安装 DSH。支持 Windows x64 与 Apple Silicon Mac。

如果你在使用 DeepSeek Harness，也可以安装对应的 [DSH 小兔子插件](https://github.com/zdjmrq/dsh-rabbit-pet)。

## 使用

1. 双击 `RabbitDesktopPet-1.0.0-portable.exe`。
2. 左键长按兔子可抚摸；右键短按打开菜单；右键长按可拎起移动。
3. 左键长按胡萝卜可移动，兔子会追过去吃。
4. 右键点击任务栏通知区域里的兔子图标，可重新加载、设置开机启动或退出。
5. 托盘中分别保留了“显示小兔子”和“隐藏小兔子”；随时按 `Ctrl + Alt + R` 或双击托盘图标也可快速切换显示状态。
6. 取消托盘中的“允许鼠标与小兔子互动”，可让左右键完全穿透桌宠；重新勾选即可恢复互动。

程序未进行商业代码签名，Windows 首次运行可能显示 SmartScreen 提示。确认文件来源后，可选择“更多信息 → 仍要运行”。

## 分享

将便携版 EXE 放进 ZIP 后发送即可。接收后解压并双击运行，不需要 Node.js、Blender、DSH 或其他运行库。

也可以直接从本项目的 [Releases](https://github.com/zdjmrq/rabbit-desktop-pet/releases) 下载最新版。

## macOS Apple Silicon

下载名称包含 `mac-arm64` 的 ZIP，解压后将“写实小兔子桌宠.app”拖入“应用程序”并运行。适用于 M1、M2、M3、M4 及后续 Apple Silicon 芯片。

第一版暂未使用 Apple Developer 证书签名。首次启动时，请在 Finder 中右键应用并选择“打开”，再确认运行。快捷隐藏/显示为 `Command + Option + R`；其余互动方式与 Windows 版一致。

macOS 成品由 GitHub Actions 的 macOS Runner 构建，本地 Windows 环境不需要安装 Xcode。
