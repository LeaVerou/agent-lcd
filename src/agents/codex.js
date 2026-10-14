import { homedir } from "node:os";
import { join } from "node:path";

/** @import { Agent } from "./index.js" */

// Every feature flag that adds a tool or side channel (see `codex features list`)
const FEATURES = [
	"shell_tool", "unified_exec", "sleep_tool", "view_image",
	"plugins", "remote_plugin", "skill_search", "apps",
	"image_generation", "computer_use", "browser_use",
	"tool_suggest", "goals", "multi_agent", "multi_agent_v2",
	"hooks", "memories", "fast_mode", "shell_snapshot",
];

/** @type {Agent} */
export default {
	name: "Codex",
	// Smallest model a ChatGPT-authenticated Codex can use; mini/nano tiers need an API key
	defaults: { model: "gpt-6-luna", effort: "low" },

	command ({ model, effort, args }, cwd) {
		// Skills are discovered from ~/.agents/skills and $CODEX_HOME with no off switch, so run with
		// an empty HOME that only links the auth file in. Codex also ships bundled skills; a one-token
		// catalog budget drops those from the prompt.
		const home = join(cwd, "home");
		const config = {
			web_search: "disabled",
			project_doc_max_bytes: 0, // no AGENTS.md
			"skills.max_context_tokens": 1,
			personality: "none",
			approval_policy: "never",
			...(effort && { model_reasoning_effort: effort }),
			...Object.fromEntries(FEATURES.map(f => [`features.${f}`, false])),
		};
		return {
			bin: "codex",
			args: [
				"exec", "--json", "--color", "never",
				"--ephemeral",           // no session files
				"--ignore-user-config",  // no ~/.codex/config.toml (MCP servers, plugins, skills)
				"--ignore-rules",
				"--skip-git-repo-check",
				"-C", cwd, "-s", "read-only",
				"-m", model,
				// TOML values happen to be valid JSON for strings, numbers and booleans
				...Object.entries(config).flatMap(([key, value]) => ["-c", `${key}=${JSON.stringify(value)}`]),
				...args,
				"-", // prompt from stdin
			],
			stdin: true,
			links: { "home/.codex/auth.json": join(homedir(), ".codex", "auth.json") },
			env: { HOME: home, CODEX_HOME: join(home, ".codex") },
		};
	},

	parse (stdout) {
		const events = stdout.split("\n").flatMap(line => {
			try {
				return [JSON.parse(line)];
			}
			catch {
				return [];
			}
		});
		const messages = events.filter(e => e?.type === "item.completed" && e.item?.type === "agent_message").map(e => e.item.text);
		const failure = events.find(e => e?.type === "turn.failed" || e?.type === "error");
		const usage = events.find(e => e?.type === "turn.completed")?.usage;
		return {
			text: messages.join("\n\n") || undefined,
			error: failure ? (failure.error?.message ?? failure.message) : undefined,
			usage: usage && { input: usage.input_tokens, output: usage.output_tokens },
		};
	},
};
