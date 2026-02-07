/**
 * OAuth 2.0 PKCE flow using the XDK SDK.
 * Handles authorization, token exchange, and token refresh.
 */

import crypto from "node:crypto";
import http from "node:http";
import { URL } from "node:url";
import {
  OAuth2,
  generateCodeVerifier,
  type OAuth2Token,
} from "@xdevplatform/xdk";

export type { OAuth2Token };

const SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "follows.read",
  "follows.write",
  "like.read",
  "like.write",
  "list.read",
  "list.write",
  "bookmark.read",
  "bookmark.write",
  "offline.access",
];

export interface OAuthFlowResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string;
}

/**
 * Run the OAuth 2.0 PKCE flow:
 * 1. Start a local HTTP server to receive the callback
 * 2. Open the browser to X's authorize URL
 * 3. Exchange the authorization code for tokens via the SDK
 */
export async function runOAuthFlow(params: {
  clientId: string;
  port?: number;
  onOpenUrl: (url: string) => void | Promise<void>;
}): Promise<OAuthFlowResult> {
  const { clientId, port = 3391 } = params;
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  // Configure SDK OAuth2 handler
  const oauth2 = new OAuth2({
    clientId,
    redirectUri,
    scope: SCOPES,
  });

  // Generate PKCE verifier and let SDK compute the challenge
  const codeVerifier = generateCodeVerifier();
  await oauth2.setPkceParameters(codeVerifier);

  // Generate random state for CSRF protection
  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = await oauth2.getAuthorizationUrl(state);

  // Wait for the OAuth callback on our local server
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const receivedState = url.searchParams.get("state");
      const receivedCode = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Authorization failed</h1><p>You can close this window.</p></body></html>",
        );
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (receivedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<html><body><h1>State mismatch</h1></body></html>");
        server.close();
        reject(new Error("OAuth state mismatch"));
        return;
      }

      if (!receivedCode) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<html><body><h1>No code received</h1></body></html>");
        server.close();
        reject(new Error("No authorization code received"));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<html><body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #15202b; color: #e7e9ea;">
          <div style="text-align: center;">
            <h1>✓ Authorized</h1>
            <p>You can close this window and return to your terminal.</p>
          </div>
        </body></html>`,
      );
      server.close();
      resolve(receivedCode);
    });

    server.listen(port, "127.0.0.1", () => {
      params.onOpenUrl(authUrl);
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth flow timed out (2 minutes)"));
    }, 120_000);
  });

  // Exchange the authorization code for tokens via SDK
  const tokens = await oauth2.exchangeCode(code, codeVerifier);

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scopes: tokens.scope ?? "",
  };
}

/**
 * Refresh an expired access token using the SDK OAuth2 handler.
 */
export async function refreshAccessToken(params: {
  clientId: string;
  refreshToken: string;
}): Promise<OAuthFlowResult> {
  const { clientId, refreshToken } = params;

  const oauth2 = new OAuth2({
    clientId,
    redirectUri: "http://127.0.0.1:3391/callback",
  });

  const tokens = await oauth2.refreshToken(refreshToken);

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scopes: tokens.scope ?? "",
  };
}
