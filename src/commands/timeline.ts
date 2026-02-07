import { Command } from "commander";
import { getClient } from "../lib/api.js";
import { buildUserMap, formatTweetList } from "../lib/format.js";
import { resolveAuthenticatedUserId, resolveUserId } from "../lib/resolve.js";

const TWEET_FIELDS = ["created_at", "public_metrics", "author_id"];
const EXPANSIONS = ["author_id"];
const USER_FIELDS = ["name", "username"];

export function registerTimelineCommand(program: Command): void {
  program
    .command("timeline [username]")
    .description(
      "View home timeline, or a user's posts with @username argument",
    )
    .option("--limit <n>", "Max results (1-100)", "20")
    .option("--json", "Output raw JSON")
    .option("--account <name>", "Account to use")
    .action(async (username: string | undefined, opts) => {
      try {
        const client = await getClient(opts.account);
        const fieldOpts = {
          tweetFields: TWEET_FIELDS,
          expansions: EXPANSIONS,
          userFields: USER_FIELDS,
          maxResults: parseInt(opts.limit, 10),
        };

        let result;

        if (username) {
          // User timeline: fetch their posts
          const userId = await resolveUserId(username, opts.account);
          result = await client.users.getPosts(userId, fieldOpts);
        } else {
          // Home timeline: reverse-chronological feed
          const myId = await resolveAuthenticatedUserId(opts.account);
          result = await client.users.getTimeline(myId, fieldOpts);
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        const tweets = result.data ?? [];
        if (tweets.length === 0) {
          console.log("No posts found.");
          return;
        }

        const usersById = buildUserMap(result.includes?.users);

        // Header
        if (username) {
          const clean = username.replace(/^@/, "");
          console.log(`Posts from @${clean}:\n`);
        } else {
          console.log("Home timeline:\n");
        }

        console.log(formatTweetList(tweets, usersById));
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
