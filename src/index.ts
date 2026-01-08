#!/usr/bin/env node

import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { registerCharacterCommands } from "./commands/character.js";

const program = new Command();

program
  .name("chiwar")
  .description("CLI for Chi War - Feng Shui 2 campaign manager")
  .version("0.1.0");

// Login command
program
  .command("login")
  .description("Authenticate with Chi War")
  .action(loginCommand);

// Character commands
registerCharacterCommands(program);

// Parse and execute
program.parse();
