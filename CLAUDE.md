# Chi War CLI

Command-line interface for Chi War - Feng Shui 2 campaign manager.

## Commands

```bash
# Authentication
chiwar login              # Authenticate via browser
chiwar logout             # Clear saved authentication

# Configuration
chiwar config show        # Show current config
chiwar config local       # Switch to localhost:4002 (Phoenix dev)
chiwar config production  # Switch to shot-elixir.fly.dev
chiwar config set apiUrl <url>
chiwar config set campaign <id>

# Characters
chiwar character create --file character.json
chiwar character update <id> --file updates.json
```

## Character JSON Structure

When creating or updating characters, use this structure:

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
- `"PC"` - Player Character
- `"NPC"` - Non-Player Character
- `"Mook"` - Unnamed minions (no wound points)
- `"Featured Foe"` - Named antagonist with moderate stats
- `"Boss"` - Major villain
- `"Uber-Boss"` - Campaign-level threat
- `"Ally"` - Friendly NPC

### Attack Skills
Set one as `MainAttack`:
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

The frontend crashes if action_values contains null values. When updating a character:

❌ **WRONG** - Don't do this:
```json
{
  "action_values": {
    "Martial Arts": null,
    "Guns": 15
  }
}
```

✅ **CORRECT** - Replace the entire action_values object:
```json
{
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

Or only include the fields you want to change (omit fields to keep existing values):
```json
{
  "action_values": {
    "Guns": 15,
    "MainAttack": "Guns"
  }
}
```

## Example: Creating a Featured Foe

```bash
cat > /tmp/thug.json << 'EOF'
{
  "name": "Triad Enforcer",
  "action_values": {
    "Type": "Featured Foe",
    "Guns": 14,
    "Defense": 13,
    "Toughness": 6,
    "Speed": 6,
    "MainAttack": "Guns"
  }
}
EOF
chiwar character create --file /tmp/thug.json
```

## Example: Creating Mooks

Mooks don't have individual wound points - they go down in one hit.

```bash
cat > /tmp/mooks.json << 'EOF'
{
  "name": "Triad Gunman",
  "action_values": {
    "Type": "Mook",
    "Guns": 8,
    "Defense": 13,
    "MainAttack": "Guns"
  }
}
EOF
chiwar character create --file /tmp/mooks.json
```

## Development

```bash
npm install          # Install dependencies
npm run build        # Build TypeScript
npm run dev -- <cmd> # Run in dev mode (tsx)
```

Config is stored at `~/.chiwar/config.json`.
