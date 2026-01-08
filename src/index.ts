#!/usr/bin/env node

import { Command } from "commander";
import { loginCommand, logoutCommand } from "./commands/login.js";
import { registerCampaignCommands } from "./commands/campaign.js";
import { registerCharacterCommands } from "./commands/character.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerFactionCommands } from "./commands/faction.js";
import { registerFightCommands } from "./commands/fight.js";
import { registerPartyCommands } from "./commands/party.js";
import { registerSiteCommands } from "./commands/site.js";

const program = new Command();

program
  .name("chiwar")
  .description("CLI for Chi War - Feng Shui 2 campaign manager")
  .version("0.1.0");

// Login command
program
  .command("login")
  .description("Authenticate with Chi War via browser")
  .action(loginCommand);

// Logout command
program
  .command("logout")
  .description("Clear saved authentication")
  .action(logoutCommand);

// Campaign commands
registerCampaignCommands(program);

// Character commands
registerCharacterCommands(program);

// Config commands
registerConfigCommands(program);

// Faction commands
registerFactionCommands(program);

// Fight commands
registerFightCommands(program);

// Party commands
registerPartyCommands(program);

// Site commands
registerSiteCommands(program);

// Parse and execute
program.parse();
