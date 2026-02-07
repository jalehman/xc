/**
 * `xc budget` — manage daily API cost budget.
 * Subcommands: set, show, reset.
 */

import { Command } from "commander";
import {
  loadBudget,
  saveBudget,
  resetBudget,
  type BudgetAction,
} from "../lib/budget.js";
import { loadUsageLog, computeTodaySpend } from "../lib/cost.js";

const VALID_ACTIONS: BudgetAction[] = ["block", "warn", "confirm"];

export function registerBudgetCommand(program: Command): void {
  const budget = program
    .command("budget")
    .description("Manage API cost budget");

  // xc budget set --daily 2.00 --action warn
  budget
    .command("set")
    .description("Set daily budget limit")
    .requiredOption("--daily <amount>", "Daily budget in dollars")
    .option(
      "--action <action>",
      "Action when exceeded: block, warn, confirm",
      "warn",
    )
    .action((opts) => {
      const daily = parseFloat(opts.daily);
      if (isNaN(daily) || daily <= 0) {
        console.error("Error: --daily must be a positive number.");
        process.exit(1);
      }

      const action = opts.action as BudgetAction;
      if (!VALID_ACTIONS.includes(action)) {
        console.error("Error: --action must be block, warn, or confirm.");
        process.exit(1);
      }

      saveBudget({ daily, action });
      console.log(`Budget set: $${daily.toFixed(2)}/day (action: ${action})`);
    });

  // xc budget show
  budget
    .command("show")
    .description("Show current budget and today's spend")
    .action(() => {
      const config = loadBudget();
      const entries = loadUsageLog();
      const todaySpend = computeTodaySpend(entries);

      if (!config.daily) {
        console.log("No budget configured.\n");
        console.log("Set one with: xc budget set --daily 2.00");
        return;
      }

      const remaining = Math.max(0, config.daily - todaySpend);
      const pct = ((todaySpend / config.daily) * 100).toFixed(0);

      console.log("Budget:\n");
      console.log(`  Daily limit: $${config.daily.toFixed(2)}`);
      console.log(`  Today spent: $${todaySpend.toFixed(2)} (${pct}%)`);
      console.log(`  Remaining:   $${remaining.toFixed(2)}`);
      console.log(`  Action:      ${config.action}`);
    });

  // xc budget reset
  budget
    .command("reset")
    .description("Remove budget configuration")
    .action(() => {
      resetBudget();
      console.log("Budget configuration removed.");
    });
}
