import { Command } from "commander";
import { getClient } from "../lib/api.js";

const USER_FIELDS = [
  "created_at",
  "description",
  "public_metrics",
  "verified",
  "location",
  "url",
  "profile_image_url",
];

export function registerWhoamiCommand(program: Command): void {
  program
    .command("whoami")
    .description("Show the authenticated user")
    .option("--account <name>", "Account to check")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      try {
        const client = await getClient(opts.account);
        const result = await client.users.getMe({ userFields: USER_FIELDS });

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        const data = result.data;
        if (!data) {
          console.error("Could not fetch user info.");
          process.exit(1);
        }

        const m = data.publicMetrics as Record<string, number> | undefined;

        console.log(`@${data.username} (${data.name})`);
        if (data.description) console.log(`  ${data.description}`);
        if (data.location) console.log(`  📍 ${data.location}`);
        if (data.url) console.log(`  🔗 ${data.url}`);
        if (data.verified) console.log(`  ✓ Verified`);
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
