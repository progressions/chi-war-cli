import open from "open";
import { startCliAuth, pollCliAuth } from "../lib/api.js";
import { setToken, getToken, clearToken } from "../lib/config.js";
import { success, error, info, warn } from "../lib/output.js";

const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const MAX_POLL_ATTEMPTS = 300; // 10 minutes max (600s / 2s)

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loginCommand(): Promise<void> {
  // Check if already logged in
  const existingToken = getToken();
  if (existingToken) {
    warn("You are already logged in. Logging in again will replace the existing session.");
  }

  info("Starting browser authentication...");

  try {
    // 1. Start the auth flow - get a code
    const { code, url, expires_in } = await startCliAuth();

    info(`Authorization code: ${code}`);
    info(`Opening browser to authorize...`);
    info(`If browser doesn't open, visit: ${url}`);

    // 2. Open the browser
    await open(url);

    // 3. Poll for approval
    info("\nWaiting for browser authorization...");
    info("(Press Ctrl+C to cancel)\n");

    let attempts = 0;
    let dotCount = 0;

    while (attempts < MAX_POLL_ATTEMPTS) {
      const result = await pollCliAuth(code);

      if (result.status === "approved" && result.token && result.user) {
        // Clear the dots line
        process.stdout.write("\r" + " ".repeat(50) + "\r");

        // Save the token
        setToken(result.token);

        const name =
          [result.user.first_name, result.user.last_name].filter(Boolean).join(" ") ||
          result.user.email;

        success(`\nLogged in as ${name}`);

        if (result.user.gamemaster) {
          info("You have gamemaster privileges.");
        }

        return;
      }

      if (result.status === "expired") {
        error("\nAuthorization code expired. Please try again.");
        process.exit(1);
      }

      // Still pending - show progress dots
      dotCount = (dotCount + 1) % 4;
      const dots = ".".repeat(dotCount + 1);
      process.stdout.write(`\rWaiting for approval${dots}   `);

      attempts++;
      await sleep(POLL_INTERVAL_MS);
    }

    // Timeout
    error("\nAuthentication timed out. Please try again.");
    process.exit(1);
  } catch (err) {
    error(err instanceof Error ? err.message : "Login failed");
    process.exit(1);
  }
}

export async function logoutCommand(): Promise<void> {
  const existingToken = getToken();
  if (!existingToken) {
    info("You are not logged in.");
    return;
  }

  clearToken();
  success("Logged out successfully.");
}
