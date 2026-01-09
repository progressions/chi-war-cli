# Chi War CLI

Command-line interface for Chi War - Feng Shui 2 campaign manager.

## Project Structure

```
chi-war-cli/
├── src/
│   ├── commands/       # Command implementations
│   │   ├── ai.ts       # AI image/character generation
│   │   ├── campaign.ts # Campaign management
│   │   ├── character.ts # Character CRUD
│   │   ├── config.ts   # CLI configuration
│   │   ├── faction.ts  # Faction management
│   │   ├── fight.ts    # Fight/combat management
│   │   ├── juncture.ts # Time periods
│   │   ├── login.ts    # Authentication
│   │   ├── notion.ts   # Notion search
│   │   ├── party.ts    # Party management
│   │   ├── session.ts  # Session notes from Notion
│   │   ├── schtick.ts  # Character abilities
│   │   ├── site.ts     # Feng shui locations
│   │   ├── vehicle.ts  # Vehicles for chases
│   │   └── weapon.ts   # Weapon management
│   ├── lib/
│   │   ├── api.ts      # API client functions
│   │   ├── config.ts   # Config file management
│   │   └── output.ts   # Console output helpers
│   ├── types/
│   │   └── index.ts    # TypeScript type definitions
│   └── index.ts        # Main entry point
├── dist/               # Compiled JavaScript
├── bin/                # Executable entry point
└── package.json
```

## Development Commands

```bash
npm install          # Install dependencies
npm run build        # Build TypeScript to dist/
npm run dev -- <cmd> # Run in dev mode with tsx
npm link             # Link globally as 'chiwar'
```

## Adding New Commands

1. Create a new file in `src/commands/` following existing patterns
2. Export a `register*Commands(program: Command)` function
3. Import and call the register function in `src/index.ts`
4. Add API functions to `src/lib/api.ts` if needed

### Command Pattern Example

```typescript
import { Command } from "commander";
import { listEntities, getEntity } from "../lib/api.js";
import { success, error, info } from "../lib/output.js";

export function registerEntityCommands(program: Command): void {
  const entity = program
    .command("entity")
    .description("Manage entities");

  entity
    .command("list")
    .description("List entities")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const result = await listEntities();
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        // ... display logic
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed");
        process.exit(1);
      }
    });
}
```

## API Client Pattern

All API functions are in `src/lib/api.ts`. Pattern:

```typescript
export async function createEntity(data: Record<string, unknown>): Promise<Entity> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post("/api/v2/entities", {
      entity: data,  // Wrap in entity key for Phoenix API
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      // Handle specific error codes
    }
    throw error;
  }
}
```

## Configuration

Config stored at `~/.chiwar/config.json`:

```json
{
  "apiUrl": "https://shot-elixir.fly.dev",
  "token": "...",
  "currentCampaignId": "uuid"
}
```

## Character JSON Structure

When creating or updating characters:

```json
{
  "name": "Character Name",
  "action_values": {
    "Type": "Featured Foe",
    "Guns": 15,
    "Defense": 13,
    "Toughness": 6,
    "Speed": 6,
    "MainAttack": "Guns"
  }
}
```

### Character Types
- `PC` - Player Character
- `NPC` - Non-Player Character
- `Mook` - Unnamed minions (no wound points)
- `Featured Foe` - Named antagonist with moderate stats
- `Boss` - Major villain
- `Uber-Boss` - Campaign-level threat
- `Ally` - Friendly NPC

### Attack Skills (set one as MainAttack)
- `Guns` - Firearms
- `Martial Arts` - Hand-to-hand combat
- `Sorcery` - Magic
- `Scroungetech` - Jury-rigged technology
- `Creature` - Monster attacks
- `Mutant` - Mutant powers

### Common Action Values
- `Defense` - Target number to hit
- `Toughness` - Damage reduction
- `Speed` - Initiative modifier
- `Fortune` - Luck points (PCs/bosses)
- `Wounds` - Current wound points

## CRITICAL: JSON Update Rules

**NEVER set action_values fields to `null`.**

The frontend crashes if action_values contains null values. When updating:

Wrong:
```json
{ "action_values": { "Martial Arts": null, "Guns": 15 } }
```

Correct - replace entire object or omit unchanged fields:
```json
{ "action_values": { "Guns": 15, "MainAttack": "Guns" } }
```

## API Endpoints

The CLI connects to the Phoenix API at `shot-elixir.fly.dev`:

- `POST /users/sign_in` - Authentication
- `GET/POST/PATCH/DELETE /api/v2/characters`
- `GET/POST/PATCH/DELETE /api/v2/fights`
- `POST /api/v2/fights/:id/add_party` - Add party to fight
- `GET/POST/PATCH/DELETE /api/v2/parties`
- `GET/POST/PATCH/DELETE /api/v2/sites`
- `GET/POST/PATCH/DELETE /api/v2/factions`
- `GET/POST/PATCH/DELETE /api/v2/vehicles`
- `GET/POST/PATCH/DELETE /api/v2/weapons`
- `GET/POST/PATCH/DELETE /api/v2/schticks`
- `GET /api/v2/junctures`
- `POST /api/v2/ai/generate_images` - AI image generation
- `POST /api/v2/ai/generate_character` - AI character creation

## Output Helpers

Use helpers from `src/lib/output.ts`:

```typescript
import { success, error, info, warn } from "../lib/output.js";

success("Operation completed");  // Green checkmark
error("Something failed");       // Red X
info("Information");             // Blue info
warn("Warning message");         // Yellow warning
```

## Testing

Currently no automated tests. Test manually:

```bash
npm run build
chiwar config show
chiwar character list
chiwar fight list
```
