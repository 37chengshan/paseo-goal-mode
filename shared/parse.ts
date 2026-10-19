export type GoalCommand =
  | { action: "set"; objective: string; maxNudges?: number }
  | { action: "status" | "pause" | "resume" | "clear" };

const CLEAR_ALIASES = new Set(["clear", "stop", "off", "cancel", "none"]);

function clampMaxNudges(value: number): number {
  return Math.min(100, Math.max(1, value));
}

export function parseGoalCommand(raw: string): GoalCommand {
  let text = raw.trim();
  let maxNudges: number | undefined;

  const leadingMax = /^--max=(\d{1,3})\s+([\s\S]+)$/i.exec(text);
  if (leadingMax) {
    maxNudges = clampMaxNudges(Number(leadingMax[1]));
    text = leadingMax[2].trim();
  }

  const setMatch = /^set\s+([\s\S]+)$/i.exec(text);
  if (setMatch) {
    let objective = setMatch[1].trim();
    const setMax = /^--max=(\d{1,3})\s+([\s\S]+)$/i.exec(objective);
    if (setMax) {
      maxNudges = clampMaxNudges(Number(setMax[1]));
      objective = setMax[2].trim();
    }
    return { action: "set", objective, maxNudges };
  }

  const word = text.toLowerCase();
  if (word === "" || word === "status") {
    return { action: "status" };
  }
  if (word === "set") {
    return { action: "set", objective: "", maxNudges };
  }
  if (word === "pause") {
    return { action: "pause" };
  }
  if (word === "resume") {
    return { action: "resume" };
  }
  if (CLEAR_ALIASES.has(word)) {
    return { action: "clear" };
  }
  return { action: "set", objective: text, maxNudges };
}
