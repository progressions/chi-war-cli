// Simple output helpers for consistent CLI formatting

export function success(message: string): void {
  console.log(`✓ ${message}`);
}

export function error(message: string): void {
  console.error(`✗ ${message}`);
}

export function info(message: string): void {
  console.log(`  ${message}`);
}

export function heading(message: string): void {
  console.log(`\n${message}`);
  console.log("─".repeat(message.length));
}

export function table(data: Record<string, unknown>): void {
  const maxKeyLen = Math.max(...Object.keys(data).map((k) => k.length));
  for (const [key, value] of Object.entries(data)) {
    const paddedKey = key.padEnd(maxKeyLen);
    console.log(`  ${paddedKey}  ${value}`);
  }
}
