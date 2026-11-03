# dsh-cgss-idol-theme

[English](README.en.md) · [展示页](https://alycestocking.github.io/dsh-cgss-idol-theme/)

给 [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/)（DSH）使用的《偶像大师 灰姑娘女孩》多角色主题：**Web 页面主题 + Windows 独立桌宠**。默认角色为佐城雪美，也可搜索姓名或罗马字切换角色。

本仓库在原 `dsh-yukimi-theme` 中合入 `dsh-idol-theme` 后更名而来，保留双方共同历史和多角色开发提交；不再是单独的雪美主题或双角色试验副本。当前包名是 `dsh-cgss-idol-theme`，内部插件条目是 `cgss-idol-theme`。

## 功能与覆盖范围

- **偶像查询与收藏（1.3.2）**：Web 面板与 Windows 桌宠均使用单个可搜索下拉框，输入姓名或罗马字即可筛选。点击旁边的五角星收藏当前偶像，已收藏显示橙色实心星；下拉列表为收藏角色加星标并优先排列，组内保持目录顺序。支持方向键、Enter 选择与 Escape 关闭。收藏保存在各自的本地存储中，重开后保留；Web 与桌宠之间不共享收藏。

- **角色目录**：列出 190 位偶像，当前 **188 位可选**。向井拓海、村上巴因采集时返回 HTTP 567 暂列为“待收录”，不是断言其没有素材。另有 8 套缺少配套图标元数据的服装暂被排除。详见[收录报告](research/roster/README.md)与[例外清单](research/roster/coverage.json)。
- **素材目录**：可选角色包含 1,850 套服装、7,400 张小人姿态图与 3,702 张 CGSS 背景的 URL。印象色、签名、Mobamas 卡片、贴纸与过场动画按角色数据提供；并非每位角色都有贴纸或过场动画。
- **角色配色与阅读**：强调色和光晕跟随角色印象色，适配浅色/深色；聊天内容、工具和部分管理页面使用半透明磨砂底板，历史记录上下渐隐，输入卡片独立遮挡滚动内容。
- **小人互动**：拖动、单击翻转并显示台词、双击换装、长按打开角色/服装/背景选择。聚焦后可用 Enter/空格互动、菜单键打开设置、Escape 关闭设置。Windows 桌宠的设置是独立可拖动窗口；页面内面板跟随小人，闲置后收起。
- **装饰与布局**：签名水印、可选 Mobamas 轮播（默认关闭），不额外预留装饰侧栏。宽度小于 1100px 或高度小于 640px 时自动隐藏卡片与签名，小人缩小；沉浸模式另有显示规则。
- **纯背景模式**：点击聊天空白背景或按 Alt+I，临时收起侧栏、标题、输入栏和历史记录；再点背景、向上滚轮或按 Esc 恢复。历史消息与交互控件不是普通背景点击区。
- **沉浸阅读模式**：长按历史区域 650 毫秒或按 Alt+Shift+I，收起侧栏、标题与输入栏但保留可滚动的历史记录；再次长按、再次按快捷键或按 Esc 恢复，退出后还原原布局。移动、滚动、改变文字选区会取消长按；按钮、链接、输入控件及宽表格不触发此长按。
- **台词与问候**：点击优先抽取当前服装的中文译文，再回退到公共台词或 `。。。。。`；每个池使用洗牌队列，一轮抽完才重新洗牌，多条台词时避免新一轮首句紧接上一轮末句重复。启动按本机时间问候（11 点前早晨、11–17 点前午间、17 点起深夜场景），切换角色使用“体力已满”场景。均为文字，**没有语音播放，也不是模型生成的对话**。
- **自动台词的平台差异**：Windows 桌宠每 10 分钟尝试一次，翻转中跳过；30% 使用场景台词（有运行任务时“跑步机互动”，否则“体力已满”），其余为普通台词。Web 小人每 5 秒检查：距离上次自动台词至少 10 分钟且页面最近 30 秒有鼠标/键盘活动时触发；30% 使用“体力已满”，不按任务状态选择跑步机场景。

图片从 BWiki CDN 在线加载，需要网络。上述覆盖数字来自仓库中的采集快照和结构检查，并不表示已逐张下载验图或逐角色目视验收。**当前运行时实际有 1,843 套服装的专属台词池，共 93,863 条文本**；另 7 套（岛村卯月、黑埼千岁、白雪千夜、涩谷凛、久川飒、本田未央、久川凪的第 1 套）回退到公共台词。188 位可选角色各有 19 条公共/场景台词，共 3,572 条（同源数据，不能相加为两份不同语料）；可选角色中 128 位有贴纸引用、149 位有过场动画引用。原始采集数据的 1,876 个服装块、95,544 条台词及视觉素材总量，不等于筛选后的运行时覆盖。历史收录报告中的旧统计应与这些范围区分。

## Windows 桌宠

独立桌宠仅在 **Windows 的 desktop profile** 启动；普通 Web profile 不启动桌面辅助程序。透明窗口可在 DSH 主窗口最小化或隐藏后继续显示，停用插件或退出 Host 时关闭。桌宠就绪后隐藏页面内小人；启动失败时保留页面内小人。

- 监听运行中或仍有等待请求的主会话，不为子代理单独弹提醒。
- 提醒区区分正常结束、失败、中止、需要回答和需要审批，使用当前角色的场景台词，不再统一使用占位文案。正常结束仅指本轮结束，不表示整个项目已完成。
- 询问和审批保留到请求处理完；结束提醒约显示 5 秒，有等待提醒时排队。新提醒触发一次翻转；气泡显示期间维护置顶而不抢键盘焦点。
- 点击气泡唤起 Harness 并定位会话，不会自动回答或批准请求。
- 支持跨显示器拖动、屏幕边界约束和透明空白区域鼠标穿透。小人位置与设置面板位置独立保存。
- 只预热当前角色的当前服装与下一套，最多 8 张；解码缓存有并发与容量上限。换装等待解码，失败时保留原图；设置窗口不批量预热服装。

桌面偏好保存在 `$DSH_HOME/idol-desktop/preferences.json`，并同步到同一 desktop profile 的页面。普通 Web 页面的主题偏好只保留在当前页面，刷新会恢复默认值；偶像收藏单独保存在本地存储中，不随刷新清空。

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

### 轻量 npm 包（1.3.2）

轻量包包含全部 Web 主题与桌宠代码，**不包含 Electron 二进制**。Web 用户无需安装桌宠运行时；Windows x64 桌宠用户需在安装插件后显式安装运行时。没有 `postinstall`，插件启动也不会自动下载 Electron。

- npm 页面：<https://www.npmjs.com/package/dsh-cgss-idol-theme>
- 1.3.2 registry tarball：<https://registry.npmjs.org/dsh-cgss-idol-theme/-/dsh-cgss-idol-theme-1.3.2.tgz>
- **npm 可用版本以页面/registry 为准；若指定版本返回 404，请先使用下方 GitHub 安装方式。** 仓库中的版本号不等于 npm 已发布。

按实际使用的 profile 二选一；desktop 安装使用 **DSH Desktop 自带 CLI**：

```sh
# Web 主题
dsh plugin --profile web add dsh-cgss-idol-theme@1.3.2
# Windows 桌宠（还需下一步安装运行时）
dsh plugin --profile desktop add dsh-cgss-idol-theme@1.3.2
```

### 轻量包：显式安装 Windows 桌宠运行时

在 Windows x64 上使用 Node.js **22.12.0 或以上**及 npm，显式运行：

```powershell
npx --yes --package=dsh-cgss-idol-theme@1.3.2 dsh-cgss-idol-runtime install
npx --yes --package=dsh-cgss-idol-theme@1.3.2 dsh-cgss-idol-runtime status
```

若 Host 使用自定义 `DSH_HOME`，安装和状态检查必须指向同一目录，例如：

```powershell
npx --yes --package=dsh-cgss-idol-theme@1.3.2 dsh-cgss-idol-runtime install --dsh-home "D:\DSHData"
npx --yes --package=dsh-cgss-idol-theme@1.3.2 dsh-cgss-idol-runtime status --dsh-home "D:\DSHData"
```

运行时固定为 Electron **44.5.1 / Windows x64**，保存在 `$DSH_HOME/idol-desktop/runtimes/electron-44.5.1-win32-x64/`（默认 `DSH_HOME` 为 `~/.dsh`），而不是 npx 临时目录。有效的同版本缓存直接复用，不重复下载。当前每次执行 `status`，以及 Host 启动时解析缓存，都会逐文件读取并进行 SHA-256 校验，覆盖整个 Electron 缓存（约几百 MB）；此校验不联网，但每次检查/启动都有磁盘 I/O 成本，并非仅首次验证。安装并用 `status` 确认后，检查插件开关并**完整重启 DSH Desktop 与 Host**；Host 使用固定缓存中的 Electron 运行当前已安装插件的 [desktop/main.cjs](<desktop/main.cjs>)，无需保留 npx 临时目录。

可通过 `--archive` 使用预先下载的[官方 Electron zip](https://github.com/electron/electron/releases/download/v44.5.1/electron-v44.5.1-win32-x64.zip)，离线安装运行时：

```powershell
npx --yes --package=dsh-cgss-idol-theme@1.3.2 dsh-cgss-idol-runtime install --archive "D:\Downloads\electron-v44.5.1-win32-x64.zip" --dsh-home "D:\DSHData"
```

在线下载与 `--archive` 都必须通过相同的固定 SHA-256 校验：`9b382492dcfee91f8f9e92c91f7972550a1b95d2299cac72279dab33a600d7db`，来源为[官方 v44.5.1 SHASUMS256.txt](https://github.com/electron/electron/releases/download/v44.5.1/SHASUMS256.txt)。`--archive` 只免除运行时下载；npx 所需的 npm 包及依赖也必须已缓存，才能在完全离线时执行。

**轻量 npm 下载不等于桌宠总磁盘占用变小**：首次使用桌宠仍需单独下载、解压 Electron。此显式安装与缓存加载流程尚未完成真实 DSH GUI 验收；不能将 CLI 安装成功视为桌宠现场验收通过。npm 尚不可用时先用 GitHub 安装 Web 主题；桌宠可使用下方已发布的 v1.3.0 完整包或源码完整构建流程。

### GitHub 安装 Web 主题（npm 不可用时）

```sh
dsh plugin --profile web add github:AlyceStocking/dsh-cgss-idol-theme
```

停止旧 Web 服务，再运行 `dsh web` 并刷新页面。仓库已经提交浏览器 JS 产物，不需要安装时再执行 prepare 构建。为固定版本，可在 GitHub 安装地址后加 `#<提交 SHA>`。

请使用官方插件管理命令或管理页面安装，不要通过手动复制到 node_modules 再手写 patch 代替正式安装。

### 预构建完整包（Windows 桌宠的独立选择）

[GitHub Release v1.3.0](https://github.com/AlyceStocking/dsh-cgss-idol-theme/releases/tag/v1.3.0) 提供包含 Windows x64 Electron 运行时的完整插件，以及 SHA-256 校验文件。先按上面的迁移步骤移除旧包，再用 **DSH Desktop 自带 CLI** 安装：

```powershell
dsh plugin --profile desktop add "https://github.com/AlyceStocking/dsh-cgss-idol-theme/releases/download/v1.3.0/dsh-cgss-idol-theme-1.3.0.tgz"
```

普通 Web 用户可将 profile 改为 `web`，但此完整包包含较大的 Windows 运行时；不需要桌宠时可使用上面的轻量 npm 包或 GitHub 源码安装。安装后检查插件开关并完整重启对应应用。v1.3.0 完整包继续保留，不被轻量 npm 包覆盖；其中已有运行时，无需另行执行上述运行时安装命令。Release 压缩包是固定版本，不会随 `main` 的后续提交自动变化。

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

GitHub 源码不包含被 Git 忽略的 Electron 二进制。此完整包流程先打包生成 `desktop/runtime/win32-x64/CGSS Idol Desktop.exe`，仍然保留；不要与轻量包的显式运行时安装混为一谈。仅从 GitHub 安装源码不能保证有独立桌宠可运行。下载失败时可用 `npm run desktop:package -- --electron-zip-dir <目录>` 指定本地 Electron zip 目录。

安装脚本验证完整运行时，把包含 lib、desktop 和 Electron 的不可变压缩包按内容哈希保存到 `$DSH_HOME/idol-desktop/packages/`，再调用 **DSH Desktop 自带 CLI** 更新 desktop profile。请保留归档供后续依赖重装使用；不修改 Harness 程序文件。仅生成包而不安装：`npm run desktop:install -- --bundle-only`。

更新已有包可能保留原有启停状态。安装成功不等于已经启用；检查包总开关及内部条目。更新 Host 代码后完整退出并重启 DSH Desktop 与 Host，单纯刷新页面或关闭主窗口可能继续使用缓存模块。

## 开发与验证

- 编辑 `lib/client.js` 中非生成区块迭代页面逻辑；素材与角色数据变更后运行 `npm run build:characters` 和 `npm run build:client`。提交生成产物，保证 GitHub 源码安装可加载。
- `npm run check` 检查语法和生成数据同步；`npm test` 检查主题清理、角色切换、台词、桌宠提醒、偏好、加载竞态、窗口边界和包身份契约。
- `npm run pack:npm` 生成并检查轻量包，拒绝混入 Electron 二进制，并限制压缩包小于 10 MB；完整包仍使用 `desktop:package` 和 `desktop:install -- --bundle-only`。
- `npm run desktop:preview` 使用隔离的 `build/preview-data/` 和合成状态，不调用模型、不修改正式偏好。
- `desktop:sync` 仅用于临时开发同步，不能更新 profile 的依赖来源，也不是旧包更名迁移工具。正式安装使用 `desktop:install`；后续包管理器重装可能覆盖临时同步内容。
- 此前仓库合并通过 120 项测试；1.3.1 轻量分发通过 148 项自动化测试、官方运行时 ZIP 校验、隔离安装及完整包兼容性验证。**没有完成真实 DSH GUI 现场验收**。历史记录及本轮验证边界见[验证记录](docs/validation.md)。

## 版权与来源

- 本仓库**代码**按 [MIT License](LICENSE) 开源，作者 AlyceStocking。
- 《偶像大师 灰姑娘女孩》的角色、官方美术及原始台词等权利归 Bandai Namco Entertainment / Cygames 等相应权利人所有。本项目为非官方同人主题，不代表官方授权或合作。
- 图片来自 [BWiki imascg](https://wiki.biligame.com/imascg) 的在线 URL，仓库不打包官方图片或音频；但**确实包含采集的中文台词文本、译文及素材元数据**，并将台词嵌入[角色注册表](<lib/characters.js>)和[浏览器入口](<lib/client.js>)随插件分发。因此不能声称“不分发任何官方素材”。图片在运行时仍会下载/缓存以显示，远程引用也不等于取得授权。
- 台词译文与 wiki 内容的权利及使用条件归相应权利人/贡献者，**不因存放于此仓库而纳入代码的 MIT 授权**。请遵守来源站点及权利人的条件；本项目不授予对角色、美术、原文或译文的商用许可。
- 本文未确认已取得全部文本的再分发授权。公开发布或再分发前，须核查来源站条款、署名要求及相关权利人的许可；“同人/非商业”说明不自动解决授权问题。
- 感谢 BWiki imascg 的资料整理、翻译与维护者。素材可用性受来源站点影响，采集与结构检查不保证外链永久有效。
