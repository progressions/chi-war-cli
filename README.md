# Chi War CLI

Command-line interface for [Chi War](https://chiwar.net) - a Feng Shui 2 RPG campaign manager.

## Installation

```bash
# Clone the repository
git clone https://github.com/progressions/chi-war-cli.git
cd chi-war-cli

# Install dependencies
npm install

# Build
npm run build

# Link globally (optional)
npm link
```

## Authentication

```bash
# Login via browser (opens OAuth flow)
chiwar login

# Logout
chiwar logout
```

## Configuration

```bash
# Show current configuration
chiwar config show

# Switch to local development server
chiwar config local

# Switch to production
chiwar config production

# Set custom API URL
chiwar config set apiUrl <url>

# Set current campaign
chiwar config set campaign <id>
```

Config is stored at `~/.chiwar/config.json`.

## Commands

### Dashboard

```bash
chiwar dashboard                  # Show campaign summary, next adventure, and fights
```

### Campaigns

```bash
chiwar campaign list              # List all campaigns
chiwar campaign show <id>         # Show campaign details
chiwar campaign set <id>          # Set current campaign
```

### Characters

```bash
chiwar character list             # List characters in current campaign
chiwar character show <id>        # Show character details
chiwar character create --file <json>   # Create from JSON file
chiwar character update <id> --file <json>  # Update from JSON
chiwar character delete <id>      # Delete a character
```

### Fights

```bash
chiwar fight list                 # List fights
chiwar fight show <id>            # Show fight details
chiwar fight create --name "Battle Name"  # Create a fight
chiwar fight end <id>             # End a fight
chiwar fight reset <id>           # Reset fight (clear combatants)
chiwar fight add-character <fight-id> <character-id>  # Add character
chiwar fight add-vehicle <fight-id> <vehicle-id>      # Add vehicle
chiwar fight add-party <fight-id> <party-id>          # Add entire party
```

### Parties

```bash
chiwar party list                 # List parties
chiwar party show <id>            # Show party with members
```

### Sites (Feng Shui Locations)

```bash
chiwar site list                  # List sites
chiwar site show <id>             # Show site details
```

### Factions

```bash
chiwar faction list               # List factions
chiwar faction show <id>          # Show faction details
```

### Vehicles (Chase Scenes)

```bash
chiwar vehicle list               # List vehicles
chiwar vehicle show <id>          # Show vehicle details
```

### Weapons

```bash
chiwar weapon list                # List weapons
chiwar weapon show <id>           # Show weapon details
```

### Schticks (Character Abilities)

```bash
chiwar schtick list               # List schticks
chiwar schtick show <id>          # Show schtick details
```

### Junctures (Time Periods)

```bash
chiwar juncture list              # List junctures
```

### AI Commands

```bash
# Generate AI images for an entity
chiwar ai image <entity-type> <entity-id>
chiwar ai image character abc-123 --prompt "dramatic lighting"

# Attach an image URL to an entity
chiwar ai attach <entity-type> <entity-id> <image-url>

# Create a character from AI description
chiwar ai create "Triad enforcer with a scar, uses dual pistols"

# Extend existing character with AI content
chiwar ai extend <character-id>

# List valid entity types
chiwar ai types
```

### Session Notes

```bash
# Fetch session notes from Notion
chiwar session <session-number>
chiwar session 5-10
```

### Notion Search

```bash
# Search Notion pages
chiwar notion search "yakuza blues"
```

## JSON Output

Most commands support `--json` flag for machine-readable output:

```bash
chiwar character list --json
chiwar fight show <id> --json
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
- `Mook` - Unnamed minions
- `Featured Foe` - Named antagonist
- `Boss` - Major villain
- `Uber-Boss` - Campaign-level threat
- `Ally` - Friendly NPC

### Attack Skills
- `Guns` - Firearms
- `Martial Arts` - Hand-to-hand
- `Sorcery` - Magic
- `Scroungetech` - Jury-rigged tech
- `Creature` - Monster attacks
- `Mutant` - Mutant powers

## Development

```bash
npm install          # Install dependencies
npm run build        # Build TypeScript
npm run dev -- <cmd> # Run in dev mode
```

## License

MIT
