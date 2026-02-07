/**
 * Budget enforcement for API cost tracking.
 * Stores budget config in ~/.xc/budget.json.
 * Checks daily spend against configured limits before each API call.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { getConfigDir, ensureConfigDir } from "./config.js";
import { loadUsageLog, computeTodaySpend, estimateCost } from "./cost.js";

export type BudgetAction = "block" | "warn" | "confirm";

export interface BudgetConfig {
  daily?: number;
  action: BudgetAction;
}

/** Path to budget configuration file. */
export function getBudgetPath(): string {
  return path.join(getConfigDir(), "budget.json");
}

/** Load budget config, returning defaults if none exists. */
export function loadBudget(): BudgetConfig {
  const budgetPath = getBudgetPath();
  if (!fs.existsSync(budgetPath)) {
    return { action: "warn" };
  }
  const raw = fs.readFileSync(budgetPath, "utf-8");
  return JSON.parse(raw) as BudgetConfig;
}

/** Save budget config to disk. */
export function saveBudget(config: BudgetConfig): void {
  ensureConfigDir();
  fs.writeFileSync(getBudgetPath(), JSON.stringify(config, null, 2) + "\n");
}

/** Remove budget configuration entirely. */
export function resetBudget(): void {
  const budgetPath = getBudgetPath();
  if (fs.existsSync(budgetPath)) {
    fs.unlinkSync(budgetPath);
  }
}

/** Prompt the user for y/N confirmation on stderr. */
async function confirmPrompt(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

/**
 * Check whether an API call would exceed the daily budget.
 * Behavior depends on the configured action:
 *   block   — throw, refusing the call
 *   warn    — print warning to stderr, proceed
 *   confirm — prompt user, throw if declined
 */
export async function checkBudget(endpoint: string): Promise<void> {
  const budget = loadBudget();
  if (!budget.daily) return;

  const entries = loadUsageLog();
  const todaySpend = computeTodaySpend(entries);
  const callCost = estimateCost(endpoint);

  if (todaySpend + callCost <= budget.daily) return;

  const msg =
    `Daily budget $${budget.daily.toFixed(2)} exceeded ` +
    `(today: $${todaySpend.toFixed(2)} + $${callCost.toFixed(2)})`;

  switch (budget.action) {
    case "block":
      throw new Error(
        `${msg}. Use 'xc budget reset' or increase your budget.`,
      );

    case "warn":
      console.error(`Warning: ${msg}`);
      break;

    case "confirm": {
      const proceed = await confirmPrompt(`${msg}. Continue?`);
      if (!proceed) {
        throw new Error("Cancelled by user.");
      }
      break;
    }
  }
}
