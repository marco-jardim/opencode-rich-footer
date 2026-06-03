# opencode-rich-footer

A TUI plugin for [opencode](https://opencode.ai) that renders a rich status footer below the message scrollback while you are inside a **subagent session**. It surfaces live, at-a-glance metrics for the delegated turn — timing, throughput, token usage, cache efficiency, context pressure, and cost — plus quick navigation between the parent and sibling subagents.

```
Fast (2 of 3)   ⏱ 4.2s   ⚡ 78 tps   ↑12.4k ↓2.1k (cache 9.8k)   ◆ 91% hit   🧠 41.2k/200k (21%)   $0.0143        ⟵ Parent   ‹ Prev   Next ›
```

> The footer only appears inside subagent sessions (sessions with a `parentID`). In a normal top-level session it renders nothing.

## Features

The footer is split into a metrics panel (left) and a navigation panel (right).

**Metrics**

- **Subagent label and sibling position** — e.g. `Fast (2 of 3)`. The label is derived from the session title (`@fast subagent` → `Fast`); the position reflects this subagent's place among its siblings under the same parent, in the same order the Prev/Next buttons cycle.
- **Turn elapsed time** — wall-clock time for the in-progress (or most recent) turn.
- **Tokens per second (TPS)** — instantaneous while the model is streaming, switching to a moving average once the turn goes idle.
- **Turn token counts** — `↑input ↓output`, with the cache-hit token count appended when present.
- **Session cache hit rate** — cache-read tokens as a share of cacheable input across the session.
- **Context usage** — `🧠 tokens / limit (pct%)` for the current context window.
- **Total session cost** — accumulated USD cost across the session.

**Navigation**

- Clickable **Parent / Prev / Next** controls that jump to the parent session or cycle through sibling subagents.
- Each control mirrors opencode's own keybindings for `session.parent`, `session.child.previous`, and `session.child.next`.

## Requirements

This plugin renders through a `session_footer` TUI slot that is **not** part of upstream `sst/opencode`. You need an opencode build that exposes it:

- [marco-jardim/opencode](https://github.com/marco-jardim/opencode) **v1.15.x or newer** provides the `session_footer` slot.
- The **sibling position** (`(2 of 3)`) additionally requires the host's `api.state.session.children(parentID)` accessor. On hosts that expose the slot but not `children()`, the footer still renders — it just omits the position counter (the plugin feature-detects and degrades gracefully).

Against an upstream build without the slot, the plugin loads but renders nothing.

## Install

Add the plugin to your `opencode.jsonc`:

```jsonc
{
  "plugin": ["opencode-rich-footer"]
}
```

### Local / development install

Clone alongside your opencode checkout and install dependencies:

```bash
git clone https://github.com/marco-jardim/opencode-rich-footer
cd opencode-rich-footer
bun install
```

Then point your opencode config at the local path:

```jsonc
{
  "plugin": ["file:../opencode-rich-footer"]
}
```

There is no build step — opencode loads `src/index.tsx` directly.

## How it works

The plugin registers a TUI slot plugin targeting `session_footer`. opencode mounts that slot inside the session route, between the message scrollbox and the prompt input. The plugin gates its own rendering on `session.parentID`, so content only appears for subagent sessions.

Data is pulled reactively from the plugin API (`api.state.session.*`): messages and token usage for the active turn, session status, and — for the sibling position — `api.state.session.children(parentID)`, which returns the subagent's siblings sorted to match the navigation order. Because these reads happen inside Solid memos, the metrics and the `(x of N)` counter update live as the turn streams and as sibling subagents start or finish.

Clicking **Parent / Prev / Next** dispatches `session.parent`, `session.child.previous`, and `session.child.next` via `api.keymap.dispatchCommand`, matching the keyboard shortcuts shown.

## Compatibility

- Requires a host exposing the `session_footer` slot (see [Requirements](#requirements)).
- Sibling position requires `api.state.session.children()`; absent that, the rest of the footer still works.
- Loaded as TSX at runtime; no compiled output is published.

## Troubleshooting

**The footer doesn't show up.**

- You must be **inside a subagent session** (one with a `parentID`). Navigate into a child session — the footer never renders for top-level sessions.
- Your opencode build must expose the `session_footer` slot. Upstream `sst/opencode` does not.
- The plugin must load successfully. File-based (`file:`) installs require the plugin to export an `id` (this package does); a load failure leaves the slot unregistered and the footer silently absent.

**The `(x of N)` position is missing but everything else works.**

- Your host predates the `api.state.session.children()` accessor. Update to a build that includes it.

## License

[MIT](./LICENSE.md) © Marco Jardim
