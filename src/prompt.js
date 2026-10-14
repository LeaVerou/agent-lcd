import { access, readFile } from "node:fs/promises";
import matter from "gray-matter";

/**
 * @typedef {object} Prompt
 * @property {string} text
 * @property {Partial<import("./config.js").Config>} config Overrides from the file's YAML frontmatter, if any
 */

/**
 * Resolve the prompt from the first available source: a file, the positional arguments,
 * stdin, or `./prompt.md`. File and stdin prompts may start with YAML frontmatter holding
 * config overrides.
 * @param {{ input?: string }} values Parsed CLI options
 * @param {string[]} positionals
 * @returns {Promise<Prompt>}
 */
export default async function readPrompt ({ input }, positionals) {
	if (input) {
		return frontmatter(await readFile(input, "utf8"));
	}
	if (positionals.length) {
		return { text: positionals.join(" "), config: {} };
	}
	if (!process.stdin.isTTY) {
		let text = "";
		for await (const chunk of process.stdin) {
			text += chunk;
		}
		if (text.trim()) {
			return frontmatter(text);
		}
	}
	if (await exists("prompt.md")) {
		return frontmatter(await readFile("prompt.md", "utf8"));
	}
	throw new Error("No prompt given.");
}

function frontmatter (text) {
	const { content, data } = matter(text);
	return { text: content, config: data };
}

async function exists (path) {
	try {
		await access(path);
		return true;
	}
	catch {
		return false;
	}
}
