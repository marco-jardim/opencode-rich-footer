# opencode-rich-footer

TUI plugin for [opencode](https://opencode.ai) that renders a rich footer below the message scrollback when you are inside a subagent session. Shows:

- Subagent label and sibling position (e.g. `Fast (2 of 3)`)
- Turn elapsed time
- Live tokens-per-second (TPS) — instantaneous while streaming, moving-average after idle
- Turn token counts (`↑input ↓output`, with cache hit count if any)
- Session cache hit rate
- Context usage `🧠tokens/limit (pct%)`
- Total session cost
- Clickable Parent / Prev / Next buttons with keyboard shortcuts

## Requirements

This plugin needs a fork of opencode that exposes the `session_footer` TUI slot. The plugin will not render anything against upstream `sst/opencode` until/unless that slot is upstreamed.

If you are using [marco-jardim/opencode](https://github.com/marco-jardim/opencode) v1.15.x or newer, the slot is available.

## Install

Add to your `opencode.jsonc`:

```jsonc
{
  "plugin": ["opencode-rich-footer"]
}
```

Or install from source for development:

```bash
git clone https://github.com/marco-jardim/opencode-rich-footer
cd opencode-rich-footer
bun install
```

Then point your opencode config to the local path:

```jsonc
{
  "plugin": ["file:../opencode-rich-footer"]
}
```

## How it works

Registers a TUI slot plugin that targets `session_footer`. The slot is rendered by opencode inside the session route, between the message scrollbox and the prompt input, only when `session.parentID` is set (i.e. you are inside a subagent session).

Mouse clicks on Parent/Prev/Next dispatch `session.parent`, `session.child.previous`, and `session.child.next` via `api.keymap.dispatchCommand`, matching the keyboard shortcuts shown.

## License

MIT
