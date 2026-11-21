# tool-calls

The default rendering of tool calls, in the `transcript.toolCall` slot (contribution `tool-calls/default`, matching every tool). A plugin for one tool adds a contribution with `tool: "<name>"` and `replaces: "tool-calls/default"`. Its icon follows the call's `kind`, which the harness sets. Inside the transcript, the host groups the calls of a turn under the agent's sentences and renders each one through this slot.
