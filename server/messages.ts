import type { Goal } from "../shared/goal";

const CJK_PATTERN = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;

function usesCJK(text: string): boolean {
  return CJK_PATTERN.test(text);
}

export function buildKickoffMessage(goal: Goal): string {
  if (usesCJK(goal.objective)) {
    return [
      "🎯 已进入目标模式。",
      "",
      `目标：${goal.objective}`,
      "",
      `请持续朝这个目标推进。每一轮结束后，我会自动发送"继续"，直到你完成目标或达到自动续跑上限（${goal.maxNudges} 次）。`,
      "",
      "目标完全达成时，请在最后一行输出：",
      "<goal-complete />",
      "确实受阻、需要用户介入时，请在最后一行输出：",
      "<goal-blocked>简短原因</goal-blocked>",
    ].join("\n");
  }
  return [
    "🎯 Goal mode engaged.",
    "",
    `Objective: ${goal.objective}`,
    "",
    `Keep working toward this objective. After each of your turns I will automatically send "continue" until you finish, or until the auto-continue limit (${goal.maxNudges} times) is reached.`,
    "",
    "When the objective is fully achieved, end your final message with a line containing exactly:",
    "<goal-complete />",
    "If you are genuinely stuck and need the user, end with:",
    "<goal-blocked>short reason</goal-blocked>",
  ].join("\n");
}

export function buildContinueMessage(goal: Goal, nudgeNumber: number): string {
  if (usesCJK(goal.objective)) {
    return [
      `继续推进目标："${goal.objective}"`,
      `（自动续跑 ${nudgeNumber}/${goal.maxNudges}）`,
      "",
      "完成后在最后一行输出 <goal-complete />；受阻则输出 <goal-blocked>原因</goal-blocked>。",
    ].join("\n");
  }
  return [
    `Continue toward the goal: "${goal.objective}"`,
    `(auto-continue ${nudgeNumber}/${goal.maxNudges})`,
    "",
    "End with <goal-complete /> when done, or <goal-blocked>reason</goal-blocked> if stuck.",
  ].join("\n");
}
