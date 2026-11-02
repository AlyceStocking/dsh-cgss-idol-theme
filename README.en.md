# dsh-cgss-idol-theme

[中文说明](README.md) · [Showcase](https://alycestocking.github.io/dsh-cgss-idol-theme/)

A multi-character **Web theme and Windows desktop companion** for [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/), featuring idols from THE IDOLM@STER Cinderella Girls. Yukimi Sajo is the default character; search by name or romanization to choose another idol.

This is the original `dsh-yukimi-theme` repository with `dsh-idol-theme` integrated and the repository renamed. Shared history and the multi-character development commits are preserved. It is no longer a Yukimi-only theme or a separate two-character trial. The package is `dsh-cgss-idol-theme`; its internal plugin entry is `cgss-idol-theme`.

## Features and coverage

- **190 listed idols, 188 selectable.** Takumi Mukai and Tomoe Murakami remain disabled because the metadata collection returned HTTP 567, not because they are known to lack assets. Eight outfits without matching icon metadata are also excluded. See the [roster report](research/roster/README.md) and [coverage exceptions](research/roster/coverage.json).
- **Asset catalog:** 1,850 selectable outfits, 7,400 petit poses and 3,702 CGSS background URLs. Character colors, signatures, Mobamas cards, stickers and transition animations are used where available; not every idol has a sticker or animation.
- **Character styling:** impression-color accents and glows, light/dark adaptation, translucent frosted reading surfaces, fading history edges and a separate composer surface.
- **Pet interaction:** drag, single-click to flip and show text, double-click to change outfits, or long-press for character/outfit/background settings. Enter/Space interact, the menu key opens settings, and Escape closes them. Desktop settings use a separate draggable window; the in-page panel follows the pet and closes after inactivity.
- **Decorations:** signature watermarks and optional Mobamas card rotation (off by default), without reserving an extra sidebar. Below 1100px width or 640px height, cards/signatures hide and the pet shrinks. Immersive modes have separate visibility rules.
- **Background-only mode:** click empty chat background or press Alt+I to hide sidebars, title, composer and history temporarily. Click the background again, scroll upward or press Esc to restore. History messages and interactive controls are not ordinary background-click targets.
- **Immersive reading:** long-press history for 650ms or press Alt+Shift+I to retain scrollable history while hiding sidebars, title and composer. Repeat the gesture/shortcut or press Esc to restore.
- **Dialogue:** taps use the current outfit's Chinese translated lines first, then common lines or placeholder text. A shuffled queue avoids repeats within a cycle. Time-based startup greetings, character-switch greetings and an automatic line every ten minutes are included. **Text only; no voice playback.**

Images load online from the BWiki CDN and require connectivity. These counts describe the checked-in metadata snapshot, not a download/visual audit of every image or idol. The raw outfit-dialogue collection contains 1,876 outfit blocks and 95,544 lines; 1,850 blocks correspond to selectable outfits. These are different counting scopes.

## Windows companion

The separate companion starts only in the **desktop profile on Windows**; an ordinary Web profile does not launch it. The transparent window remains when the main DSH window is minimized or hidden, and closes when the plugin is disabled or the Host exits. The in-page pet hides only after the companion is ready; it remains available if startup fails.

- Monitors live root sessions and outstanding requests; child agents do not get separate notices.
- Distinguishes turn completion, failure, cancellation, questions and approvals using labels and the selected idol's scene dialogue, rather than a uniform placeholder. Turn completion does not mean the entire project is complete.
- Questions/approvals remain until settled. Terminal notices last about five seconds and queue behind outstanding requests. Each new notice triggers one flip; visible notices maintain topmost positioning without taking keyboard focus.
- Clicking a bubble opens the corresponding Harness session; it does not answer or approve anything.
- Supports multi-monitor dragging, screen bounds and click-through transparent regions. Pet and settings-window positions are saved separately.
- Warms only the current and next outfit for the current idol (up to eight poses), with bounded decoding concurrency/cache size. Outfit changes wait for decoding; failure preserves the current image. The settings window does not batch-preload outfits.

Desktop preferences live at `$DSH_HOME/idol-desktop/preferences.json` and sync to pages in the same desktop profile. Ordinary Web preferences live only in the current page and reset on refresh.

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

### Web theme

~~~sh
dsh plugin --profile web add github:AlyceStocking/dsh-cgss-idol-theme
~~~

Stop the old Web service, start `dsh web`, then refresh the page. Built browser JavaScript is committed, so no install-time prepare build is required. Append `#<commit SHA>` to the GitHub specification to pin a revision.

Use official plugin management rather than copying into node_modules and adding manual patch rows.

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

Git sources do not include the ignored Electron binaries. Build `desktop/runtime/win32-x64/CGSS Idol Desktop.exe` first; installing GitHub sources alone does not guarantee a runnable standalone companion. If downloads fail, use `npm run desktop:package -- --electron-zip-dir <directory>` with a local Electron zip directory.

The installer verifies the complete runtime, stores an immutable content-addressed archive containing lib, desktop and Electron under `$DSH_HOME/idol-desktop/packages/`, then invokes **DSH Desktop's own CLI** to update the desktop profile. Keep that archive for dependency reinstalls. Harness program files are not modified. To create an archive without installation: `npm run desktop:install -- --bundle-only`.

Updating an existing package can preserve disabled switches. Successful installation does not imply activation: check both package and internal entry switches. Fully restart DSH Desktop and its Host after Host-code updates; refreshing a page or closing only the main window can retain cached modules.

## Development and validation

- Edit non-generated sections of [the client](lib/client.js) for page logic. After asset/catalog changes, run `npm run build:characters` and `npm run build:client`, and commit generated output for GitHub installs.
- `npm run check` validates syntax and generated-data freshness. `npm test` covers cleanup, character switching, dialogue, notices, preferences, image-loading races, window bounds and package identity.
- `npm run desktop:preview` uses synthetic state and isolated `build/preview-data/`; it does not call a model or alter production preferences.
- `desktop:sync` is only a temporary development copy, not a dependency-source update or an old-package rename migration. Prefer `desktop:install` for managed installation; dependency reinstalls may overwrite temporary copies.
- This integration passed 120 automated tests, Windows packaging and full-archive validation. **The renamed package was not installed and revalidated in a live DSH GUI during this merge.** See [validation records](docs/validation.md) for historical evidence and current boundaries.

## Rights and sources

- **Code** is by AlyceStocking and licensed under the [MIT License](LICENSE).
- Character, official artwork and original dialogue rights belong to Bandai Namco Entertainment / Cygames and the relevant rights holders. This is an unofficial fan theme, not an official endorsement or license.
- Images are referenced online from [BWiki imascg](https://wiki.biligame.com/imascg); official image/audio binaries are not bundled. However, the repository **does contain collected Chinese dialogue/translation text and asset metadata**, and dialogue is embedded in the client. It would be inaccurate to claim that no official content is redistributed at all.
- Wiki/translation content remains subject to its contributors' and rights holders' terms; placing it here does **not** make it part of the code's MIT grant. This project grants no commercial rights to characters, artwork, original dialogue or translations.
- Thanks to BWiki imascg's editors, translators and maintainers. External asset availability depends on the source site; metadata checks do not guarantee permanent URLs.
