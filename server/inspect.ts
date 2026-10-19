/**
 * Copied verbatim from the official Paseo example plugin `lifecycle-actions`
 * (plugin-examples/lifecycle-actions/server/inspect.ts @ 5acfbb3777d7fbac634f4ed83aefed56fb49cb8f, Apache-2.0).
 */
import type { AgentTimelineItem } from "@getpaseo/protocol/agent-types";

export function latestOutputText(timeline: readonly AgentTimelineItem[]): string {
  let output = "";
  for (const item of timeline) {
    if (item.type === "user_message") {
      output = "";
    } else if ("text" in item && typeof item.text === "string") {
      output += item.text;
    } else {
      output += JSON.stringify(item) + "\n";
    }
  }
  return output;
}
