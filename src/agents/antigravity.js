import { homedir } from "node:os";
import { join } from "node:path";

/** @import { Agent } from "./index.js" */

// A custom agent with an empty tool allowlist and no inherited user customizations
// (rules, skills, plugins, GEMINI.md / AGENTS.md). NOTE: agy still exposes `manage_task`
// regardless (google-antigravity/antigravity-cli#1015).
const AGENT = `---
name: lcd
description: Lowest common denominator run
tools: []
inheritCustomizations: false
---
`;

/** @type {Agent} */
export default {
	name: "Antigravity CLI",
	// Weakest entry in `agy models`; effort is baked into the slug
	defaults: { model: "gemini-3.8-flash-low" },

	command ({ model, effort, args }, cwd, prompt) {
		// MCP servers and plugins come from ~/.gemini/config and have no off switch, so run with an
		// empty HOME. agy keeps its OAuth token in the macOS keychain, which resolves relative to HOME
		// (same trick as the GoogleChrome/guidance eval harness).
		const home = join(cwd, "home");
		return {
			bin: "agy",
			args: [
				"-p", prompt, // NOTE: argv; stdin only takes stream-json
				"--model", model,
				...(effort ? ["--effort", effort] : []),
				"--agent", "lcd",
				"--output-format", "json",
				"--disable-slash-commands",
				...args,
			],
			files: { ".agents/agents/lcd.md": AGENT },
			links: { "home/Library/Keychains": join(homedir(), "Library", "Keychains") },
			env: { HOME: home },
		};
	},

	parse (stdout, stderr) {
		const out = stdout.includes("{") ? stdout : stderr;
		const json = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
		return {
			text: json.response,
			error: json.status === "SUCCESS" ? undefined : (json.error?.message ?? json.error ?? json.status),
			usage: json.usage && { input: json.usage.input_tokens, output: json.usage.output_tokens },
		};
	},
};
