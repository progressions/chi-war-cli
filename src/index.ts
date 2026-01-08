#!/usr/bin/env node

import { Command } from "commander";
import { loginCommand, logoutCommand } from "./commands/login.js";
import { registerCharacterCommands } from "./commands/character.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerFactionCommands } from "./commands/faction.js";
import { registerPartyCommands } from "./commands/party.js";

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

// Character commands
registerCharacterCommands(program);

// Config commands
registerConfigCommands(program);

// Faction commands
registerFactionCommands(program);

// Party commands
registerPartyCommands(program);

// Parse and execute
program.parse();
