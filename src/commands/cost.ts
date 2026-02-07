/**
 * `xc cost` — view API cost summary, daily breakdown, or raw request log.
 */

import { Command } from "commander";
import {
  loadUsageLog,
  computeSpend,
  HOUR,
  DAY,
  WEEK,
  MONTH,
} from "../lib/cost.js";

export function registerCostCommand(program: Command): void {
  const cost = program
    .command("cost")
    .description("Show API cost summary")
    .option("--daily", "Show daily breakdown")
    .option("--json", "Output raw JSON")
    .action((opts) => {
      const entries = loadUsageLog();

      if (entries.length === 0) {
        console.log("No API usage recorded yet.");
        return;
      }

      if (opts.json) {
        const summary = {
          "1h": computeSpend(entries, HOUR),
          "24h": computeSpend(entries, DAY),
          "7d": computeSpend(entries, WEEK),
          "30d": computeSpend(entries, MONTH),
          totalRequests: entries.length,
        };
        console.log(JSON.stringify(summary, null, 2));
        return;
      }

      // Daily breakdown: group entries by YYYY-MM-DD
      if (opts.daily) {
        const byDay = new Map<string, number>();
        for (const entry of entries) {
          const date = entry.timestamp.slice(0, 10);
          byDay.set(date, (byDay.get(date) ?? 0) + entry.estimatedCost);
        }

        console.log("Daily cost breakdown:\n");
        const sorted = [...byDay.entries()].sort((a, b) =>
          b[0].localeCompare(a[0]),
        );
        for (const [date, total] of sorted) {
          console.log(`  ${date}  $${total.toFixed(2)}`);
        }
        return;
      }

      // Default: time-window summary
      console.log("API cost summary:\n");
      console.log(`  Last hour:    $${computeSpend(entries, HOUR).toFixed(2)}`);
      console.log(`  Last 24h:     $${computeSpend(entries, DAY).toFixed(2)}`);
      console.log(`  Last 7 days:  $${computeSpend(entries, WEEK).toFixed(2)}`);
      console.log(
        `  Last 30 days: $${computeSpend(entries, MONTH).toFixed(2)}`,
      );
      console.log(`\n  Total requests: ${entries.length}`);
    });

  // xc cost log — raw request log
  cost
    .command("log")
    .description("Show raw request log")
    .option("--limit <n>", "Show last N entries", "20")
    .option("--json", "Output raw JSON")
    .action((opts) => {
      const entries = loadUsageLog();
      const limit = parseInt(opts.limit, 10);
      const recent = entries.slice(-limit);

      if (opts.json) {
        console.log(JSON.stringify(recent, null, 2));
        return;
      }

      if (recent.length === 0) {
        console.log("No API requests logged yet.");
        return;
      }

      console.log(`Recent API requests (last ${recent.length}):\n`);
      for (const entry of recent) {
        const ts = new Date(entry.timestamp).toLocaleString();
        console.log(
          `  ${ts}  ${entry.method.padEnd(6)} ${entry.endpoint}  $${entry.estimatedCost.toFixed(3)}`,
        );
      }
    });
}
