# Goal Mode

Goal mode keeps an agent working on one objective across multiple turns. Set a goal with `/goal <objective>` and the plugin sends a kickoff message. After every completed turn it follows up automatically until the agent reports success, reports that it is blocked, or reaches the auto-continue limit.

## How it works

The plugin listens for the agent turn-ended event on the Paseo daemon. It sends a short continue message after each turn and adds a goal card to the agent timeline so the current state is visible in every client. The agent marks a finished goal by ending its last message with `<goal-complete />`, or marks a problem with `<goal-blocked>reason</goal-blocked>`. If neither marker appears, the plugin counts the turn as unfinished and continues.

## Commands

- `/goal <objective>` starts a goal, or replaces the current one.
- `/goal status` shows the goal for the current agent.
- `/goal pause` and `/goal resume` stop and restart automatic continuation.
- `/goal clear` removes the goal. `stop`, `off`, `cancel`, and `none` are accepted aliases.
- `/goal --max=N <objective>` sets a custom auto-continue limit from 1 to 100. The default is 10.

The Goals screen in the sidebar lists goals on the connected host and offers pause, resume, clear, and open-agent actions. The same screen is available from the command center.

## Behavior and limits

A canceled turn pauses the goal. Three consecutive failed turns also pause it, and a failed send pauses it rather than retrying forever. Reaching the auto-continue limit marks the goal blocked so a person can decide what happens next.

Goals are stored per agent in `~/.paseo/plugin-state/goal-mode.json` on the machine that runs the daemon. The plugin reads recent turn output on that machine to find the completion markers and sends follow-up messages through the local daemon. The objective and follow-up prompts are delivered to the agent through its configured provider, so they are subject to that provider's data handling. The plugin does not send goal data to any other service. Requires Paseo 0.11.4 or newer.
