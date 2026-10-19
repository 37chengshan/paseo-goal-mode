import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  goalClearRpc,
  goalListRpc,
  goalPauseRpc,
  goalResumeRpc,
  type Goal,
  type GoalStatus,
} from "../shared/goal";

const POLL_INTERVAL_MS = 4000;

const STATUS_LABEL: Record<GoalStatus, string> = {
  active: "active",
  paused: "paused",
  completed: "completed",
  blocked: "blocked",
};

export function GoalScreen({ theme, layout, navigation }: PluginScreenProps) {
  const list = useRpc(goalListRpc);
  const pause = useRpc(goalPauseRpc);
  const resume = useRpc(goalResumeRpc);
  const clear = useRpc(goalClearRpc);
  const listRef = useRef(list);
  listRef.current = list;
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const result = await listRef.current({});
        if (!cancelled) {
          setGoals(result.goals);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(String(caught));
        }
      }
    };
    void tick();
    const timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const refresh = async () => {
    try {
      const result = await listRef.current({});
      setGoals(result.goals);
      setError(null);
    } catch (caught) {
      setError(String(caught));
    }
  };

  const run = async (agentId: string, action: (input: { agentId: string }) => Promise<unknown>) => {
    setBusyAgentId(agentId);
    try {
      await action({ agentId });
      await refresh();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setBusyAgentId(null);
    }
  };

  const padding = layout.compact ? 16 : 24;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      contentContainerStyle={{ padding, gap: 12 }}
    >
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13, lineHeight: 18 }}>
        Goals continue automatically after each turn. Start one from any agent with{" "}
        <Text style={{ color: theme.colors.foreground }}>/goal &lt;objective&gt;</Text>.
      </Text>

      {error ? (
        <Text style={{ color: theme.colors.statusDanger, fontSize: 12 }}>{error}</Text>
      ) : null}

      {goals === null ? (
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13 }}>Loading goals…</Text>
      ) : goals.length === 0 ? (
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13 }}>
          No goals yet. Goals are stored per agent on this host.
        </Text>
      ) : (
        goals.map((goal) => (
          <GoalRow
            key={goal.agentId}
            goal={goal}
            theme={theme}
            busy={busyAgentId === goal.agentId}
            onPause={() => void run(goal.agentId, pause)}
            onResume={() => void run(goal.agentId, resume)}
            onClear={() => void run(goal.agentId, clear)}
            onOpen={navigation ? () => navigation.openAgent({ agentId: goal.agentId }) : undefined}
          />
        ))
      )}
    </ScrollView>
  );
}

interface GoalRowProps {
  goal: Goal;
  theme: PluginScreenProps["theme"];
  busy: boolean;
  onPause(): void;
  onResume(): void;
  onClear(): void;
  onOpen?: () => void;
}

function GoalRow({ goal, theme, busy, onPause, onResume, onClear, onOpen }: GoalRowProps) {
  const agentTitle = goal.agentTitle ?? goal.agentId.slice(0, 8);
  const statusColor =
    goal.status === "active"
      ? theme.colors.accent
      : goal.status === "completed"
        ? theme.colors.statusSuccess
        : goal.status === "paused"
          ? theme.colors.statusWarning
          : theme.colors.statusDanger;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
        borderRadius: 10,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
          {agentTitle}
        </Text>
        <Text style={{ color: statusColor, fontSize: 12, fontWeight: "600" }}>
          {STATUS_LABEL[goal.status]}
        </Text>
      </View>

      <Text style={{ color: theme.colors.foreground, fontSize: 13, lineHeight: 18 }} numberOfLines={4}>
        {goal.objective}
      </Text>

      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
        auto-continue {goal.nudges}/{goal.maxNudges}
        {goal.blockedReason ? ` · ${goal.blockedReason}` : ""}
        {goal.pausedReason ? ` · ${goal.pausedReason}` : ""}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {goal.status === "active" ? (
          <ActionButton label="Pause" theme={theme} disabled={busy} onPress={onPause} />
        ) : null}
        {goal.status === "paused" ? (
          <ActionButton label="Resume" theme={theme} disabled={busy} onPress={onResume} />
        ) : null}
        <ActionButton label="Clear" theme={theme} disabled={busy} onPress={onClear} />
        {onOpen ? <ActionButton label="Open agent" theme={theme} disabled={false} onPress={onOpen} /> : null}
      </View>
    </View>
  );
}

interface ActionButtonProps {
  label: string;
  theme: PluginScreenProps["theme"];
  disabled: boolean;
  onPress(): void;
}

function ActionButton({ label, theme, disabled, onPress }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surface2 : theme.colors.surface0,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Text style={{ color: theme.colors.foreground, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}
