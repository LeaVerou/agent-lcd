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
agent-lcd -f prompt.md
agent-lcd                                   # uses ./prompt.md if present
cat prompt.md | agent-lcd -o report.md
agent-lcd -a codex,claude -f prompt.md     # subset of agents
agent-lcd -o - "…"                          # report to stdout
```

| Flag | |
|---|---|
| `-f, --file <path>` | Read the prompt from a file |
| `-o, --output <path>` | Report path, `-` for stdout. `{timestamp}` → local date and time |
| `-c, --config <path>` | Config file. Default: `./agent-lcd.config.js` if present |
| `-a, --agents <list>` | Comma-separated subset of `claude`, `codex`, `antigravity`. Overrides agents set to `false` in config |

Exit code is 1 if any agent failed, 2 on usage errors. Progress goes to stderr.

### Frontmatter

A prompt file (via `-f`, stdin or `./prompt.md`) may start with YAML frontmatter. It takes the same keys as the config file and overrides it for that prompt; CLI flags still win.

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

The exact command for each run is included in the report under a *Command* disclosure, with the prompt replaced by `"$PROMPT"`.

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

Responses are included verbatim, with their headings demoted so they nest under the agent's section. If `wrap` changed the prompt, the wrapped version is included in a disclosure.

## Caveats

- Antigravity receives the prompt on the command line, so it is capped by `ARG_MAX` (about 1 MB on macOS). Codex and Claude read it from stdin.
- The Antigravity keychain trick is macOS-only. On Linux `agy` stores its token in `~/.gemini/antigravity-cli/`; copy that file in via `files` if you need it there.
- Codex has no documented switch to disable *all* tools; the feature flags above remove everything it currently exposes. Re-check `codex features list` after Codex updates.
- Model availability depends on how each CLI is authenticated. Codex with a ChatGPT account rejects `gpt-*-mini`/`-nano` models.
