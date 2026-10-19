import type {
  PluginAgentCommandContext,
  PluginClientContext,
  PluginSidebarItemProps,
} from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { GOAL_ITEM_KIND, GOAL_ITEM_VERSION, goalItemDataSchema } from "./shared/goal";
import {
  goalClearRpc,
  goalPauseRpc,
  goalResumeRpc,
  goalSetRpc,
  goalStatusRpc,
} from "./shared/goal";
import { GoalItem } from "./client/goal-item";
import { GoalScreen } from "./client/goal-screen";
import { parseGoalCommand } from "./shared/parse";

const SCREEN_ID = "goal-mode";

async function submitGoalCommand(context: PluginAgentCommandContext & { args: string }) {
  const command = parseGoalCommand(context.args ?? "");
  const agentId = context.agent.id;
  try {
    switch (command.action) {
      case "set":
        await context.rpc(goalSetRpc, {
          agentId,
          agentTitle: context.agent.title ?? undefined,
          objective: command.objective,
          maxNudges: command.maxNudges,
        });
        return;
      case "status":
        await context.rpc(goalStatusRpc, { agentId });
        return;
      case "pause":
        await context.rpc(goalPauseRpc, { agentId });
        return;
      case "resume":
        await context.rpc(goalResumeRpc, { agentId });
        return;
      case "clear":
        await context.rpc(goalClearRpc, { agentId });
        return;
    }
  } catch (error) {
    console.error(`[goal-mode] slash command failed: ${String(error)}`);
  }
}

function GoalsSidebarItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="Target"
      label="Goals"
      active={currentScreen?.screenId === SCREEN_ID}
      onPress={() => openScreen({ screenId: SCREEN_ID })}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: SCREEN_ID, title: "Goals", Component: GoalScreen });

  client.addTimelineRenderer({
    kind: GOAL_ITEM_KIND,
    version: GOAL_ITEM_VERSION,
    schema: goalItemDataSchema,
    Component: GoalItem,
  });

  client.addSlashCommand({
    name: "goal",
    description: "Track an objective across turns with automatic continuation",
    argumentHint: "<objective> | status | pause | resume | clear | --max=N <objective>",
    context: "agent",
    onSubmit: submitGoalCommand,
  });

  client.addSidebarHeaderItem({ id: SCREEN_ID, title: "Goals", Component: GoalsSidebarItem });

  client.addCommandCenterItem({
    id: SCREEN_ID,
    title: "Goal mode",
    icon: "Target",
    keywords: ["goal", "goals", "objective", "target"],
    context: "global",
    onSelect: (context) => {
      context.openScreen({ screenId: SCREEN_ID });
    },
  });

  return () => {};
}
