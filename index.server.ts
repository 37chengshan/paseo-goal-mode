import type { PluginServerContext } from "@getpaseo/plugin/server";
import {
  clearGoal,
  handleTurnEnded,
  listAllGoals,
  pauseGoal,
  resumeGoal,
  setGoal,
  showStatus,
} from "./server/engine";
import {
  goalClearRpc,
  goalListRpc,
  goalPauseRpc,
  goalResumeRpc,
  goalSetRpc,
  goalStatusRpc,
} from "./shared/goal";

const LOG_PREFIX = "[goal-mode]";

export default function contribute(server: PluginServerContext) {
  server.handle(goalSetRpc, async (input, { paseo }) => {
    const goal = await setGoal(paseo, input);
    return { ok: goal !== null, goal };
  });

  server.handle(goalStatusRpc, async ({ agentId }, { paseo }) => {
    const goal = await showStatus(paseo, agentId);
    return { ok: goal !== null, goal };
  });

  server.handle(goalClearRpc, async ({ agentId }, { paseo }) => {
    const goal = await clearGoal(paseo, agentId);
    return { ok: goal !== null, goal };
  });

  server.handle(goalPauseRpc, async ({ agentId }, { paseo }) => {
    const goal = await pauseGoal(paseo, agentId);
    return { ok: goal !== null, goal };
  });

  server.handle(goalResumeRpc, async ({ agentId }, { paseo }) => {
    const goal = await resumeGoal(paseo, agentId);
    return { ok: goal !== null, goal };
  });

  server.handle(goalListRpc, async () => {
    return { goals: await listAllGoals() };
  });

  server.on("agent.turn_ended", async (event, { paseo }) => {
    try {
      await handleTurnEnded(event.agent.id, event.outcome, event.timeline, paseo);
    } catch (error) {
      console.error(`${LOG_PREFIX} turn_ended handler failed: ${String(error)}`);
    }
  });

  console.log(`${LOG_PREFIX} server ready`);
  return () => {};
}
