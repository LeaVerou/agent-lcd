import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** @import { Agent, AgentOptions, Result } from "./agents/index.js" */

/**
 * @typedef {Result & { agent: Agent, options: AgentOptions, command: string, duration: number }} RunResult
 * `command` is a shell-pasteable reproduction with the prompt replaced by `"$PROMPT"`; `duration` is in ms.
 */

const PROMPT = '"$PROMPT"';

/**
 * Run one agent on a prompt inside a fresh empty directory, so no project memory or config is picked up.
 * Never throws: failures are reported in `error`.
 * @param {Agent} agent
 * @param {AgentOptions} options
 * @param {string} prompt
 * @param {number} timeout Seconds
 * @returns {Promise<RunResult>}
 */
export default async function run (agent, options, prompt, timeout) {
	const cwd = await mkdtemp(join(tmpdir(), "agent-lcd-"));
	const { bin, args, stdin, files = {}, links = {}, env } = agent.command(options, cwd, prompt);
	for (const [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(cwd, path)), { recursive: true });
		await writeFile(join(cwd, path), content);
	}
	for (const [path, target] of Object.entries(links)) {
		await mkdir(dirname(join(cwd, path)), { recursive: true });
		await symlink(target, join(cwd, path));
	}

	const started = performance.now();
	let result;
	try {
		const { stdout, stderr, code, signal } = await exec(bin, args, { cwd, env, input: stdin ? prompt : undefined, timeout: timeout * 1000 });
		const exit = signal ? `killed by ${signal}` : `exit code ${code}`;
		try {
			result = agent.parse(stdout, stderr);
		}
		catch {
			result = { error: `Unparseable output (${exit})${tail(stderr)}`, text: stdout || undefined };
		}
		if ((code !== 0 || signal) && !result.error) {
			result.error = `Failed (${exit})${tail(stderr)}`;
		}
	}
	catch (e) {
		result = { error: e.message };
	}
	finally {
		await rm(cwd, { recursive: true, force: true });
	}

	// Reproduction command: hide the prompt and the throwaway directory
	const redact = value => value === prompt ? PROMPT : value.replaceAll(cwd, ".");
	const assignments = Object.entries(env ?? {}).map(([key, value]) => `${key}=${redact(value)}`);
	return {
		agent,
		options,
		...result,
		duration: performance.now() - started,
		command: shell([...assignments, bin, ...args.map(redact)]) + (stdin ? ` <<< ${PROMPT}` : ""),
	};
}

/** Spawn a process, feed it `input`, and collect its output. Rejects on spawn failure or timeout. */
function exec (bin, args, { cwd, env, input, timeout }) {
	return new Promise((resolve, reject) => {
		const child = spawn(bin, args, {
			cwd,
			env: { ...process.env, ...env },
			stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
			signal: AbortSignal.timeout(timeout),
			killSignal: "SIGKILL",
		});
		let stdout = "", stderr = "";
		child.stdout.setEncoding("utf8").on("data", d => stdout += d);
		child.stderr.setEncoding("utf8").on("data", d => stderr += d);
		child.on("error", e => {
			if (e.name === "AbortError") {
				reject(new Error(`Timed out after ${timeout / 1000}s${tail(stderr)}`));
			}
			else if (e.code === "ENOENT") {
				reject(new Error(`\`${bin}\` is not installed or not on PATH`));
			}
			else {
				reject(e);
			}
		});
		child.on("close", (code, signal) => resolve({ stdout, stderr, code, signal }));
		if (input !== undefined) {
			// EPIPE if the child exits before reading; its exit code already tells the story
			child.stdin.on("error", () => {}).end(input);
		}
	});
}

/** Last few lines of stderr, formatted as an error suffix */
function tail (stderr, lines = 5) {
	const text = stderr.trim().split("\n").slice(-lines).join("\n").trim();
	return text ? `\n${text}` : "";
}

/** Join words into a shell line, single-quoting anything that needs it */
function shell (words) {
	return words.map(arg => arg === PROMPT || /^[\w./:=@,-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", `'\\''`)}'`).join(" ");
}
