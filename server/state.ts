import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Goal } from "../shared/goal";

interface StateFile {
  version: 1;
  goals: Record<string, Goal>;
}

const STATE_PATH = process.env.GOAL_MODE_STATE_FILE ?? join(homedir(), ".paseo", "plugin-state", "goal-mode.json");
const LOG_PREFIX = "[goal-mode]";

let cache: StateFile | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function readState(): Promise<StateFile> {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<StateFile>;
    if (parsed && parsed.version === 1 && parsed.goals && typeof parsed.goals === "object") {
      return { version: 1, goals: parsed.goals };
    }
    console.warn(`${LOG_PREFIX} state file has an unexpected shape; starting fresh`);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn(`${LOG_PREFIX} could not read state file: ${String(error)}`);
    }
  }
  return { version: 1, goals: {} };
}

async function loadState(): Promise<StateFile> {
  if (!cache) {
    cache = await readState();
  }
  return cache;
}

function persist(state: StateFile): Promise<void> {
  const snapshot = JSON.stringify(state, null, 2);
  writeChain = writeChain.then(async () => {
    try {
      await mkdir(dirname(STATE_PATH), { recursive: true });
      const tmp = `${STATE_PATH}.${process.pid}.tmp`;
      await writeFile(tmp, snapshot, "utf8");
      await rename(tmp, STATE_PATH);
    } catch (error) {
      console.error(`${LOG_PREFIX} failed to persist state: ${String(error)}`);
    }
  });
  return writeChain;
}

export async function getGoal(agentId: string): Promise<Goal | null> {
  const state = await loadState();
  return state.goals[agentId] ?? null;
}

export async function listGoals(): Promise<Goal[]> {
  const state = await loadState();
  return Object.values(state.goals).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function putGoal(goal: Goal): Promise<Goal> {
  const state = await loadState();
  state.goals[goal.agentId] = goal;
  await persist(state);
  return goal;
}

export async function removeGoal(agentId: string): Promise<Goal | null> {
  const state = await loadState();
  const previous = state.goals[agentId] ?? null;
  if (previous) {
    delete state.goals[agentId];
    await persist(state);
  }
  return previous;
}
