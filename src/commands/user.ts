import { Command } from "commander";
import { getClient } from "../lib/api.js";

const USER_FIELDS = ["created_at", "description", "public_metrics"];

export function registerUserCommand(program: Command): void {
  program
    .command("user <username>")
    .description("Look up a user by @username")
    .option("--json", "Output raw JSON")
    .option("--account <name>", "Account to use")
    .action(async (username: string, opts) => {
      try {
        const clean = username.replace(/^@/, "");
        const client = await getClient(opts.account);

        const result = await client.users.getByUsername(clean, {
          userFields: USER_FIELDS,
        });

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        const data = result.data;
        if (!data) {
          console.error(`User @${clean} not found.`);
          process.exit(1);
        }

        const m = data.publicMetrics as Record<string, number> | undefined;

        console.log(`@${data.username} (${data.name})`);
        if (data.description) console.log(`  ${data.description}`);
        if (m) {
          console.log(
            `  ${(m.followersCount ?? 0).toLocaleString()} followers · ${(m.followingCount ?? 0).toLocaleString()} following · ${(m.tweetCount ?? 0).toLocaleString()} posts`,
          );
        }
        if (data.createdAt) {
          console.log(
            `  Joined ${new Date(data.createdAt).toLocaleDateString()}`,
          );
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
