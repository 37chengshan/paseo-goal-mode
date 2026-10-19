import { randomUUID } from "node:crypto";
import type { PluginHandlerContext, PluginLifecycleEvents, PluginTurnOutcome } from "@getpaseo/plugin/server";
import {
  DEFAULT_MAX_NUDGES,
  GOAL_ITEM_KIND,
  GOAL_ITEM_VERSION,
  MAX_CONSECUTIVE_FAILURES,
  type Goal,
  type GoalItemData,
} from "../shared/goal";
import { latestOutputText } from "./inspect";
import { buildContinueMessage, buildKickoffMessage } from "./messages";
import { getGoal, listGoals, putGoal, removeGoal } from "./state";

const LOG_PREFIX = "[goal-mode]";
const OBJECTIVE_LIMIT = 4000;

type Paseo = PluginHandlerContext["paseo"];
type Timeline = PluginLifecycleEvents["agent.turn_ended"]["timeline"];

export async function appendGoalItem(paseo: Paseo, agentId: string, data: GoalItemData): Promise<void> {
  try {
    await paseo.agents.ref(agentId).timeline.append({
      type: "plugin",
      id: randomUUID(),
      kind: GOAL_ITEM_KIND,
      version: GOAL_ITEM_VERSION,
      data: JSON.parse(JSON.stringify(data)),
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} timeline append failed: ${String(error)}`);
  }
}

async function sendToAgent(paseo: Paseo, agentId: string, text: string): Promise<boolean> {
  try {
    await paseo.agents.ref(agentId).send(text, { activeTurnBehavior: "steer" });
    return true;
  } catch (error) {
    console.error(`${LOG_PREFIX} send failed agent=${agentId}: ${String(error)}`);
    return false;
  }
}

export interface SetGoalInput {
  agentId: string;
  agentTitle?: string;
  objective: string;
  maxNudges?: number;
}

export async function setGoal(paseo: Paseo, input: SetGoalInput): Promise<Goal | null> {
  const objective = input.objective.trim().slice(0, OBJECTIVE_LIMIT);
  if (objective.length === 0) {
    await appendGoalItem(paseo, input.agentId, {
      phase: "notice",
      reason: "用法：/goal <目标描述> · usage: /goal <objective>",
    });
    return null;
  }
  const now = new Date().toISOString();
  const previous = await getGoal(input.agentId);
  const goal: Goal = {
    agentId: input.agentId,
    ...(input.agentTitle?.trim()
      ? { agentTitle: input.agentTitle.trim().slice(0, 120) }
      : {}),
    objective,
    status: "active",
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    nudges: 0,
    maxNudges: input.maxNudges ?? DEFAULT_MAX_NUDGES,
    consecutiveFailures: 0,
  };
  await putGoal(goal);
  await appendGoalItem(paseo, goal.agentId, { phase: "set", objective, maxNudges: goal.maxNudges });
  const sent = await sendToAgent(paseo, goal.agentId, buildKickoffMessage(goal));
  if (!sent) {
    await appendGoalItem(paseo, goal.agentId, {
      phase: "notice",
      reason: "目标已保存，但启动消息发送失败；可执行 /goal resume 重试。 · Goal saved, but the kickoff message failed; run /goal resume to retry.",
    });
  }
  console.log(`${LOG_PREFIX} goal set agent=${goal.agentId} maxNudges=${goal.maxNudges}`);
  return goal;
}

export async function showStatus(paseo: Paseo, agentId: string): Promise<Goal | null> {
  const goal = await getGoal(agentId);
  if (!goal) {
    await appendGoalItem(paseo, agentId, {
      phase: "notice",
      reason: "当前 agent 没有目标。 · No goal for this agent.",
    });
    return null;
  }
  await appendGoalItem(paseo, agentId, {
    phase: "status",
    objective: goal.objective,
    status: goal.status,
    nudges: goal.nudges,
    maxNudges: goal.maxNudges,
    reason: goal.blockedReason ?? goal.pausedReason,
  });
  return goal;
}

export async function clearGoal(paseo: Paseo, agentId: string): Promise<Goal | null> {
  const previous = await removeGoal(agentId);
  if (!previous) {
    await appendGoalItem(paseo, agentId, {
      phase: "notice",
      reason: "没有可清除的目标。 · No goal to clear.",
    });
    return null;
  }
  await appendGoalItem(paseo, agentId, {
    phase: "cleared",
    objective: previous.objective,
    status: previous.status,
  });
  console.log(`${LOG_PREFIX} goal cleared agent=${agentId}`);
  return previous;
}

export async function pauseGoal(paseo: Paseo, agentId: string): Promise<Goal | null> {
  const goal = await getGoal(agentId);
  if (!goal) {
    await appendGoalItem(paseo, agentId, {
      phase: "notice",
      reason: "当前 agent 没有目标。 · No goal for this agent.",
    });
    return null;
  }
  if (goal.status !== "active") {
    await appendGoalItem(paseo, agentId, {
      phase: "notice",
      reason: `目标当前状态为 ${goal.status}，无需暂停。 · Goal is already ${goal.status}.`,
    });
    return goal;
  }
  const updated: Goal = {
    ...goal,
    status: "paused",
    pausedReason: "manual",
    updatedAt: new Date().toISOString(),
  };
  await putGoal(updated);
  await appendGoalItem(paseo, agentId, {
    phase: "paused",
    objective: goal.objective,
    reason: "手动暂停 · paused manually",
  });
  console.log(`${LOG_PREFIX} goal paused agent=${agentId}`);
  return updated;
}

export async function resumeGoal(paseo: Paseo, agentId: string): Promise<Goal | null> {
  const goal = await getGoal(agentId);
  if (!goal) {
    await appendGoalItem(paseo, agentId, {
      phase: "notice",
      reason: "当前 agent 没有目标。 · No goal for this agent.",
    });
    return null;
  }
  if (goal.status === "completed" || goal.status === "blocked") {
    await appendGoalItem(paseo, agentId, {
      phase: "notice",
      reason: `目标已结束（${goal.status}），请用 /goal <新目标> 重新开始。 · Goal already ${goal.status}; start a new one with /goal <objective>.`,
    });
    return goal;
  }
  if (goal.status === "active") {
    await appendGoalItem(paseo, agentId, {
      phase: "notice",
      reason: "目标已在进行中。 · Goal is already active.",
    });
    return goal;
  }
  const nudges = Math.min(goal.nudges + 1, goal.maxNudges);
  const updated: Goal = {
    ...goal,
    status: "active",
    nudges,
    pausedReason: undefined,
    consecutiveFailures: 0,
    updatedAt: new Date().toISOString(),
  };
  await putGoal(updated);
  await appendGoalItem(paseo, agentId, {
    phase: "resumed",
    objective: updated.objective,
    nudges: updated.nudges,
    maxNudges: updated.maxNudges,
  });
  await sendToAgent(paseo, agentId, buildContinueMessage(updated, updated.nudges));
  console.log(`${LOG_PREFIX} goal resumed agent=${agentId}`);
  return updated;
}

export async function listAllGoals(): Promise<Goal[]> {
  return listGoals();
}

export type GoalMarker = { kind: "complete" } | { kind: "blocked"; reason: string } | null;

function normalizeLine(line: string): string {
  return line.replace(/^>\s*/, "").replace(/[*_`~]/g, "").replace(/\s+/g, " ").trim();
}

export function scanGoalMarkers(output: string): GoalMarker {
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(-3);
  for (const line of lines.reverse()) {
    const normalized = normalizeLine(line);
    const blocked = /<goal-blocked>([\s\S]*?)<\/goal-blocked>\s*$/i.exec(normalized);
    if (blocked) {
      const reason = blocked[1].trim() || "no reason given";
      return { kind: "blocked", reason: reason.slice(0, 300) };
    }
    if (/(^|\s)<goal-complete\s*\/?>$/.test(normalized)) {
      return { kind: "complete" };
    }
  }
  return null;
}

export async function handleTurnEnded(
  agentId: string,
  outcome: PluginTurnOutcome,
  timeline: Timeline,
  paseo: Paseo,
): Promise<void> {
  const goal = await getGoal(agentId);
  if (!goal || goal.status !== "active") {
    return;
  }
  const now = new Date().toISOString();

  if (outcome.kind === "canceled") {
    const updated: Goal = {
      ...goal,
      status: "paused",
      pausedReason: "turn canceled",
      updatedAt: now,
    };
    await putGoal(updated);
    await appendGoalItem(paseo, agentId, {
      phase: "paused",
      objective: goal.objective,
      reason: "轮次被中断，已自动暂停 · turn canceled, paused",
    });
    console.log(`${LOG_PREFIX} goal paused after cancel agent=${agentId}`);
    return;
  }

  if (outcome.kind === "failed") {
    const failures = goal.consecutiveFailures + 1;
    if (failures >= MAX_CONSECUTIVE_FAILURES) {
      const updated: Goal = {
        ...goal,
        status: "paused",
        pausedReason: `failed ${failures} turns in a row`,
        consecutiveFailures: failures,
        updatedAt: now,
      };
      await putGoal(updated);
      await appendGoalItem(paseo, agentId, {
        phase: "paused",
        objective: goal.objective,
        reason: `连续 ${failures} 轮失败，已自动暂停：${outcome.error.message} · paused after ${failures} consecutive failures`,
      });
      console.log(`${LOG_PREFIX} goal paused after ${failures} failures agent=${agentId}`);
    } else {
      const updated: Goal = {
        ...goal,
        consecutiveFailures: failures,
        updatedAt: now,
      };
      await putGoal(updated);
      await appendGoalItem(paseo, agentId, {
        phase: "failed",
        objective: goal.objective,
        reason: `轮次失败 (${failures}/${MAX_CONSECUTIVE_FAILURES})：${outcome.error.message} · turn failed`,
      });
    }
    return;
  }

  const reset: Goal = { ...goal, consecutiveFailures: 0, updatedAt: now };
  const marker = scanGoalMarkers(latestOutputText(timeline));

  if (marker?.kind === "complete") {
    const completed: Goal = { ...reset, status: "completed", completedAt: now };
    await putGoal(completed);
    await appendGoalItem(paseo, agentId, {
      phase: "complete",
      objective: goal.objective,
      nudges: completed.nudges,
      maxNudges: completed.maxNudges,
    });
    console.log(`${LOG_PREFIX} goal completed agent=${agentId}`);
    return;
  }

  if (marker?.kind === "blocked") {
    const blocked: Goal = { ...reset, status: "blocked", blockedReason: marker.reason };
    await putGoal(blocked);
    await appendGoalItem(paseo, agentId, {
      phase: "blocked",
      objective: goal.objective,
      status: "blocked",
      reason: marker.reason,
    });
    console.log(`${LOG_PREFIX} goal blocked agent=${agentId} reason="${marker.reason}"`);
    return;
  }

  if (reset.nudges >= reset.maxNudges) {
    const exhausted: Goal = {
      ...reset,
      status: "blocked",
      blockedReason: "auto-continue limit reached",
    };
    await putGoal(exhausted);
    await appendGoalItem(paseo, agentId, {
      phase: "limit",
      objective: goal.objective,
      status: "blocked",
      nudges: reset.nudges,
      maxNudges: reset.maxNudges,
      reason: `已达到自动续跑上限 ${reset.maxNudges} 次 · auto-continue limit reached`,
    });
    console.log(`${LOG_PREFIX} goal hit nudge limit agent=${agentId}`);
    return;
  }

  const nudged: Goal = { ...reset, nudges: reset.nudges + 1 };
  await putGoal(nudged);
  await appendGoalItem(paseo, agentId, {
    phase: "nudge",
    objective: goal.objective,
    nudges: nudged.nudges,
    maxNudges: nudged.maxNudges,
  });
  const sent = await sendToAgent(paseo, agentId, buildContinueMessage(nudged, nudged.nudges));
  if (!sent) {
    const paused: Goal = {
      ...nudged,
      status: "paused",
      pausedReason: "auto-continue send failed",
    };
    await putGoal(paused);
    await appendGoalItem(paseo, agentId, {
      phase: "paused",
      objective: goal.objective,
      reason: "自动续跑发送失败，已暂停 · auto-continue send failed; paused",
    });
  }
  console.log(`${LOG_PREFIX} auto-continue ${nudged.nudges}/${nudged.maxNudges} agent=${agentId}`);
}
