#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs, styleText } from "node:util";
import agents from "../src/agents/index.js";
import loadConfig from "../src/config.js";
import readPrompt from "../src/prompt.js";
import run from "../src/run.js";
import report from "../src/report.js";

const HELP = `Usage: agent-lcd [options] [prompt]

Run a prompt through Codex, Antigravity CLI and Claude Code with their weakest
models and no tools, memory, plugins or web search. Writes a Markdown report.

The prompt comes from the first of: --file, the positional argument, stdin,
a prompt.md in the current directory. File and stdin prompts may start with
YAML frontmatter holding config overrides (same keys as the config file).

Options:
  -f, --file <path>      Read the prompt from a file
  -o, --output <path>    Report path ("-" for stdout). Supports {timestamp}
  -c, --config <path>    Config file (default: ./agent-lcd.config.js if present)
  -a, --agents <list>    Comma-separated subset of: ${Object.keys(agents).join(", ")}
  -h, --help             Show this help
`;

let values, positionals, config, prompt, overrides;
try {
	({ values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			file: { type: "string", short: "f" },
			output: { type: "string", short: "o" },
			config: { type: "string", short: "c" },
			agents: { type: "string", short: "a" },
			help: { type: "boolean", short: "h" },
		},
	}));
	if (values.help) {
		console.log(HELP);
		process.exit(0);
	}
	({ text: prompt, config: overrides } = await readPrompt(values, positionals));
	config = await loadConfig(values.config, overrides);
}
catch (e) {
	fail(e.message + (e.message.startsWith("No prompt") ? "\n\n" + HELP : ""));
}

const wrapped = config.wrap(prompt);
const selected = values.agents?.split(",").map(s => s.trim()).filter(Boolean) ?? Object.keys(agents);
const runs = selected.flatMap(key => {
	const agent = agents[key];
	if (!agent) {
		fail(`Unknown agent "${key}". Available: ${Object.keys(agents).join(", ")}`);
	}
	const options = config.agents[key];
	// Config can switch an agent off, but an explicit --agents wins
	if (options === false && !values.agents) {
		return [];
	}
	return [{ agent, options: { ...agent.defaults, args: [], ...options } }];
});

const log = (icon, text) => console.error(`${icon} ${text}`);
const date = new Date();
const results = await Promise.all(runs.map(async ({ agent, options }) => {
	log(styleText("dim", "▶"), `${agent.name} (${options.model})`);
	const result = await run(agent, options, wrapped, config.timeout);
	if (result.error) {
		log(styleText("red", "✗"), `${agent.name}: ${result.error.split("\n")[0]}`);
	}
	else {
		log(styleText("green", "✓"), `${agent.name} in ${(result.duration / 1000).toFixed(1)}s`);
	}
	return result;
}));

const markdown = report({ prompt, wrapped, results, date });
const output = (values.output ?? config.output).replaceAll("{timestamp}", timestamp(date));
if (output === "-") {
	console.log(markdown);
}
else {
	await mkdir(dirname(output), { recursive: true });
	await writeFile(output, markdown);
	log(styleText("dim", "→"), output);
}
// Not process.exit(): let stdout drain first
process.exitCode = results.some(r => r.error) ? 1 : 0;

/** Filesystem-safe local timestamp, e.g. 2026-10-13-1842 */
function timestamp (d) {
	const pad = n => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function fail (message) {
	console.error(styleText("red", message));
	process.exit(2);
}
