/**
 * Creates authenticated SDK Client instances from stored credentials.
 * Handles token refresh for OAuth2 accounts.
 */

import { Client } from "@xdevplatform/xdk";
import {
  getAccount,
  setAccount,
  type AuthCredential,
} from "./config.js";
import { refreshAccessToken } from "./oauth.js";

/**
 * Create an authenticated XDK Client from stored account credentials.
 * Automatically refreshes OAuth2 tokens if expired.
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
    return new Client({ bearerToken: auth.bearerToken });
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

      return new Client({ accessToken: result.accessToken });
    }

    return new Client({ accessToken: auth.accessToken });
  }

  throw new Error(`Unknown auth type: ${auth.type}`);
}
