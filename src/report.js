/** @import { RunResult } from "./run.js" */

/**
 * Render the Markdown report.
 * @param {object} data
 * @param {string} data.prompt
 * @param {string} data.wrapped The prompt as actually sent
 * @param {RunResult[]} data.results
 * @param {Date} data.date
 * @param {boolean} [data.debug] Include each agent's reproduction command
 * @returns {string}
 */
export default function report ({ prompt, wrapped, results, date, debug }) {
	const rows = results.map(r => [
		r.agent.name,
		code(r.model ?? r.options.model),
		r.options.effort ?? "—",
		seconds(r.duration),
		r.usage?.input !== undefined ? `${r.usage.input} / ${r.usage.output ?? "?"}` : "—",
		r.error ? "❌ error" : "✅",
	]);

	const sections = results.map(r => [
		`## ${r.agent.name}`,
		r.error && error(r.error),
		r.text && demote(r.text, 2),
		!r.error && !r.text && "_No output._",
		debug && details("Command", fence(r.command, "sh")),
	].filter(Boolean).join("\n\n"));

	return [
		`# Agent LCD`,
		date.toISOString().replace("T", " ").slice(0, 16) + " UTC",
		table(["Agent", "Model", "Effort", "Time", "Tokens (in / out)", "Status"], rows),
		`## Prompt`,
		fence(prompt, "md"),
		wrapped !== prompt && details("Wrapped prompt as sent", fence(wrapped, "md")),
		...sections,
	].filter(Boolean).join("\n\n") + "\n";
}

/** First line as a callout, any remaining lines (e.g. stderr) in a code block */
function error (message) {
	const [first, ...rest] = message.split("\n");
	return `> **Error:** ${first}` + (rest.length ? `\n\n${fence(rest.join("\n"), "text")}` : "");
}

function table (header, rows) {
	const line = cells => `| ${cells.join(" | ")} |`;
	return [line(header), line(header.map(() => "---")), ...rows.map(line)].join("\n");
}

function details (summary, body) {
	return `<details>\n<summary>${summary}</summary>\n\n${body}\n\n</details>`;
}

const code = text => text ? `\`${text}\`` : "—";
const seconds = ms => `${(ms / 1000).toFixed(1)}s`;

/** Fenced code block whose fence is longer than any backtick run inside the content */
function fence (content, lang = "") {
	const longest = [...content.matchAll(/`+/g)].reduce((n, m) => Math.max(n, m[0].length), 2);
	const ticks = "`".repeat(longest + 1);
	return `${ticks}${lang}\n${content.replace(/\n$/, "")}\n${ticks}`;
}

/** Push every Markdown heading down `by` levels, leaving fenced code blocks alone */
function demote (markdown, by) {
	let inFence = null;
	return markdown.split("\n").map(line => {
		const fenceMatch = line.match(inFence ? /^ {0,3}(`{3,}|~{3,})\s*$/ : /^ {0,3}(`{3,}(?!.*`)|~{3,})/);
		if (fenceMatch) {
			if (!inFence) {
				inFence = fenceMatch[1];
			}
			else if (fenceMatch[1][0] === inFence[0] && fenceMatch[1].length >= inFence.length) {
				inFence = null;
			}
			return line;
		}
		return inFence ? line : line.replace(/^( {0,3})(#{1,6})(?=\s|$)/, (_, indent, h) => indent + "#".repeat(Math.min(6, h.length + by)));
	}).join("\n");
}
