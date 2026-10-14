// Example config. All keys are optional; these are the defaults.
// Run with `agent-lcd -c <path>` or keep it as agent-lcd.config.js in the working directory.

/** @type {import("./src/config.js").Config} */
export default {
	// Template the prompt is inserted into. `{prompt}` is replaced with the prompt.
	// May also be a function: prompt => `...${prompt}...`
	wrap: "{prompt}",

	// Seconds before an agent run is killed
	timeout: 600,

	// Report path. "-" prints to stdout. `{timestamp}` → local date and time.
	output: "reports/{timestamp}.md",

	// Per-agent overrides. Set an agent to `false` to skip it.
	// `args` are extra CLI arguments appended to the agent's command line.
	agents: {
		claude: { model: "haiku", effort: "low" },
		codex: { model: "gpt-6-luna", effort: "low" }, // "gpt-5.6-luna" is the older, weaker option while it lasts
		antigravity: { model: "gemini-3.8-flash-low" }, // see `agy models`
	},
};
