import { Command } from "commander";
import { sendNotification } from "../lib/api.js";
import { success, error } from "../lib/output.js";
import type { Notification } from "../types/index.js";

export function registerNotificationCommands(program: Command): void {
  const notification = program
    .command("notification")
    .description("Send notifications to campaign members (gamemaster only)");

  // SEND
  notification
    .command("send <user-email>")
    .description("Send a notification to a campaign member")
    .requiredOption("-t, --title <title>", "Notification title")
    .option("-m, --message <message>", "Notification message body")
    .option("--type <type>", "Notification type", "gm_announcement")
    .option("--json", "Output as JSON")
    .action(async (userEmail, options) => {
      try {
        const notification = await sendNotification({
          user_email: userEmail,
          title: options.title,
          message: options.message,
          type: options.type,
        });

        if (options.json) {
          console.log(JSON.stringify(notification, null, 2));
          return;
        }

        success(`Notification sent to ${userEmail}`);
        printNotificationDetails(notification);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to send notification");
        process.exit(1);
      }
    });
}

function printNotificationDetails(item: Notification): void {
  console.log(`  ID: ${item.id}`);
  console.log(`  Title: ${item.title}`);
  if (item.message) {
    console.log(`  Message: ${item.message}`);
  }
  console.log(`  Type: ${item.type}`);
  console.log(`  Created: ${new Date(item.created_at).toLocaleString()}`);
  console.log("");
}
