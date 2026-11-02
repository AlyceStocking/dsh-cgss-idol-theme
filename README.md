# dsh-cgss-idol-theme

[English](README.en.md) · [展示页](https://alycestocking.github.io/dsh-cgss-idol-theme/)

给 [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/)（DSH）使用的《偶像大师 灰姑娘女孩》多角色主题：**Web 页面主题 + Windows 独立桌宠**。默认角色为佐城雪美，也可搜索姓名或罗马字切换角色。

本仓库在原 `dsh-yukimi-theme` 中合入 `dsh-idol-theme` 后更名而来，保留双方共同历史和多角色开发提交；不再是单独的雪美主题或双角色试验副本。当前包名是 `dsh-cgss-idol-theme`，内部插件条目是 `cgss-idol-theme`。

## 功能与覆盖范围

- **角色目录**：列出 190 位偶像，当前 **188 位可选**。向井拓海、村上巴因采集时返回 HTTP 567 暂列为“待收录”，不是断言其没有素材。另有 8 套缺少配套图标元数据的服装暂被排除。详见[收录报告](research/roster/README.md)与[例外清单](research/roster/coverage.json)。
- **素材目录**：可选角色包含 1,850 套服装、7,400 张小人姿态图与 3,702 张 CGSS 背景的 URL。印象色、签名、Mobamas 卡片、贴纸与过场动画按角色数据提供；并非每位角色都有贴纸或过场动画。
- **角色配色与阅读**：强调色和光晕跟随角色印象色，适配浅色/深色；聊天内容、工具和部分管理页面使用半透明磨砂底板，历史记录上下渐隐，输入卡片独立遮挡滚动内容。
- **小人互动**：拖动、单击翻转并显示台词、双击换装、长按打开角色/服装/背景选择。聚焦后可用 Enter/空格互动、菜单键打开设置、Escape 关闭设置。Windows 桌宠的设置是独立可拖动窗口；页面内面板跟随小人，闲置后收起。
- **装饰与布局**：签名水印、可选 Mobamas 轮播（默认关闭），不额外预留装饰侧栏。宽度小于 1100px 或高度小于 640px 时自动隐藏卡片与签名，小人缩小；沉浸模式另有显示规则。
- **纯背景模式**：点击聊天空白背景或按 Alt+I，临时收起侧栏、标题、输入栏和历史记录；再点背景、向上滚轮或按 Esc 恢复。历史消息与交互控件不是普通背景点击区。
- **沉浸阅读模式**：长按历史区域 650 毫秒或按 Alt+Shift+I，收起侧栏、标题与输入栏但保留可滚动的历史记录；再次长按、再次按快捷键或按 Esc 恢复。
- **台词与问候**：点击优先抽取当前服装的中文台词，再回退到公共台词或占位文本；使用洗牌队列避免一轮内重复。启动按时间问候，切换角色使用“体力已满”场景，每 10 分钟自动说一句。均为文字，**没有语音播放**。

图片从 BWiki CDN 在线加载，需要网络。上述覆盖数字来自仓库中的采集快照和结构检查，并不表示已逐张下载验图或逐角色目视验收。原始服装台词采集数据有 1,876 个服装块、95,544 条文本；其中与可选服装对应的是 1,850 个块，不能把两个统计范围混为一谈。

## Windows 桌宠

独立桌宠仅在 **Windows 的 desktop profile** 启动；普通 Web profile 不启动桌面辅助程序。透明窗口可在 DSH 主窗口最小化或隐藏后继续显示，停用插件或退出 Host 时关闭。桌宠就绪后隐藏页面内小人；启动失败时保留页面内小人。

- 监听运行中或仍有等待请求的主会话，不为子代理单独弹提醒。
- 提醒区区分正常结束、失败、中止、需要回答和需要审批，使用当前角色的场景台词，不再统一使用占位文案。正常结束仅指本轮结束，不表示整个项目已完成。
- 询问和审批保留到请求处理完；结束提醒约显示 5 秒，有等待提醒时排队。新提醒触发一次翻转；气泡显示期间维护置顶而不抢键盘焦点。
- 点击气泡唤起 Harness 并定位会话，不会自动回答或批准请求。
- 支持跨显示器拖动、屏幕边界约束和透明空白区域鼠标穿透。小人位置与设置面板位置独立保存。
- 只预热当前角色的当前服装与下一套，最多 8 张；解码缓存有并发与容量上限。换装等待解码，失败时保留原图；设置窗口不批量预热服装。

桌面偏好保存在 `$DSH_HOME/idol-desktop/preferences.json`，并同步到同一 desktop profile 的页面。普通 Web 页面的偏好只保留在当前页面，刷新会恢复默认值。

Host 与辅助程序通过带随机握手的本机命名管道通信，页面使用 DSH 认证 RPC。保留旧 `/yukimi` RPC 与部分内部命名以兼容现有实现；没有新增 TCP 监听端口。传给桌宠的是会话标识、标题、状态和预设台词，不包含聊天正文。

## 安装

### 从旧包迁移

仓库改名不会自动把已安装的旧包依赖改成新包。请在会话空闲时操作，并先备份桌宠偏好：

1. 在“插件”页停用并移除已安装的 `dsh-yukimi-theme` 或 `dsh-idol-theme`，再安装新包。不要同时启用新旧主题，它们共用部分 RPC、样式和存储实现。
2. `dsh-idol-theme` 的 `idol-desktop` 数据目录继续沿用。原雪美版使用 `yukimi-desktop`；本次改名**不自动搬迁该目录**，请保留原文件作为备份，需要时在新主题重新设置。
3. 安装后确认新包总开关和内部 `cgss-idol-theme` 条目均启用，再完整重启对应的 DSH 服务或桌面应用及 Host。

Web profile 可用官方 CLI 移除实际安装的旧包（没有安装的包不必执行）：

```sh
dsh plugin --profile web remove dsh-yukimi-theme
dsh plugin --profile web remove dsh-idol-theme
```

### Web 主题

```sh
dsh plugin --profile web add github:AlyceStocking/dsh-cgss-idol-theme
```

停止旧 Web 服务，再运行 `dsh web` 并刷新页面。仓库已经提交浏览器 JS 产物，不需要安装时再执行 prepare 构建。为固定版本，可在 GitHub 安装地址后加 `#<提交 SHA>`。

请使用官方插件管理命令或管理页面安装，不要通过手动复制到 node_modules 再手写 patch 代替正式安装。

### Windows 桌宠：从源码构建完整包

需要 Node.js **22.12.0 或以上**、npm，以及能下载 Electron 的网络。当前锁定 Electron 44.5.1，打包目标为 Windows x64。

```powershell
git clone https://github.com/AlyceStocking/dsh-cgss-idol-theme.git
cd dsh-cgss-idol-theme
npm ci
npm run build:characters
npm run build:client
npm run check
npm test
npm run desktop:package
# 先停用旧主题，并在会话空闲时完整退出 DSH；脚本不会替你结束进程。
npm run desktop:install
```

GitHub 源码不包含被 Git 忽略的 Electron 二进制。独立桌宠需先打包生成 `desktop/runtime/win32-x64/CGSS Idol Desktop.exe`；仅从 GitHub 安装源码不能保证有独立桌宠可运行。下载失败时可用 `npm run desktop:package -- --electron-zip-dir <目录>` 指定本地 Electron zip 目录。

安装脚本验证完整运行时，把包含 lib、desktop 和 Electron 的不可变压缩包按内容哈希保存到 `$DSH_HOME/idol-desktop/packages/`，再调用 **DSH Desktop 自带 CLI** 更新 desktop profile。请保留归档供后续依赖重装使用；不修改 Harness 程序文件。仅生成包而不安装：`npm run desktop:install -- --bundle-only`。

更新已有包可能保留原有启停状态。安装成功不等于已经启用；检查包总开关及内部条目。更新 Host 代码后完整退出并重启 DSH Desktop 与 Host，单纯刷新页面或关闭主窗口可能继续使用缓存模块。

## 开发与验证

- 编辑 `lib/client.js` 中非生成区块迭代页面逻辑；素材与角色数据变更后运行 `npm run build:characters` 和 `npm run build:client`。提交生成产物，保证 GitHub 源码安装可加载。
- `npm run check` 检查语法和生成数据同步；`npm test` 检查主题清理、角色切换、台词、桌宠提醒、偏好、加载竞态、窗口边界和包身份契约。
- `npm run desktop:preview` 使用隔离的 `build/preview-data/` 和合成状态，不调用模型、不修改正式偏好。
- `desktop:sync` 仅用于临时开发同步，不能更新 profile 的依赖来源，也不是旧包更名迁移工具。正式安装使用 `desktop:install`；后续包管理器重装可能覆盖临时同步内容。
- 本轮合并通过 120 项自动化测试、Windows 桌宠打包和完整归档校验；**没有在真实 DSH GUI 中安装改名包并重新做现场验收**。历史记录及本轮验证边界见[验证记录](docs/validation.md)。

## 版权与来源

- 本仓库**代码**按 [MIT License](LICENSE) 开源，作者 AlyceStocking。
- 《偶像大师 灰姑娘女孩》的角色、官方美术及原始台词等权利归 Bandai Namco Entertainment / Cygames 等相应权利人所有。本项目为非官方同人主题，不代表官方授权或合作。
- 图片来自 [BWiki imascg](https://wiki.biligame.com/imascg) 的在线 URL，仓库不打包官方图片或音频；但**确实包含采集的中文台词文本、译文及素材元数据**，并将台词嵌入客户端。因此不能声称“不分发任何官方素材”。
- 台词译文与 wiki 内容的权利及使用条件归相应权利人/贡献者，**不因存放于此仓库而纳入代码的 MIT 授权**。请遵守来源站点及权利人的条件；本项目不授予对角色、美术、原文或译文的商用许可。
- 感谢 BWiki imascg 的资料整理、翻译与维护者。素材可用性受来源站点影响，采集与结构检查不保证外链永久有效。
