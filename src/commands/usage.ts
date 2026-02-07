import { Command } from "commander";
import { getClient } from "../lib/api.js";

interface DailyUsageEntry {
  date: string;
  usage: Array<{
    app?: { appId?: string; appName?: string };
    tweets: number;
  }>;
}

export function registerUsageCommand(program: Command): void {
  program
    .command("usage")
    .description("Show API usage stats")
    .option("--json", "Output raw JSON")
    .option("--account <name>", "Account to use")
    .action(async (opts) => {
      try {
        const client = await getClient(opts.account);
        const result = await client.usage.get();

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        const data = result.data as Record<string, unknown> | undefined;
        if (!data) {
          console.log("No usage data available.");
          return;
        }

        // Show cap reset day if present
        if (data.capResetDay) {
          console.log(`Cap resets on day ${data.capResetDay} of each month\n`);
        }

        // Summarize recent daily usage
        const days = (data.dailyProjectUsage ?? []) as DailyUsageEntry[];
        if (days.length === 0) {
          console.log("No daily usage data available.");
          return;
        }

        console.log("Daily tweet usage:\n");
        for (const day of days) {
          const date = new Date(day.date).toLocaleDateString();
          const total = day.usage.reduce((sum, u) => sum + u.tweets, 0);
          console.log(`  ${date}: ${total.toLocaleString()} tweets`);

          // Per-app breakdown if multiple apps
          if (day.usage.length > 1) {
            for (const u of day.usage) {
              const appName = u.app?.appName ?? "unknown";
              console.log(`    ${appName}: ${u.tweets.toLocaleString()}`);
            }
          }
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
