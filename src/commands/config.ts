import { Command } from "commander";
import { loadConfig, setApiUrl, setCurrentCampaignId, getConfigPath } from "../lib/config.js";
import { success, error, info } from "../lib/output.js";

export function registerConfigCommands(program: Command): void {
  const config = program
    .command("config")
    .description("Manage CLI configuration");

  config
    .command("show")
    .description("Show current configuration")
    .action(() => {
      const cfg = loadConfig();
      info(`Config file: ${getConfigPath()}`);
      console.log(`  API URL: ${cfg.apiUrl}`);
      console.log(`  Current Campaign: ${cfg.currentCampaignId || "(not set)"}`);
      console.log(`  Token: ${cfg.token ? "(set)" : "(not set)"}`);
    });

  config
    .command("set")
    .description("Set a configuration value")
    .argument("<key>", "Configuration key (apiUrl, campaign)")
    .argument("<value>", "Value to set")
    .action((key, value) => {
      switch (key) {
        case "apiUrl":
        case "api-url":
        case "url":
          setApiUrl(value);
          success(`API URL set to: ${value}`);
          break;
        case "campaign":
        case "campaignId":
        case "campaign-id":
          setCurrentCampaignId(value);
          success(`Current campaign set to: ${value}`);
          break;
        default:
          error(`Unknown config key: ${key}`);
          console.log("\nAvailable keys:");
          console.log("  apiUrl     - API server URL");
          console.log("  campaign   - Current campaign ID");
          process.exit(1);
      }
    });

  config
    .command("local")
    .description("Switch to local development server (localhost:4002)")
    .action(() => {
      setApiUrl("http://localhost:4002");
      success("Switched to local development server: http://localhost:4002");
    });

  config
    .command("production")
    .alias("prod")
    .description("Switch to production server (shot-elixir.fly.dev)")
    .action(() => {
      setApiUrl("https://shot-elixir.fly.dev");
      success("Switched to production server: https://shot-elixir.fly.dev");
    });
}
