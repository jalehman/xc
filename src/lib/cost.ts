/**
 * API request cost tracking.
 * Logs every API call to ~/.xc/usage.jsonl with timestamp,
 * endpoint, HTTP method, and estimated dollar cost.
 */

import fs from "node:fs";
import path from "node:path";
import { getConfigDir, ensureConfigDir } from "./config.js";

/** Single usage log entry written to usage.jsonl. */
export interface UsageEntry {
  timestamp: string;
  endpoint: string;
  method: string;
  estimatedCost: number;
}

/**
 * Estimated cost per SDK endpoint (in dollars).
 * These are rough estimates based on X API pricing tiers.
 */
const COST_MAP: Record<string, number> = {
  "posts.searchRecent": 0.01,
  "posts.searchAll": 0.02,
  "posts.create": 0.01,
  "users.getMe": 0.005,
  "users.getByUsername": 0.005,
  "users.getPosts": 0.005,
  "users.getTimeline": 0.005,
  "users.likePost": 0.005,
  "users.unlikePost": 0.005,
  "usage.get": 0.0,
};

const DEFAULT_COST = 0.005;

/** Inferred HTTP method per endpoint. Defaults to GET. */
const METHOD_MAP: Record<string, string> = {
  "posts.create": "POST",
  "users.likePost": "POST",
  "users.unlikePost": "DELETE",
};

/** Get estimated dollar cost for an endpoint. */
export function estimateCost(endpoint: string): number {
  return COST_MAP[endpoint] ?? DEFAULT_COST;
}

/** Infer the HTTP method for an endpoint. */
export function inferMethod(endpoint: string): string {
  return METHOD_MAP[endpoint] ?? "GET";
}

/** Path to the usage log file. */
export function getUsageLogPath(): string {
  return path.join(getConfigDir(), "usage.jsonl");
}

/** Append a usage entry to the JSONL log. */
export function logApiCall(endpoint: string): void {
  ensureConfigDir();
  const entry: UsageEntry = {
    timestamp: new Date().toISOString(),
    endpoint,
    method: inferMethod(endpoint),
    estimatedCost: estimateCost(endpoint),
  };
  fs.appendFileSync(getUsageLogPath(), JSON.stringify(entry) + "\n");
}

/** Read all usage entries from the log file. */
export function loadUsageLog(): UsageEntry[] {
  const logPath = getUsageLogPath();
  if (!fs.existsSync(logPath)) return [];

  const raw = fs.readFileSync(logPath, "utf-8").trim();
  if (!raw) return [];

  const entries: UsageEntry[] = [];
  for (const line of raw.split("\n")) {
    try {
      entries.push(JSON.parse(line) as UsageEntry);
    } catch {
      // Skip malformed lines
    }
  }
  return entries;
}

/** Sum estimated costs for entries within a time window (ms from now). */
export function computeSpend(entries: UsageEntry[], windowMs: number): number {
  const cutoff = Date.now() - windowMs;
  let total = 0;
  for (const entry of entries) {
    if (new Date(entry.timestamp).getTime() >= cutoff) {
      total += entry.estimatedCost;
    }
  }
  return total;
}

/** Sum estimated costs for entries from midnight today. */
export function computeTodaySpend(entries: UsageEntry[]): number {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const cutoff = midnight.getTime();

  let total = 0;
  for (const entry of entries) {
    if (new Date(entry.timestamp).getTime() >= cutoff) {
      total += entry.estimatedCost;
    }
  }
  return total;
}

/** Time window constants (milliseconds). */
export const HOUR = 3_600_000;
export const DAY = 86_400_000;
export const WEEK = 7 * DAY;
export const MONTH = 30 * DAY;

/** Format a dollar amount as $X.XX. */
function fmt(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Build the compact cost footer line.
 * Returns empty string if no usage has been recorded.
 */
export function formatCostFooter(): string {
  const entries = loadUsageLog();
  if (entries.length === 0) return "";

  const h1 = computeSpend(entries, HOUR);
  const h24 = computeSpend(entries, DAY);
  const d7 = computeSpend(entries, WEEK);
  const d30 = computeSpend(entries, MONTH);

  return `Cost: ${fmt(h1)} (1h) \u00b7 ${fmt(h24)} (24h) \u00b7 ${fmt(d7)} (7d) \u00b7 ${fmt(d30)} (30d)`;
}
