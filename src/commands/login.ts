import inquirer from "inquirer";
import { signIn } from "../lib/api.js";
import { setToken, getToken } from "../lib/config.js";
import { success, error, info } from "../lib/output.js";

export async function loginCommand(): Promise<void> {
  // Check if already logged in
  const existingToken = getToken();
  if (existingToken) {
    const { confirmLogout } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmLogout",
        message: "You are already logged in. Log in again?",
        default: false,
      },
    ]);
    if (!confirmLogout) {
      info("Login cancelled.");
      return;
    }
  }

  // Prompt for credentials
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "email",
      message: "Email:",
      validate: (input: string) =>
        input.includes("@") ? true : "Please enter a valid email",
    },
    {
      type: "password",
      name: "password",
      message: "Password:",
      mask: "*",
      validate: (input: string) =>
        input.length > 0 ? true : "Password is required",
    },
  ]);

  try {
    const { user, token } = await signIn(answers.email, answers.password);
    setToken(token);

    const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
    success(`Logged in as ${name}`);

    if (user.gamemaster) {
      info("You have gamemaster privileges.");
    }
  } catch (err) {
    error(err instanceof Error ? err.message : "Login failed");
    process.exit(1);
  }
}
