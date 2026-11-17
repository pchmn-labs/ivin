# tool-calls

The default rendering of tool calls, in the `transcript.toolCall` slot (contribution `tool-calls/default`, matching every tool). A plugin for one tool adds a contribution with `tool: "<name>"` and `replaces: "tool-calls/default"`. The `tool-status` test id is read by the end-to-end tests.
