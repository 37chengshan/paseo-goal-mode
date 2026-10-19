import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const GOAL_ITEM_KIND = "goal";
export const GOAL_ITEM_VERSION = 1;
export const DEFAULT_MAX_NUDGES = 10;
export const MAX_CONSECUTIVE_FAILURES = 3;

export const goalStatusSchema = z.enum(["active", "paused", "completed", "blocked"]);
export type GoalStatus = z.infer<typeof goalStatusSchema>;

export const goalSchema = z.object({
  agentId: z.string(),
  agentTitle: z.string().optional(),
  objective: z.string(),
  status: goalStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  nudges: z.number().int().min(0),
  maxNudges: z.number().int().min(1),
  consecutiveFailures: z.number().int().min(0),
  completedAt: z.string().optional(),
  blockedReason: z.string().optional(),
  pausedReason: z.string().optional(),
});
export type Goal = z.infer<typeof goalSchema>;

export const goalItemPhaseSchema = z.enum([
  "set",
  "status",
  "nudge",
  "complete",
  "blocked",
  "paused",
  "resumed",
  "cleared",
  "failed",
  "limit",
  "notice",
]);
export type GoalItemPhase = z.infer<typeof goalItemPhaseSchema>;

export const goalItemDataSchema = z.object({
  phase: goalItemPhaseSchema,
  objective: z.string().optional(),
  status: goalStatusSchema.optional(),
  nudges: z.number().optional(),
  maxNudges: z.number().optional(),
  reason: z.string().optional(),
});
export type GoalItemData = z.infer<typeof goalItemDataSchema>;

const goalResultSchema = z.object({
  ok: z.boolean(),
  goal: goalSchema.nullable(),
});

export const goalSetRpc = defineRpc({
  name: "goal.set",
  input: z.object({
    agentId: z.string(),
    agentTitle: z.string().optional(),
    objective: z.string(),
    maxNudges: z.number().int().min(1).max(100).optional(),
  }),
  output: goalResultSchema,
});

export const goalStatusRpc = defineRpc({
  name: "goal.status",
  input: z.object({ agentId: z.string() }),
  output: goalResultSchema,
});

export const goalClearRpc = defineRpc({
  name: "goal.clear",
  input: z.object({ agentId: z.string() }),
  output: goalResultSchema,
});

export const goalPauseRpc = defineRpc({
  name: "goal.pause",
  input: z.object({ agentId: z.string() }),
  output: goalResultSchema,
});

export const goalResumeRpc = defineRpc({
  name: "goal.resume",
  input: z.object({ agentId: z.string() }),
  output: goalResultSchema,
});

export const goalListRpc = defineRpc({
  name: "goal.list",
  input: z.object({}),
  output: z.object({ goals: z.array(goalSchema) }),
});
