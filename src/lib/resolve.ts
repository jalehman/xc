/**
 * Helpers for resolving user IDs using the SDK client.
 * Caches authenticated user ID in config for future calls.
 */

import { getClient } from "./api.js";
import { getAccount, loadConfig, saveConfig } from "./config.js";

/**
 * Get the authenticated user's ID, using cached value or fetching via SDK.
 */
export async function resolveAuthenticatedUserId(
  accountName?: string,
): Promise<string> {
  const account = getAccount(accountName);
  if (account?.userId) {
    return account.userId;
  }

  // Fetch via SDK and cache the result
  const client = await getClient(accountName);
  const result = await client.users.getMe({ userFields: ["id"] });
  const userId = result.data?.id;
  if (!userId) {
    throw new Error("Could not resolve authenticated user ID");
  }

  // Cache for future use
  if (account) {
    const config = loadConfig();
    const name = accountName ?? config.defaultAccount;
    const stored = config.accounts[name];
    if (stored) {
      stored.userId = userId;
      stored.username = result.data?.username;
      saveConfig(config);
    }
  }

  return userId;
}

/**
 * Resolve a @username to a user ID via the SDK.
 */
export async function resolveUserId(
  username: string,
  accountName?: string,
): Promise<string> {
  const clean = username.replace(/^@/, "");
  const client = await getClient(accountName);
  const result = await client.users.getByUsername(clean);
  const userId = result.data?.id;
  if (!userId) {
    throw new Error(`User @${clean} not found`);
  }
  return userId;
}
