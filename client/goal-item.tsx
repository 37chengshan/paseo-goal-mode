import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { GoalItemData, GoalItemPhase, GoalStatus } from "../shared/goal";

interface PhaseMeta {
  label: string;
  tone: "accent" | "success" | "warning" | "danger" | "muted";
}

const PHASE_META: Record<GoalItemPhase, PhaseMeta> = {
  set: { label: "Goal set · 目标已设置", tone: "accent" },
  status: { label: "Goal status · 目标状态", tone: "accent" },
  nudge: { label: "Auto-continue · 自动续跑", tone: "warning" },
  complete: { label: "Goal complete · 目标已完成", tone: "success" },
  blocked: { label: "Goal blocked · 目标受阻", tone: "danger" },
  paused: { label: "Goal paused · 目标已暂停", tone: "warning" },
  resumed: { label: "Goal resumed · 目标已恢复", tone: "accent" },
  cleared: { label: "Goal cleared · 目标已清除", tone: "muted" },
  failed: { label: "Turn failed · 轮次失败", tone: "danger" },
  limit: { label: "Limit reached · 已达上限", tone: "danger" },
  notice: { label: "Notice · 提示", tone: "muted" },
};

const STATUS_LABEL: Record<GoalStatus, string> = {
  active: "active · 进行中",
  paused: "paused · 已暂停",
  completed: "completed · 已完成",
  blocked: "blocked · 受阻",
};

export function GoalItem({ item, theme }: PluginTimelineItemProps<GoalItemData>) {
  const data = item.data;
  const meta = PHASE_META[data.phase];
  const tone = {
    accent: theme.colors.accent,
    success: theme.colors.statusSuccess,
    warning: theme.colors.statusWarning,
    danger: theme.colors.statusDanger,
    muted: theme.colors.foregroundMuted,
  }[meta.tone];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderLeftWidth: 3,
          borderColor: theme.colors.border,
          borderLeftColor: tone,
          backgroundColor: theme.colors.surface1,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
          gap: 4,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        },
        label: { color: tone, fontSize: 12, fontWeight: "600" },
        counter: { color: theme.colors.foregroundMuted, fontSize: 11 },
        objective: { color: theme.colors.foreground, fontSize: 13, lineHeight: 18 },
        detail: { color: theme.colors.foregroundMuted, fontSize: 12, lineHeight: 16 },
      }),
    [theme, tone],
  );

  const counter =
    typeof data.nudges === "number" && typeof data.maxNudges === "number"
      ? `${data.nudges}/${data.maxNudges}`
      : data.phase === "limit" && typeof data.maxNudges === "number"
        ? `${data.maxNudges}/${data.maxNudges}`
        : null;

  const detailParts: string[] = [];
  if (data.status) {
    detailParts.push(STATUS_LABEL[data.status]);
  }
  if (data.reason) {
    detailParts.push(data.reason);
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>{meta.label}</Text>
        {counter ? <Text style={styles.counter}>auto-continue {counter}</Text> : null}
      </View>
      {data.objective ? (
        <Text style={styles.objective} numberOfLines={3}>
          {data.objective}
        </Text>
      ) : null}
      {detailParts.length > 0 ? (
        <Text style={styles.detail} numberOfLines={4}>
          {detailParts.join(" · ")}
        </Text>
      ) : null}
    </View>
  );
}
