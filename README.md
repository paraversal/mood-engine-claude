# mood-engine-claude

**A Claude Code mod that paints the Claude desktop and mobile apps with your
[mood-engine](https://github.com/paraversal/mood-engine) theme.**

The mod reads the global theme index (`~/.config/themes` and
`~/.local/state/themes/current.json`) with the same reader protocol as every other
mood-engine app. It builds one Claude look from it: the dark half from the theme
selected for dark mode, the light half from the theme selected for light mode. The app
picks the half that matches macOS, so a dark/light flip needs nothing from the mod.

When `mood-engine use THEME` (or anything else) changes `current.json`, `defaults.json`,
`roles.json` or a scheme file, the mod picks it up within about 1.5 seconds and
re-applies the look. Symlinked files from a dotfiles repo are followed.

## Role mapping

| Theme index role | Claude look |
|---|---|
| `bg` | `surface-1`: the conversation pane |
| `bg-inset` / `surface` / `surface-raised` at or below `bg` | `surface-0`: the window behind it |
| `surface` / `surface-raised` above `bg` (dark themes) | `surface-2` / `surface-3`: composer, panels, menus |
| `fg` | `text-primary` |
| `fg-muted` / `fg-subtle` | `text-secondary` / `text-muted`, lifted toward `fg` until they reach 7:1 and 4.5:1 |
| `accent`, `error`, `success`, `warning` | `accent`, `danger`, `success`, `warning` |
| `base0E` | `pro` |
| `success` / `error` / `warning` | git added / removed / modified |

Claude Desktop refuses a whole look if any text is too faint, and many Base24 themes
keep `base02`–`base04` close to the page. So the mod walks down a ladder: first the
theme's own surfaces, then fewer raised surfaces with stronger muted text, then flat
surfaces with body text lifted toward white or black. `/mood` says when a theme needed a
simpler step.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install mood-engine --marketplace paraversal/mood-engine-claude
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every
session, the desktop app's included). From a shell:

```bash
claude plugin install mood-engine --marketplace paraversal/mood-engine-claude
```

In the desktop app, where `/plugin` doesn't run: click + next to the prompt box, then
**Plugins → Add marketplace** with `paraversal/mood-engine-claude`, then **Add plugin**.

To work on it, clone the repository and load the folder directly:

```bash
git clone https://github.com/paraversal/mood-engine-claude.git
claude --plugin-dir /path/to/mood-engine-claude
```

## Use

- `/mood` re-applies the look and shows which dark and light themes it uses.
- `node scripts/check-themes.mts` builds the look for every dark/light pair in your index
  and says whether Desktop would paint it.

## Limits

- The terminal and editor extensions don't draw looks; only the desktop and mobile apps do.
- There is no fade: the app switches looks in one step.
- There is no file watcher in the mod API, so it polls file modification times.
- The wallpaper isn't used as a backdrop yet (a backdrop image must live in the mod's
  folder, at most 1 MiB).

## Development

```bash
claude plugin validate .
claude plugin test .
```

## License

GPL-3.0-only. See [LICENSE](LICENSE).

`hooks/make-colors.js` and `hooks/make-colors.d.ts` are copied unchanged from Claude
Code's mod tooling (its plugin-authoring skill) and are not covered by this licence.
