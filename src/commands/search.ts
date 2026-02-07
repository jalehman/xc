import { Command } from "commander";
import { getClient } from "../lib/api.js";
import { buildUserMap, formatTweetList } from "../lib/format.js";

const TWEET_FIELDS = ["created_at", "public_metrics", "author_id"];
const EXPANSIONS = ["author_id"];
const USER_FIELDS = ["name", "username"];

export function registerSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .description("Search posts (recent 7 days, or full archive with --archive)")
    .option("--archive", "Search full archive instead of recent")
    .option("--limit <n>", "Max results (10-100, or 10-500 for archive)", "10")
    .option("--json", "Output raw JSON")
    .option("--account <name>", "Account to use")
    .action(async (query: string, opts) => {
      try {
        const client = await getClient(opts.account);
        const searchOpts = {
          tweetFields: TWEET_FIELDS,
          expansions: EXPANSIONS,
          userFields: USER_FIELDS,
          maxResults: parseInt(opts.limit, 10),
        };

        const result = opts.archive
          ? await client.posts.searchAll(query, searchOpts)
          : await client.posts.searchRecent(query, searchOpts);

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        const tweets = result.data ?? [];
        if (tweets.length === 0) {
          console.log("No results found.");
          return;
        }

        const usersById = buildUserMap(result.includes?.users);
        console.log(formatTweetList(tweets, usersById));

        // Show result count summary
        const meta = result.meta as Record<string, unknown> | undefined;
        const count = (meta?.resultCount as number) ?? tweets.length;
        console.log(`\n— ${count} result${count !== 1 ? "s" : ""}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
