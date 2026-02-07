/**
 * Creates authenticated SDK Client instances from stored credentials.
 * Handles token refresh for OAuth2 accounts.
 * Wraps the client with a Proxy that logs API calls and enforces budgets.
 */

import { Client } from "@xdevplatform/xdk";
import {
  getAccount,
  setAccount,
  type AuthCredential,
} from "./config.js";
import { refreshAccessToken } from "./oauth.js";
import { logApiCall } from "./cost.js";
import { checkBudget } from "./budget.js";

/**
 * Wrap an SDK Client so every namespace method call (e.g. client.posts.searchRecent)
 * is intercepted to check budget limits and log usage before forwarding.
 */
function wrapClient(client: Client): Client {
  return new Proxy(client, {
    get(target, prop) {
      const value = (target as unknown as Record<string | symbol, unknown>)[prop];

      // Only proxy object namespaces (posts, users, usage, etc.)
      if (value && typeof value === "object" && typeof prop === "string") {
        return new Proxy(value as Record<string | symbol, unknown>, {
          get(nsTarget, nsProp) {
            const nsValue = nsTarget[nsProp];

            // Wrap functions to add budget check + logging
            if (typeof nsValue === "function" && typeof nsProp === "string") {
              return async (...args: unknown[]) => {
                const endpoint = `${prop}.${nsProp}`;
                await checkBudget(endpoint);
                logApiCall(endpoint);
                return (nsValue as (...a: unknown[]) => unknown).apply(
                  nsTarget,
                  args,
                );
              };
            }
            return nsValue;
          },
        });
      }
      return value;
    },
  }) as Client;
}

/**
 * Create an authenticated XDK Client from stored account credentials.
 * Automatically refreshes OAuth2 tokens if expired.
 * Returns a proxy-wrapped client that logs usage and enforces budgets.
 */
export async function getClient(accountName?: string): Promise<Client> {
  const account = getAccount(accountName);
  if (!account) {
    throw new Error(
      `No account configured${accountName ? ` (${accountName})` : ""}. Run: xc auth login`,
    );
  }

  const { auth } = account;

  // Bearer token — straightforward
  if (auth.type === "bearer") {
    if (!auth.bearerToken) {
      throw new Error("Bearer token is empty. Run: xc auth token <TOKEN>");
    }
    return wrapClient(new Client({ bearerToken: auth.bearerToken }));
  }

  // OAuth 2.0 — check expiry, refresh if needed
  if (auth.type === "oauth2") {
    if (!auth.accessToken) {
      throw new Error("No access token. Run: xc auth login");
    }

    // Refresh if token is expired or within 60s of expiry
    const expiresAt = auth.expiresAt ?? 0;
    if (Date.now() >= expiresAt - 60_000) {
      if (!auth.refreshToken || !auth.clientId) {
        throw new Error(
          "Token expired and no refresh token available. Run: xc auth login",
        );
      }

      console.error("Refreshing access token...");
      const result = await refreshAccessToken({
        clientId: auth.clientId,
        refreshToken: auth.refreshToken,
      });

      // Persist refreshed credentials
      const updatedAuth: AuthCredential = {
        ...auth,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? auth.refreshToken,
        expiresAt: result.expiresAt,
      };
      const name = accountName ?? "default";
      setAccount(name, { ...account, auth: updatedAuth });

      return wrapClient(new Client({ accessToken: result.accessToken }));
    }

    return wrapClient(new Client({ accessToken: auth.accessToken }));
  }

  throw new Error(`Unknown auth type: ${auth.type}`);
}
