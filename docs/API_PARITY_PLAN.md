# Chi War CLI - API Feature Parity Plan

## Overview

This document outlines a plan to achieve feature parity between the chiwar CLI and the shot-elixir REST API using a repeatable CRUD pattern.

## Current State

### Implemented
| Entity | List | Show | Create | Update | Delete | Extra |
|--------|------|------|--------|--------|--------|-------|
| Character | ✅ | ✅ | ✅ | ✅ | ❌ | image upload |
| Faction | ✅ | ❌ | ❌ | ❌ | ❌ | search |
| Party | ✅ | ✅ | ✅ | ✅ | ✅ | templates, slots |
| Config | - | ✅ | - | ✅ | - | local/production |

### Not Implemented
- Campaign, Fight, Site, Vehicle, Juncture, Weapon, Schtick, Invitation, AI

---

## Standard CRUD Pattern

### File Structure

For each entity, create:
```
src/
├── commands/
│   └── {entity}.ts       # CLI command definitions
├── lib/
│   └── api.ts            # Add API functions (shared file)
└── types/
    └── index.ts          # Add type definitions (shared file)
```

### 1. Types (src/types/index.ts)

```typescript
// Add to existing types file
export interface {Entity} {
  id: string;
  name: string;
  // ... entity-specific fields
  created_at: string;
  updated_at: string;
}

export interface {Entity}ListResponse {
  {entities}: {Entity}[];
  meta: PaginationMeta;
}
```

### 2. API Functions (src/lib/api.ts)

```typescript
// Standard CRUD functions pattern
export async function list{Entities}(options?: ListOptions): Promise<{Entity}ListResponse> {
  const client = createClient(getToken()!);
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.page) params.append("page", options.page.toString());

  const response = await client.get(`/api/v2/{entities}?${params}`);
  return response.data;
}

export async function get{Entity}(id: string): Promise<{Entity}> {
  const client = createClient(getToken()!);
  const response = await client.get(`/api/v2/{entities}/${id}`);
  return response.data;
}

export async function create{Entity}(data: Record<string, unknown>): Promise<{Entity}> {
  const client = createClient(getToken()!);
  const response = await client.post("/api/v2/{entities}", { {entity}: data });
  return response.data;
}

export async function update{Entity}(id: string, data: Record<string, unknown>): Promise<{Entity}> {
  const client = createClient(getToken()!);
  const response = await client.patch(`/api/v2/{entities}/${id}`, { {entity}: data });
  return response.data;
}

export async function delete{Entity}(id: string): Promise<void> {
  const client = createClient(getToken()!);
  await client.delete(`/api/v2/{entities}/${id}`);
}
```

### 3. CLI Commands (src/commands/{entity}.ts)

```typescript
import { Command } from "commander";
import { list{Entities}, get{Entity}, create{Entity}, update{Entity}, delete{Entity} } from "../lib/api.js";
import { success, error, info } from "../lib/output.js";
import * as fs from "fs";
import type { {Entity} } from "../types/index.js";

export function register{Entity}Commands(program: Command): void {
  const {entity} = program
    .command("{entity}")
    .description("Manage {entities}");

  // LIST
  {entity}
    .command("list")
    .description("List {entities}")
    .option("-n, --limit <number>", "Results per page", "20")
    .option("-p, --page <number>", "Page number", "1")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const result = await list{Entities}({
          limit: parseInt(options.limit),
          page: parseInt(options.page),
        });

        if (options.json) {
          console.log(JSON.stringify(result.{entities}, null, 2));
          return;
        }

        console.log(`\n{Entities} (${result.meta.total_count} total):\n`);
        for (const item of result.{entities}) {
          print{Entity}Summary(item);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list {entities}");
        process.exit(1);
      }
    });

  // SHOW
  {entity}
    .command("show <id>")
    .description("Show {entity} details")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const item = await get{Entity}(id);

        if (options.json) {
          console.log(JSON.stringify(item, null, 2));
          return;
        }

        print{Entity}Details(item);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to get {entity}");
        process.exit(1);
      }
    });

  // CREATE
  {entity}
    .command("create")
    .description("Create a new {entity}")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .action(async (jsonArg, options) => {
      try {
        let data: Record<string, unknown>;

        if (options.file) {
          data = JSON.parse(fs.readFileSync(options.file, "utf-8"));
        } else if (jsonArg) {
          data = JSON.parse(jsonArg);
        } else {
          error("Provide JSON as argument or use --file");
          process.exit(1);
        }

        const created = await create{Entity}(data);
        success(`Created {entity}: ${created.name}`);
        console.log(`  ID: ${created.id}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to create {entity}");
        process.exit(1);
      }
    });

  // UPDATE
  {entity}
    .command("update <id>")
    .description("Update a {entity}")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .action(async (id, jsonArg, options) => {
      try {
        let data: Record<string, unknown>;

        if (options.file) {
          data = JSON.parse(fs.readFileSync(options.file, "utf-8"));
        } else if (jsonArg) {
          data = JSON.parse(jsonArg);
        } else {
          error("Provide JSON as argument or use --file");
          process.exit(1);
        }

        const updated = await update{Entity}(id, data);
        success(`Updated {entity}: ${updated.name}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to update {entity}");
        process.exit(1);
      }
    });

  // DELETE
  {entity}
    .command("delete <id>")
    .description("Delete a {entity}")
    .option("-y, --yes", "Skip confirmation")
    .action(async (id, options) => {
      try {
        if (!options.yes) {
          const inquirer = await import("inquirer");
          const { confirm } = await inquirer.default.prompt([{
            type: "confirm",
            name: "confirm",
            message: `Delete {entity} ${id}?`,
            default: false,
          }]);
          if (!confirm) {
            info("Cancelled");
            return;
          }
        }

        await delete{Entity}(id);
        success(`Deleted {entity} ${id}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to delete {entity}");
        process.exit(1);
      }
    });
}

function print{Entity}Summary(item: {Entity}): void {
  console.log(`  ${item.name}`);
  console.log(`    ID: ${item.id}`);
  console.log("");
}

function print{Entity}Details(item: {Entity}): void {
  console.log(`\n${item.name}`);
  console.log("=".repeat(item.name.length));
  console.log(`  ID: ${item.id}`);
  // Add entity-specific fields
  console.log("");
}
```

### 4. Register Commands (src/index.ts)

```typescript
import { register{Entity}Commands } from "./commands/{entity}.js";
// ...
register{Entity}Commands(program);
```

---

## Implementation Priority

### Tier 1 - Core Gameplay (High Value)
| Entity | Priority | Reason |
|--------|----------|--------|
| **Campaign** | 1 | Required for multi-campaign workflows |
| **Fight** | 2 | Core gameplay mechanic |
| **Site** | 3 | World-building foundation |

### Tier 2 - World Building (Medium Value)
| Entity | Priority | Reason |
|--------|----------|--------|
| **Juncture** | 4 | Time period management |
| **Vehicle** | 5 | Chase scenes |
| **Weapon** | 6 | Equipment management |
| **Schtick** | 7 | Character abilities |

### Tier 3 - Administration (Lower Value for CLI)
| Entity | Priority | Reason |
|--------|----------|--------|
| **Invitation** | 8 | Player onboarding |
| **AI** | 9 | Content generation |
| **AI Image** | 10 | Image generation |

---

## Entity-Specific Considerations

### Campaign
```bash
chiwar campaign list
chiwar campaign show <id>
chiwar campaign create --file campaign.json
chiwar campaign set <id>              # Set as current campaign
chiwar campaign current               # Show current campaign
```

**Extra commands:**
- `set` - Set current campaign (updates config)
- `current` - Display current campaign info

### Fight
```bash
chiwar fight list
chiwar fight show <id>
chiwar fight create --file fight.json
chiwar fight start <id>               # Set as current fight
chiwar fight end <id>                 # End fight
chiwar fight reset <id>               # Reset fight
```

**Extra commands:**
- `start`, `end`, `reset` - Fight lifecycle
- Consider: shot management as nested subcommands

### Site
```bash
chiwar site list
chiwar site show <id>
chiwar site create --file site.json
chiwar site duplicate <id>
chiwar site attune <site-id> <character-id>
```

**Extra commands:**
- `duplicate` - Clone a site
- `attune` - Attune character to feng shui site

### Vehicle
```bash
chiwar vehicle list
chiwar vehicle show <id>
chiwar vehicle create --file vehicle.json
chiwar vehicle archetypes             # List archetypes
chiwar vehicle duplicate <id>
```

**Extra commands:**
- `archetypes` - List available vehicle types
- `duplicate` - Clone a vehicle

### Weapon / Schtick
```bash
chiwar weapon list [--category <cat>]
chiwar weapon show <id>
chiwar weapon create --file weapon.json
chiwar weapon categories              # List categories
chiwar weapon duplicate <id>

chiwar schtick list [--path <path>]
chiwar schtick show <id>
chiwar schtick create --file schtick.json
chiwar schtick paths                  # List paths/categories
chiwar schtick duplicate <id>
```

### Invitation
```bash
chiwar invitation list
chiwar invitation create --email user@example.com
chiwar invitation resend <id>
chiwar invitation delete <id>
```

---

## Implementation Checklist

For each entity:

- [ ] Add TypeScript types to `src/types/index.ts`
- [ ] Add API functions to `src/lib/api.ts`
- [ ] Create command file `src/commands/{entity}.ts`
- [ ] Register commands in `src/index.ts`
- [ ] Add to skill documentation
- [ ] Test all CRUD operations
- [ ] Build and verify no TypeScript errors

---

## JSON File Conventions

Standard location for entity JSON files:
```
/tmp/{entity}.json
/tmp/{entity}-{name}.json
```

Example workflows:
```bash
# Create a site
cat > /tmp/site.json << 'EOF'
{
  "name": "The Golden Dragon Casino",
  "description": "A neon-lit gambling den in Hong Kong",
  "feng_shui_value": 5
}
EOF
chiwar site create --file /tmp/site.json

# Create a fight
cat > /tmp/fight.json << 'EOF'
{
  "name": "Warehouse Showdown",
  "description": "The final confrontation"
}
EOF
chiwar fight create --file /tmp/fight.json
```

---

## Testing Strategy

1. **Unit test each API function** - Mock axios responses
2. **Integration test with local server** - Use `config local` to test against localhost:4002
3. **Manual verification** - Create/update/delete entities and verify in web UI

---

## Next Steps

1. Start with **Campaign** entity (Tier 1)
2. Follow the standard pattern above
3. Add entity-specific commands as needed
4. Update chiwar skill documentation
5. Create PR for each entity batch
