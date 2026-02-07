import { Command } from "commander";
import { Client } from "@xdevplatform/xdk";
import open from "open";
import {
  getConfigPath,
  loadConfig,
  saveConfig,
  setAccount,
  setDefaultAccount,
} from "../lib/config.js";
import { runOAuthFlow } from "../lib/oauth.js";

export function registerAuthCommand(program: Command): void {
  const auth = program.command("auth").description("Manage authentication");

  // xc auth login
  auth
    .command("login")
    .description("Authenticate with X via OAuth 2.0 (PKCE)")
    .option("--account <name>", "Account name", "default")
    .option("--client-id <id>", "OAuth 2.0 Client ID (or set XC_CLIENT_ID)")
    .option("--port <port>", "Local callback port", "3391")
    .action(async (opts) => {
      const clientId = opts.clientId ?? process.env.XC_CLIENT_ID;
      if (!clientId) {
        console.error("Error: OAuth Client ID required.");
        console.error("");
        console.error("Get one at https://console.x.com → Apps → Create App");
        console.error("");
        console.error("Then either:");
        console.error("  xc auth login --client-id <YOUR_CLIENT_ID>");
        console.error("  export XC_CLIENT_ID=<YOUR_CLIENT_ID>");
        process.exit(1);
      }

      console.log("Starting OAuth 2.0 flow...");
      console.log("A browser window will open for authorization.\n");

      try {
        const result = await runOAuthFlow({
          clientId,
          port: parseInt(opts.port, 10),
          onOpenUrl: async (url) => {
            console.log("Opening browser...");
            console.log(`If it doesn't open, visit:\n${url}\n`);
            await open(url);
          },
        });

        // Save credentials
        setAccount(opts.account, {
          name: opts.account,
          auth: {
            type: "oauth2",
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresAt: result.expiresAt,
            clientId,
          },
        });

        // Fetch user info using SDK client directly with new token
        try {
          const client = new Client({ accessToken: result.accessToken });
          const me = await client.users.getMe({ userFields: ["username"] });

          if (me.data) {
            const config = loadConfig();
            const account = config.accounts[opts.account];
            if (account) {
              account.userId = me.data.id;
              account.username = me.data.username;
              saveConfig(config);
            }

            console.log(`\n✓ Authenticated as @${me.data.username} (${me.data.name})`);
            console.log(`  Account: ${opts.account}`);
            console.log(`  Scopes: ${result.scopes}`);
          } else {
            console.log(`\n✓ Authenticated (account: ${opts.account})`);
            console.log(`  Scopes: ${result.scopes}`);
          }
        } catch {
          console.log(`\n✓ Authenticated (account: ${opts.account})`);
          console.log(`  Scopes: ${result.scopes}`);
          console.log("  Note: Could not fetch user info.");
        }

        // Set as default if it's the first account
        const config = loadConfig();
        if (Object.keys(config.accounts).length === 1) {
          setDefaultAccount(opts.account);
          console.log(`  Set as default account.`);
        }

        console.log(`\nConfig: ${getConfigPath()}`);
      } catch (err) {
        console.error(`\nAuth failed: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });

  // xc auth token
  auth
    .command("token <bearer-token>")
    .description("Set a Bearer token for app-only auth")
    .option("--account <name>", "Account name", "default")
    .action((bearerToken: string, opts) => {
      setAccount(opts.account, {
        name: opts.account,
        auth: {
          type: "bearer",
          bearerToken,
        },
      });

      // Set as default if first account
      const config = loadConfig();
      if (Object.keys(config.accounts).length === 1) {
        setDefaultAccount(opts.account);
      }

      console.log(`✓ Bearer token saved (account: ${opts.account})`);
      console.log(`  Config: ${getConfigPath()}`);
      console.log(`\nTest with: xc whoami`);
    });

  // xc auth status
  auth
    .command("status")
    .description("Show current auth status")
    .action(() => {
      const config = loadConfig();
      const accountNames = Object.keys(config.accounts);

      if (accountNames.length === 0) {
        console.log("No accounts configured.\n");
        console.log("Get started:");
        console.log("  xc auth login          # OAuth 2.0 (read + write)");
        console.log("  xc auth token <TOKEN>  # Bearer token (read only)");
        return;
      }

      console.log(`Accounts (${accountNames.length}):\n`);
      for (const name of accountNames) {
        const account = config.accounts[name]!;
        const isDefault = name === config.defaultAccount;
        const marker = isDefault ? " (default)" : "";
        const { auth } = account;

        const username = account.username ? `@${account.username}` : "unknown";
        const type = auth.type === "oauth2" ? "OAuth 2.0" : "Bearer";

        let status = "✓";
        if (auth.type === "oauth2" && auth.expiresAt) {
          const remaining = auth.expiresAt - Date.now();
          if (remaining <= 0) {
            status = auth.refreshToken ? "⟳ expired (has refresh)" : "✗ expired";
          } else {
            const hours = Math.floor(remaining / 3_600_000);
            const mins = Math.floor((remaining % 3_600_000) / 60_000);
            status = `✓ ${hours}h${mins}m remaining`;
          }
        }

        console.log(`  ${name}${marker}`);
        console.log(`    User: ${username}`);
        console.log(`    Auth: ${type} — ${status}`);
        console.log("");
      }
    });

  // xc auth switch
  auth
    .command("switch <account>")
    .description("Switch default account")
    .action((account: string) => {
      const config = loadConfig();
      if (!config.accounts[account]) {
        console.error(`Account "${account}" not found.`);
        console.error(`Available: ${Object.keys(config.accounts).join(", ")}`);
        process.exit(1);
      }

      setDefaultAccount(account);
      const username = config.accounts[account]?.username;
      console.log(
        `✓ Switched to ${account}${username ? ` (@${username})` : ""}`,
      );
    });

  // xc auth logout
  auth
    .command("logout")
    .description("Remove an account")
    .option("--account <name>", "Account to remove (default: current)")
    .action((opts) => {
      const config = loadConfig();
      const name = opts.account ?? config.defaultAccount;

      if (!config.accounts[name]) {
        console.error(`Account "${name}" not found.`);
        process.exit(1);
      }

      delete config.accounts[name];

      // If we removed the default, pick another
      if (config.defaultAccount === name) {
        const remaining = Object.keys(config.accounts);
        config.defaultAccount = remaining[0] ?? "default";
      }

      saveConfig(config);
      console.log(`✓ Removed account "${name}"`);
    });
}
