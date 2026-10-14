import antigravity from "./antigravity.js";
import claude from "./claude.js";
import codex from "./codex.js";

/**
 * @typedef {object} AgentOptions
 * @property {string} model Model id, as the CLI accepts it
 * @property {string} [effort] Reasoning effort, where the CLI supports it
 * @property {string[]} args Extra CLI arguments, appended verbatim
 *
 * @typedef {object} Command
 * @property {string} bin Executable name
 * @property {string[]} args
 * @property {boolean} [stdin] Send the prompt on stdin (otherwise the agent put it in `args`)
 * @property {Record<string, string>} [files] Files to create in the working directory before running, by relative path
 * @property {Record<string, string>} [links] Symlinks to create in the working directory, relative path → target
 * @property {Record<string, string>} [env] Environment variables to set for the process
 *
 * @typedef {object} Result
 * @property {string} [text] The agent's final response
 * @property {string} [error] Set when the run failed; `text` may still hold partial output
 * @property {string} [model] Resolved model id, when the CLI reports it
 * @property {{ input?: number, output?: number }} [usage] Token counts
 * @property {number} [cost] USD, when the CLI reports it
 *
 * @typedef {object} Agent
 * @property {string} name Display name
 * @property {Partial<AgentOptions>} defaults The weakest configuration this CLI supports
 * @property {(options: AgentOptions, cwd: string, prompt: string) => Command} command
 *   Build the headless invocation. `cwd` is an empty throwaway directory.
 *   Pass `prompt` and `cwd` as whole, unmodified arguments so the report can redact them.
 * @property {(stdout: string, stderr: string) => Result} parse Turn the CLI's output into a result
 */

/** All known agents, keyed by the id used in config and `--agents`. */
export default { claude, codex, antigravity };
