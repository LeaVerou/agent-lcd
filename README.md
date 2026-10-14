# agent-lcd

Find the lowest common denominator of coding agents: run one prompt through **Codex**, **Antigravity CLI** and **Claude Code** with their weakest models and nothing else: no tools, no memory, no plugins, no MCP servers, no web search. Get a single Markdown report comparing what each one produced.

Useful for testing prompts, skills and instructions against the worst case, not the best.

## Install

```sh
npm install -g @openai/codex @anthropic-ai/claude-code
brew install --cask antigravity-cli   # or: curl -fsSL https://antigravity.google/cli/install.sh | bash
npm install -g agent-lcd              # or: git clone … && npm link
```

Each CLI must be signed in once, interactively:

- `codex login`
- `agy` → sign in with Google. If the Antigravity IDE is installed and signed in, the CLI reuses its credentials.
- `claude` → follow the login prompt

## Usage

```sh
agent-lcd "Explain CSS nesting in one paragraph"
agent-lcd -i prompt.md
agent-lcd                                   # uses ./prompt.md if present
cat prompt.md | agent-lcd -o report.md
agent-lcd -a codex,claude -i prompt.md     # subset of agents
agent-lcd -o - "…"                          # report to stdout
```

| Flag | |
|---|---|
| `-i, --input <path>` | Read the prompt from a file |
| `-o, --output <path>` | Report path, `-` for stdout. `{timestamp}` → local date and time. An existing file is never overwritten: the new report gets a `-2`, `-3`… suffix |
| `-f, --force` | Overwrite an existing report instead |
| `-c, --config <path>` | Config file. Default: `./agent-lcd.config.js` if present |
| `-a, --agents <list>` | Comma-separated subset of `claude`, `codex`, `antigravity`. Overrides agents set to `false` in config |
| `-d, --debug` | Include each agent's exact command in the report, with the prompt replaced by `"$PROMPT"` |

Exit code is 1 if any agent failed, 2 on usage errors. Progress goes to stderr.

### Frontmatter

A prompt file (via `-i`, stdin or `./prompt.md`) may start with YAML frontmatter. It takes the same keys as the config file and overrides it for that prompt; CLI flags still win.

```md
---
wrap: "Answer in under 100 words.\n\n{prompt}"
output: reports/cards.md
agents:
  codex: { model: gpt-5.6-luna }
  antigravity: false
---
Write modern HTML and CSS for a set of profile cards…
```

## Config

`agent-lcd.config.js` (also `.mjs` or `.json`) in the working directory, or `-c path`. Every key is optional. Precedence, lowest first: defaults, config file, prompt frontmatter, CLI flags.

```js
export default {
	// Template the prompt is inserted into; `{prompt}` is replaced. May be a function.
	wrap: "Answer tersely.\n\n{prompt}",

	// Seconds before an agent run is killed
	timeout: 600,

	// Report path. `{timestamp}` → local date and time
	output: "reports/{timestamp}.md",

	// Per-agent overrides. `false` skips an agent. `args` are appended to the CLI command verbatim.
	agents: {
		claude: { model: "haiku", effort: "low" },
		codex: { model: "gpt-5.6-luna", effort: "low", args: ["-c", "model_verbosity=\"low\""] },
		antigravity: false,
	},
};
```

### Defaults

| Agent | Model | Effort | Notes |
|---|---|---|---|
| `claude` | `haiku` | `low` | Alias resolves to the latest Haiku |
| `codex` | `gpt-6-luna` | `low` | Smallest model a ChatGPT-authenticated Codex accepts. The mini/nano tiers need an API key. |
| `antigravity` | `gemini-3.8-flash-low` | — | Weakest entry in `agy models`; effort is part of the slug |

## What exactly runs

Every agent runs headless in a fresh empty temp directory, so no project-level `CLAUDE.md`, `AGENTS.md` or `GEMINI.md` is picked up. Gemini CLI is not included: Google retired it for personal accounts in favour of Antigravity CLI. On top of that:

**Claude Code**
`claude -p --tools "" --setting-sources "" --strict-mcp-config --disable-slash-commands --no-session-persistence`
No built-in tools, no settings or `CLAUDE.md` from any scope (so no hooks or plugins either), no MCP servers, no skills.

**Codex**
`codex exec --ephemeral --ignore-user-config --ignore-rules -s read-only` plus config overrides: `web_search="disabled"`, `project_doc_max_bytes=0`, `skills.max_context_tokens=1` (drops Codex's bundled skills from the prompt), `personality="none"`, `approval_policy="never"`, and `features.<x>=false` for every tool-bearing feature flag (`shell_tool`, `multi_agent`, `plugins`, `skill_search`, `view_image`, `apps`, `memories`, …). Skills in `~/.agents/skills` and `~/.codex/skills` have no off switch, so the process gets an empty `HOME` and `CODEX_HOME` inside the temp directory with only `~/.codex/auth.json` symlinked in.

**Antigravity CLI**
`agy -p … --agent lcd --output-format json --disable-slash-commands` with a custom agent written to `.agents/agents/lcd.md` in the temp directory: `tools: []` (empty allowlist) and `inheritCustomizations: false` (no rules, skills, plugins, `GEMINI.md` or `AGENTS.md`). User-level MCP servers have no off switch, so the process gets an empty `HOME` inside the temp directory, with `~/Library/Keychains` symlinked in so the cached Google sign-in still works. The default system prompt is kept. Known gap: `agy` always exposes its `manage_task` tool ([#1015](https://github.com/google-antigravity/antigravity-cli/issues/1015)).

## Report

```md
# Agent LCD
| Agent | Model | Effort | Time | Tokens (in / out) | Status |
…
## Prompt
## Claude Code
## Codex
## Antigravity CLI
```

Responses are included verbatim, with their headings demoted so they nest under the agent's section. If `wrap` changed the prompt, the wrapped version is included in a disclosure. With `--debug`, each agent section ends with a *Command* disclosure holding the exact command that was run.

### Example

Prompt:

> Write modern HTML and CSS (and if needed, JS) for a textarea that grows as the user types. Browser support target is Baseline 2026.

<details>
<summary>Report</summary>

````md
# Agent LCD

2026-10-14 13:37 UTC

| Agent | Model | Effort | Time | Tokens (in / out) | Status |
| --- | --- | --- | --- | --- | --- |
| Claude Code | `claude-haiku-4-5-20251001` | low | 10.9s | 7444 / 1244 | ✅ |
| Codex | `gpt-6-luna` | low | 10.1s | 24561 / 369 | ✅ |
| Antigravity CLI | `gemini-3.8-flash-low` | — | 10.4s | 2122 / 559 | ✅ |

## Prompt

```md

Write modern HTML and CSS (and if needed, JS) for a textarea that grows as the user types. Browser support target is Baseline 2026.
```

## Claude Code

I'll create a modern textarea that grows with content using the `field-sizing` CSS property, which is the cleanest approach for Baseline 2026.

<write>
<path>/private/var/folders/ln/4hh32w2n66qg6_9mpgk5dsn40000gn/T/agent-lcd-9RbiMK/growing-textarea.html</parameter>
<content><!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Growing Textarea</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      width: 100%;
      max-width: 600px;
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    h1 {
      margin-bottom: 24px;
      color: #333;
      font-size: 24px;
    }

    label {
      display: block;
      margin-bottom: 8px;
      color: #666;
      font-weight: 500;
      font-size: 14px;
    }

    textarea {
      width: 100%;
      padding: 12px;
      font-family: inherit;
      font-size: 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      resize: none;
      field-sizing: content;
      min-height: 80px;
      max-height: 400px;
      overflow-y: auto;
      transition: border-color 0.2s;
      line-height: 1.5;
    }

    textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .hint {
      margin-top: 8px;
      font-size: 13px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Growing Textarea</h1>
    <label for="message">Type something:</label>
    <textarea
      id="message"
      placeholder="Start typing... The textarea will grow automatically as you add more content."
    ></textarea>
    <p class="hint">Uses CSS field-sizing: content for automatic height adjustment</p>
  </div>
</body>
</html>
</content>
</invoke>

This uses **`field-sizing: content`**, a modern CSS property that makes textarea (and input) elements automatically resize to fit their content. Key features:

- **No JavaScript needed** — purely CSS-based
- **Min/max heights** — constrained with `min-height: 80px` and `max-height: 400px`
- **Smooth scrolling** — `overflow-y: auto` lets it scroll if it hits the max height
- **Baseline 2026 compatible** — `field-sizing` is widely supported across all modern browsers
- **Focus styling** — includes a subtle focus ring for accessibility
- **Single-line input** — uses `resize: none` to prevent manual resizing

Open the file in a browser and start typing — the textarea will grow line by line as you add content, then scroll once it reaches 400px.

## Codex

I’ll check the available project files and existing conventions, then provide a self-contained implementation suited to Baseline 2026 browsers.

A CSS-only approach uses a grid-backed `contenteditable` element, but it isn’t a native textarea and needs extra work for accessibility, forms, and keyboard behavior. For a real `<textarea>`, a small JS handler is the dependable option:

```html
<label for="message">Message</label>
<textarea id="message" name="message" rows="1"></textarea>

<script>
  const textarea = document.querySelector("#message");

  function resize() {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  textarea.addEventListener("input", resize);
  window.addEventListener("resize", resize);
  resize(); // Also sizes prefilled content.
</script>

<style>
  textarea {
    box-sizing: border-box;
    display: block;
    width: 100%;
    min-height: 2.5em;
    padding: 0.6em 0.75em;
    font: inherit;
    line-height: 1.4;
    resize: none;
    overflow-y: hidden;
  }
</style>
```

`scrollHeight` includes the content and padding, so `box-sizing: border-box` keeps the assigned height consistent with the textarea’s box. If you want to cap its growth, add a `max-height` and change `overflow-y` to `auto`.

## Antigravity CLI

For **Baseline 2026**, this requires **zero JavaScript**. 

CSS Form-Control Sizing (`field-sizing: content`) is a standard native feature supported across all major browsers (Chrome/Edge 123+, Firefox 135+, Safari 18.2+).

##### Pure HTML & CSS Implementation

```html
<label for="auto-expand" class="input-label">Your message</label>
<textarea 
  id="auto-expand" 
  name="message" 
  class="auto-expand" 
  rows="1" 
  placeholder="Type your message..."></textarea>
```

```css
.auto-expand {
  /* The modern standard: sizes the textarea based on its contents */
  field-sizing: content;

  /* Constrain bounds */
  min-height: 2.5rem;
  max-height: 20rem;
  width: 100%;
  max-width: 600px;

  /* Typography & box sizing */
  box-sizing: border-box;
  padding: 0.625rem 0.875rem;
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.5;

  /* Disable manual resize cursor handles if desired */
  resize: none;

  /* Standard styling */
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  outline: none;
  overflow-y: auto; /* Adds a scrollbar only when reaching max-height */
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.auto-expand:focus-visible {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
}
```

##### Key Highlights
- **`field-sizing: content`**: Automatically adjusts both row and column sizing to match the typed text.
- **`max-height` + `overflow-y: auto`**: Prevents the field from expanding endlessly off-screen by smoothly falling back to a scrollbar once it reaches the maximum limit.
- **`rows="1"` / `min-height`**: Establishes the clean initial single-line state while retaining textarea multi-line capabilities.

````

</details>

## Caveats

- Antigravity receives the prompt on the command line, so it is capped by `ARG_MAX` (about 1 MB on macOS). Codex and Claude read it from stdin.
- The Antigravity keychain trick is macOS-only. On Linux `agy` stores its token in `~/.gemini/antigravity-cli/`; copy that file in via `files` if you need it there.
- Codex has no documented switch to disable *all* tools; the feature flags above remove everything it currently exposes. Re-check `codex features list` after Codex updates.
- Model availability depends on how each CLI is authenticated. Codex with a ChatGPT account rejects `gpt-*-mini`/`-nano` models.
