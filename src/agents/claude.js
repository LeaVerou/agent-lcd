/** @import { Agent } from "./index.js" */

/** @type {Agent} */
export default {
	name: "Claude Code",
	defaults: { model: "haiku", effort: "low" },

	command ({ model, effort, args }) {
		return {
			bin: "claude",
			args: [
				"-p", "--output-format", "json",
				"--model", model,
				...(effort ? ["--effort", effort] : []),
				"--tools", "",              // no built-in tools
				"--setting-sources", "",    // no settings.json, CLAUDE.md, hooks or plugins from any scope
				"--strict-mcp-config",      // no MCP servers
				"--disable-slash-commands", // no skills
				"--no-session-persistence",
				...args,
			],
			stdin: true,
		};
	},

	parse (stdout) {
		const json = JSON.parse(stdout);
		const [model, usage = {}] = Object.entries(json.modelUsage ?? {})[0] ?? [];
		return {
			text: json.is_error ? undefined : json.result,
			error: json.is_error ? json.result : undefined,
			model,
			usage: {
				input: sum(usage.inputTokens, usage.cacheCreationInputTokens, usage.cacheReadInputTokens),
				output: usage.outputTokens,
			},
			cost: json.total_cost_usd,
		};
	},
};

const sum = (...n) => n.some(x => x !== undefined) ? n.reduce((a, b) => a + (b ?? 0), 0) : undefined;
