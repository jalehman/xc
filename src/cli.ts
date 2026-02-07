#!/usr/bin/env node

import { Command } from "commander";
import { registerAuthCommand } from "./commands/auth.js";
import { registerBudgetCommand } from "./commands/budget.js";
import { registerCostCommand } from "./commands/cost.js";
import { registerLikeCommand, registerUnlikeCommand } from "./commands/like.js";
import { registerPostCommand } from "./commands/post.js";
import { registerSearchCommand } from "./commands/search.js";
import { registerTimelineCommand } from "./commands/timeline.js";
import { registerUsageCommand } from "./commands/usage.js";
import { registerUserCommand } from "./commands/user.js";
import { registerWhoamiCommand } from "./commands/whoami.js";
import { formatCostFooter } from "./lib/cost.js";

const program = new Command();

program
  .name("xc")
  .description("CLI client for the X API v2")
  .version("0.1.0")
  .option("--quiet", "Suppress cost footer");

registerAuthCommand(program);
registerWhoamiCommand(program);
registerSearchCommand(program);
registerPostCommand(program);
registerUserCommand(program);
registerTimelineCommand(program);
registerLikeCommand(program);
registerUnlikeCommand(program);
registerUsageCommand(program);
registerCostCommand(program);
registerBudgetCommand(program);

// Show cost footer after every command (unless --quiet)
program.hook("postAction", () => {
  const opts = program.opts();
  if (opts.quiet) return;

  const footer = formatCostFooter();
  if (footer) {
    console.error(`\n${footer}`);
  }
});

program.parse();
