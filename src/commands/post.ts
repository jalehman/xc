import { Command } from "commander";
import { getClient } from "../lib/api.js";

export function registerPostCommand(program: Command): void {
  program
    .command("post <text>")
    .description("Create a post")
    .option("--reply <id>", "Reply to a post by ID")
    .option("--quote <id>", "Quote a post by ID")
    .option("--json", "Output raw JSON")
    .option("--account <name>", "Account to use")
    .action(async (text: string, opts) => {
      try {
        const client = await getClient(opts.account);

        // Build the create request
        const body: Record<string, unknown> = { text };
        if (opts.reply) {
          body.reply = { inReplyToTweetId: opts.reply };
        }
        if (opts.quote) {
          body.quoteTweetId = opts.quote;
        }

        const result = await client.posts.create(body as Parameters<typeof client.posts.create>[0]);

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        const data = result.data as { id?: string; text?: string } | undefined;
        if (data?.id) {
          console.log(`Posted (id: ${data.id})`);
          if (data.text) console.log(`  ${data.text}`);
        } else {
          console.log("Post created.");
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
