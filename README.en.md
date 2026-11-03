# dsh-cgss-idol-theme

[中文说明](README.md) · [Showcase](https://alycestocking.github.io/dsh-cgss-idol-theme/)

A multi-character **Web theme and Windows desktop companion** for [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/), featuring idols from THE IDOLM@STER Cinderella Girls. Yukimi Sajo is the default character; search by name or romanization to choose another idol.

This is the original `dsh-yukimi-theme` repository with `dsh-idol-theme` integrated and the repository renamed. Shared history and the multi-character development commits are preserved. It is no longer a Yukimi-only theme or a separate two-character trial. The package is `dsh-cgss-idol-theme`; its internal plugin entry is `cgss-idol-theme`.

## Features and coverage

- **Companion startup fix (1.3.3):** Fixes valid standalone runtimes being reported as missing inside the DSH Electron Host. Physical runtime verification uses Electron `original-fs`, preserving hash and path checks without changing global ASAR behavior. Existing valid Electron 44.5.1 caches can be reused; fully restart the Host after updating.

- **Idol search and favorites (1.3.2):** Both Web and Windows settings use one searchable dropdown. Filter by name or romanization, and use the five-point star beside it to favorite the current idol. Favorites have an orange filled star, are marked in the dropdown, and appear first while preserving catalog order within each group. Arrow keys, Enter and Escape are supported. Favorites persist in local storage for each surface; Web and desktop favorites are not shared.

- **190 listed idols, 188 selectable.** Takumi Mukai and Tomoe Murakami remain disabled because the metadata collection returned HTTP 567, not because they are known to lack assets. Eight outfits without matching icon metadata are also excluded. See the [roster report](research/roster/README.md) and [coverage exceptions](research/roster/coverage.json).
- **Asset catalog:** 1,850 selectable outfits, 7,400 petit poses and 3,702 CGSS background URLs. Character colors, signatures, Mobamas cards, stickers and transition animations are used where available; not every idol has a sticker or animation.
- **Character styling:** impression-color accents and glows, light/dark adaptation, translucent frosted reading surfaces, fading history edges and a separate composer surface.
- **Pet interaction:** drag, single-click to flip and show text, double-click to change outfits, or long-press for character/outfit/background settings. Enter/Space interact, the menu key opens settings, and Escape closes them. Desktop settings use a separate draggable window; the in-page panel follows the pet and closes after inactivity.
- **Decorations:** signature watermarks and optional Mobamas card rotation (off by default), without reserving an extra sidebar. Below 1100px width or 640px height, cards/signatures hide and the pet shrinks. Immersive modes have separate visibility rules.
- **Background-only mode:** click empty chat background or press Alt+I to hide sidebars, title, composer and history temporarily. Click the background again, scroll upward or press Esc to restore. History messages and interactive controls are not ordinary background-click targets.
- **Immersive reading:** long-press history for 650ms or press Alt+Shift+I to retain scrollable history while hiding sidebars, title and composer. Repeat the gesture/shortcut or press Esc to restore the previous layout. Movement, scrolling and changes to the text selection cancel the hold; buttons, links, inputs and wide tables do not trigger it.
- **Dialogue:** taps use the current outfit's Chinese translated lines first, then common lines, then `。。。。。`. Each pool uses a shuffled queue; after a cycle is exhausted it reshuffles, avoiding a repeated boundary line when multiple lines exist. Startup greetings use local time (morning before 11:00, noon from 11:00 to before 17:00, night from 17:00); switching characters uses the stamina-full scene. **Text only: no voice playback or model-generated conversation.**
- **Automatic dialogue differs by platform:** Windows tries every ten minutes and skips while flipping; 30% of attempts use a scene (treadmill while a task is running, otherwise stamina-full), with ordinary dialogue otherwise. Web checks every five seconds and triggers only after at least ten minutes and mouse/keyboard activity within the last 30 seconds; 30% use stamina-full, without task-dependent treadmill selection.

Images load online from the BWiki CDN and require connectivity. These counts describe the checked-in metadata snapshot, not a download/visual audit of every image or idol. **The runtime actually contains 1,843 outfit-specific dialogue pools with 93,863 lines.** Seven outfits (outfit 1 for Uzuki Shimamura, Chitose Kurosaki, Chiyo Shirayuki, Rin Shibuya, Hayate Hisakawa, Mio Honda and Nagi Hisakawa) fall back to common dialogue. Each of the 188 selectable idols has 19 common/scene lines, totaling 3,572 (the same source data, not two distinct corpora to add together). Among selectable idols, 128 have sticker references and 149 have transition-animation references. The raw collection of 1,876 outfit blocks, 95,544 lines and its visual-asset totals is not the filtered runtime coverage; distinguish these scopes when consulting historical reports.

## Windows companion

The separate companion starts only in the **desktop profile on Windows**; an ordinary Web profile does not launch it. The transparent window remains when the main DSH window is minimized or hidden, and closes when the plugin is disabled or the Host exits. The in-page pet hides only after the companion is ready; it remains available if startup fails.

- Monitors live root sessions and outstanding requests; child agents do not get separate notices.
- Distinguishes turn completion, failure, cancellation, questions and approvals using labels and the selected idol's scene dialogue, rather than a uniform placeholder. Turn completion does not mean the entire project is complete.
- Questions/approvals remain until settled. Terminal notices last about five seconds and queue behind outstanding requests. Each new notice triggers one flip; visible notices maintain topmost positioning without taking keyboard focus.
- Clicking a bubble opens the corresponding Harness session; it does not answer or approve anything.
- Supports multi-monitor dragging, screen bounds and click-through transparent regions. Pet and settings-window positions are saved separately.
- Warms only the current and next outfit for the current idol (up to eight poses), with bounded decoding concurrency/cache size. Outfit changes wait for decoding; failure preserves the current image. The settings window does not batch-preload outfits.

Desktop preferences live at `$DSH_HOME/idol-desktop/preferences.json` and sync to pages in the same desktop profile. Ordinary Web theme preferences live only in the current page and reset on refresh; idol favorites are stored separately in local storage and survive refreshes.

Host/helper communication uses a local named pipe with a random handshake; pages use authenticated DSH RPC. The legacy `/yukimi` RPC and some internal names remain for compatibility. No additional TCP listener is opened. The helper receives session identifiers, titles, status and preset lines—not chat message bodies.

## Installation

### Migrating from the old packages

Renaming the GitHub repository does not automatically rename existing profile dependencies. Work while sessions are idle and back up your companion preferences first.

1. Disable and remove any installed `dsh-yukimi-theme` or `dsh-idol-theme` through the Plugins page before installing the new package. Do not enable old and new themes together: they share parts of the RPC, CSS and storage implementation.
2. Existing `dsh-idol-theme` preferences under `idol-desktop` continue to be used. The older Yukimi-only package used `yukimi-desktop`; this rename **does not automatically migrate that directory**. Keep it as a backup and reconfigure the new theme if needed.
3. Check both the new package switch and its internal `cgss-idol-theme` entry, then fully restart the corresponding DSH service or desktop application and Host.

For a Web profile, remove only the old packages actually installed:

~~~sh
dsh plugin --profile web remove dsh-yukimi-theme
dsh plugin --profile web remove dsh-idol-theme
~~~

### Lightweight npm package (1.3.3)

The lightweight package contains all Web theme and companion code, **but no Electron binaries**. Web users do not need the companion runtime; Windows x64 companion users must install it explicitly after installing the plugin. There is no `postinstall`, and plugin startup never downloads Electron automatically.

- npm page: <https://www.npmjs.com/package/dsh-cgss-idol-theme>
- 1.3.3 registry tarball: <https://registry.npmjs.org/dsh-cgss-idol-theme/-/dsh-cgss-idol-theme-1.3.3.tgz>
- **Check the npm page/registry for published versions. If the specified version returns 404, use the GitHub installation below first.** A version in the repository does not by itself prove npm publication.

Choose the profile you actually use; for desktop installation, use **DSH Desktop's own CLI**:

~~~sh
# Web theme
dsh plugin --profile web add dsh-cgss-idol-theme@1.3.3
# Windows companion (also requires the runtime step below)
dsh plugin --profile desktop add dsh-cgss-idol-theme@1.3.3
~~~

### Lightweight package: explicitly install the Windows companion runtime

On Windows x64, with Node.js **22.12.0 or newer** and npm, explicitly run:

~~~powershell
npx --yes --package=dsh-cgss-idol-theme@1.3.3 dsh-cgss-idol-runtime install
npx --yes --package=dsh-cgss-idol-theme@1.3.3 dsh-cgss-idol-runtime status
~~~

If the Host uses a custom `DSH_HOME`, installation and status checks must target the same directory, for example:

~~~powershell
npx --yes --package=dsh-cgss-idol-theme@1.3.3 dsh-cgss-idol-runtime install --dsh-home "D:\DSHData"
npx --yes --package=dsh-cgss-idol-theme@1.3.3 dsh-cgss-idol-runtime status --dsh-home "D:\DSHData"
~~~

The runtime is pinned to Electron **44.5.1 / Windows x64**, stored under `$DSH_HOME/idol-desktop/runtimes/electron-44.5.1-win32-x64/` (`DSH_HOME` defaults to `~/.dsh`), not an npx temporary directory. A valid cache of the same version is reused without downloading again. Currently, every `status` check and every Host startup that resolves the cache reads and SHA-256-verifies each file across the entire Electron cache (roughly several hundred MB). This verification is offline, but incurs disk I/O on every check/startup, not just the first validation. After installation and verification with `status`, check activation switches and **fully restart DSH Desktop and its Host**. The Host uses Electron from this fixed cache to run [desktop/main.cjs](<desktop/main.cjs>) from the currently installed plugin; retaining an npx temporary directory is unnecessary.

Use `--archive` with a previously downloaded [official Electron zip](https://github.com/electron/electron/releases/download/v44.5.1/electron-v44.5.1-win32-x64.zip) for offline runtime installation:

~~~powershell
npx --yes --package=dsh-cgss-idol-theme@1.3.3 dsh-cgss-idol-runtime install --archive "D:\Downloads\electron-v44.5.1-win32-x64.zip" --dsh-home "D:\DSHData"
~~~

Online downloads and `--archive` must both pass the same pinned SHA-256 check: `9b382492dcfee91f8f9e92c91f7972550a1b95d2299cac72279dab33a600d7db`, from the [official v44.5.1 SHASUMS256.txt](https://github.com/electron/electron/releases/download/v44.5.1/SHASUMS256.txt). `--archive` only avoids downloading the runtime; the npm package and dependencies needed by npx must also be cached to run fully offline.

**A smaller npm download does not mean a smaller total companion disk footprint**: first use still requires a separate Electron download and extraction. Version 1.3.3 has launched the companion to `BRIDGE_READY` and shut it down cleanly under the actual DSH Electron executable using isolated preferences. Live user-session GUI interactions have not been exhaustively tested; CLI `Ready` alone is not companion startup acceptance. While npm is unavailable, use GitHub for the Web theme, or the published v1.3.0 complete package/source-build workflow below for the companion.

### GitHub Web theme installation (when npm is unavailable)

~~~sh
dsh plugin --profile web add github:AlyceStocking/dsh-cgss-idol-theme
~~~

Stop the old Web service, start `dsh web`, then refresh the page. Built browser JavaScript is committed, so no install-time prepare build is required. Append `#<commit SHA>` to the GitHub specification to pin a revision.

Use official plugin management rather than copying into node_modules and adding manual patch rows.

### Prebuilt complete package (an alternative for the Windows companion)

[GitHub Release v1.3.0](https://github.com/AlyceStocking/dsh-cgss-idol-theme/releases/tag/v1.3.0) provides the complete plugin with the Windows x64 Electron runtime and a SHA-256 checksum file. Remove old packages as described above, then install using **DSH Desktop's own CLI**:

```powershell
dsh plugin --profile desktop add "https://github.com/AlyceStocking/dsh-cgss-idol-theme/releases/download/v1.3.0/dsh-cgss-idol-theme-1.3.0.tgz"
```

Web users may replace the profile with `web`, but the complete archive includes the large Windows runtime. Prefer the lightweight npm package or GitHub source installation above if you only need the Web theme. Check activation switches and fully restart the relevant application. The v1.3.0 complete package remains available and is not overwritten by the lightweight npm package; its bundled runtime needs no separate runtime-install command. A Release archive is a pinned version; later `main` commits do not change its contents.

### Build a complete Windows desktop package

Requires Node.js **22.12.0 or newer**, npm, and access to Electron downloads. Electron is pinned to 44.5.1; the packaging target is Windows x64.

~~~powershell
git clone https://github.com/AlyceStocking/dsh-cgss-idol-theme.git
cd dsh-cgss-idol-theme
npm ci
npm run build:characters
npm run build:client
npm run check
npm test
npm run desktop:package
# Disable old themes and fully quit DSH while sessions are idle.
# The installer does not terminate running processes.
npm run desktop:install
~~~

Git sources do not include the ignored Electron binaries. This complete-package workflow still builds `desktop/runtime/win32-x64/CGSS Idol Desktop.exe` first and remains available; do not confuse it with the lightweight package's explicit runtime installation. Installing GitHub sources alone does not guarantee a runnable standalone companion. If downloads fail, use `npm run desktop:package -- --electron-zip-dir <directory>` with a local Electron zip directory.

The installer verifies the complete runtime, stores an immutable content-addressed archive containing lib, desktop and Electron under `$DSH_HOME/idol-desktop/packages/`, then invokes **DSH Desktop's own CLI** to update the desktop profile. Keep that archive for dependency reinstalls. Harness program files are not modified. To create an archive without installation: `npm run desktop:install -- --bundle-only`.

Updating an existing package can preserve disabled switches. Successful installation does not imply activation: check both package and internal entry switches. Fully restart DSH Desktop and its Host after Host-code updates; refreshing a page or closing only the main window can retain cached modules.

## Development and validation

- Edit non-generated sections of [the client](lib/client.js) for page logic. After asset/catalog changes, run `npm run build:characters` and `npm run build:client`, and commit generated output for GitHub installs.
- `npm run check` validates syntax and generated-data freshness. `npm test` covers cleanup, character switching, dialogue, notices, preferences, image-loading races, window bounds and package identity.
- `npm run pack:npm` builds and checks the lightweight archive, rejecting bundled Electron binaries and archives of 10 MB or larger. Full distributions still use `desktop:package` and `desktop:install -- --bundle-only`.
- `npm run desktop:preview` uses synthetic state and isolated `build/preview-data/`; it does not call a model or alter production preferences.
- `desktop:sync` is only a temporary development copy, not a dependency-source update or an old-package rename migration. Prefer `desktop:install` for managed installation; dependency reinstalls may overwrite temporary copies.
- The earlier repository merge passed 120 tests. The 1.3.1 lightweight distribution passed 148 automated tests, official runtime ZIP validation, isolated installation and full-package compatibility checks. **Live DSH GUI acceptance has not been completed.** See [validation records](docs/validation.md) for historical evidence and current boundaries.

## Rights and sources

- **Code** is by AlyceStocking and licensed under the [MIT License](LICENSE).
- Character, official artwork and original dialogue rights belong to Bandai Namco Entertainment / Cygames and the relevant rights holders. This is an unofficial fan theme, not an official endorsement or license.
- Images are referenced online from [BWiki imascg](https://wiki.biligame.com/imascg); official image/audio binaries are not bundled. However, the repository **does contain collected Chinese dialogue/translation text and asset metadata**, and dialogue is embedded in the distributed [character registry](<lib/characters.js>) and [browser entry](<lib/client.js>). It would be inaccurate to claim that no official content is redistributed at all. Images are still downloaded/cached at runtime; remote referencing does not establish permission.
- Wiki/translation content remains subject to its contributors' and rights holders' terms; placing it here does **not** make it part of the code's MIT grant. This project grants no commercial rights to characters, artwork, original dialogue or translations.
- This document does not establish that all text redistribution permissions have been obtained. Before publication or redistribution, verify source terms, attribution requirements and rights-holder permissions; fan/noncommercial use does not automatically resolve licensing.
- Thanks to BWiki imascg's editors, translators and maintainers. External asset availability depends on the source site; metadata checks do not guarantee permanent URLs.
