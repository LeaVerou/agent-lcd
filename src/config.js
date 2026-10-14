import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** @import { AgentOptions } from "./agents/index.js" */

/**
 * @typedef {object} Config
 * @property {string | ((prompt: string) => string)} wrap
 *   Template the prompt is inserted into; `{prompt}` is replaced with the prompt. May also be a function.
 *   After loading, always a function.
 * @property {number} timeout Seconds before an agent run is killed
 * @property {string} output Report path; `{timestamp}` is replaced with the local date and time
 * @property {Record<string, false | Partial<AgentOptions>>} agents
 *   Per-agent overrides, keyed by agent id. `false` disables an agent.
 */

/** @type {Config} */
export const defaults = {
	wrap: "{prompt}",
	timeout: 600,
	output: "reports/{timestamp}.md",
	agents: {},
};

const CANDIDATES = ["agent-lcd.config.js", "agent-lcd.config.mjs", "agent-lcd.config.json"];

/**
 * Load the config file (explicit path, or the first candidate found in the current directory) over the defaults.
 * @param {string} [path]
 * @returns {Promise<Config>}
 */
export default async function loadConfig (path) {
	path ??= await find(CANDIDATES);
	let user = {};
	if (path) {
		const url = pathToFileURL(resolve(path)).href;
		const module = await import(url, path.endsWith(".json") ? { with: { type: "json" } } : undefined);
		user = module.default ?? {};
	}
	const config = { ...defaults, ...user };
	if (typeof config.wrap !== "function") {
		const template = config.wrap;
		// Function replacer, so `$&` and friends in the prompt stay literal
		config.wrap = prompt => template.replaceAll("{prompt}", () => prompt);
	}
	return config;
}

async function find (paths) {
	for (const path of paths) {
		try {
			await access(path);
			return path;
		}
		catch {}
	}
}
