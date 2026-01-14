import { Command } from "commander";
import {
  getEncounter,
  spendShots,
  rollSwerve,
  listFights,
  applyCombatAction,
  updateFight,
  updateInitiatives,
  updateShotLocation,
} from "../lib/api.js";
import { success, error, info, warn } from "../lib/output.js";
import { getCurrentEncounterId, setCurrentEncounterId } from "../lib/config.js";
import {
  calculateAttack,
  formatAttackResult,
  calculateWoundResult,
  formatWoundResult,
  calculateMultiTargetAttack,
  formatMultiTargetAttackResult,
} from "../lib/combat.js";
import type {
  Encounter,
  Combatant,
  SwerveResult,
  CombatUpdate,
} from "../types/index.js";

// Extract all combatants from an encounter for fuzzy matching
function extractCombatants(encounter: Encounter): Combatant[] {
  const combatants: Combatant[] = [];

  for (const shotGroup of encounter.shots) {
    // Add characters
    for (const char of shotGroup.characters) {
      const actionValues = char.action_values || {};
      const mainAttack = actionValues.MainAttack as string | undefined;
      let attackValue: number | undefined;

      if (mainAttack) {
        attackValue = actionValues[mainAttack] as number | undefined;
      }

      combatants.push({
        type: "character",
        id: char.id,
        name: char.name,
        shotId: char.shot_id,
        currentShot: char.current_shot,
        characterType: actionValues.Type as string | undefined,
        impairments: char.impairments || 0,
        count: char.count,
        defense: actionValues.Defense as number | undefined,
        toughness: actionValues.Toughness as number | undefined,
        mainAttack,
        attackValue,
        damage: actionValues.Damage as number | undefined,
        location: char.location,
      });
    }

    // Add vehicles
    for (const veh of shotGroup.vehicles) {
      combatants.push({
        type: "vehicle",
        id: veh.id,
        name: veh.name,
        shotId: veh.shot_id,
        currentShot: veh.current_shot,
        impairments: 0,
        location: veh.location,
      });
    }
  }

  return combatants;
}

// Fuzzy match combatant by name within the encounter
function findCombatant(
  query: string,
  combatants: Combatant[]
): Combatant | Combatant[] | null {
  const q = query.toLowerCase().trim();

  // 1. Exact match
  const exact = combatants.find((c) => c.name.toLowerCase() === q);
  if (exact) return exact;

  // 2. Starts-with match
  const startsWith = combatants.filter((c) =>
    c.name.toLowerCase().startsWith(q)
  );
  if (startsWith.length === 1) return startsWith[0];
  if (startsWith.length > 1) return startsWith;

  // 3. Contains match
  const contains = combatants.filter((c) => c.name.toLowerCase().includes(q));
  if (contains.length === 1) return contains[0];
  if (contains.length > 1) return contains;

  // 4. Word-starts-with match
  const wordMatch = combatants.filter((c) =>
    c.name
      .toLowerCase()
      .split(/\s+/)
      .some((word) => word.startsWith(q))
  );
  if (wordMatch.length === 1) return wordMatch[0];
  if (wordMatch.length > 1) return wordMatch;

  return null;
}

// Format shot value for display
function formatShot(shot: number | null): string {
  if (shot === null) return "Hidden";
  return `Shot ${shot}`;
}

// Format character type badge
function formatType(type: string | undefined): string {
  if (!type) return "";
  switch (type) {
    case "PC":
      return "(PC)";
    case "Mook":
      return "(Mook)";
    case "Boss":
      return "(Boss)";
    case "Uber-Boss":
      return "(Uber-Boss)";
    case "Featured Foe":
      return "(Featured Foe)";
    case "Ally":
      return "(Ally)";
    case "NPC":
      return "(NPC)";
    default:
      return `(${type})`;
  }
}

// Print encounter status in a readable format
function printEncounterStatus(encounter: Encounter): void {
  console.log(`\n=== ${encounter.name} ===`);
  console.log(`Sequence: ${encounter.sequence}`);

  if (encounter.started_at && !encounter.ended_at) {
    console.log(`Status: In Progress`);
  } else if (encounter.ended_at) {
    console.log(`Status: Ended`);
  } else {
    console.log(`Status: Not Started`);
  }

  console.log("");

  // Group and display by shot
  for (const shotGroup of encounter.shots) {
    const shotLabel = formatShot(shotGroup.shot);
    console.log(`${shotLabel}:`);

    // Display characters
    for (const char of shotGroup.characters) {
      const actionValues = char.action_values || {};
      const charType = actionValues.Type as string | undefined;
      const type = formatType(charType);
      const impairments = char.impairments || 0;
      const count = char.count || 0;

      // Wounds are stored differently by character type:
      // - PCs: action_values.Wounds
      // - Non-PCs (Featured Foe, Boss, etc): shot.count
      // - Mooks: count is mook count, not wounds
      const isPC = charType === "PC";
      const isMook = charType === "Mook";
      const wounds = isPC
        ? (actionValues.Wounds as number | undefined) || 0
        : isMook
          ? undefined  // Mooks don't track individual wounds
          : count;     // Non-PCs store wounds in count

      // Build status line
      let statusLine = `  ${char.name.toUpperCase()} ${type}`;

      // Show mook count for mooks
      if (isMook && count > 0) {
        statusLine += ` x${count}`;
      }

      // Add wounds/impairments for non-mooks
      if (!isMook) {
        const stats: string[] = [];
        if (wounds !== undefined) stats.push(`Wounds: ${wounds}`);
        if (impairments > 0) stats.push(`Imp: ${impairments}`);
        if (stats.length > 0) {
          statusLine += ` - ${stats.join(", ")}`;
        }
      }

      console.log(statusLine);

      // Print attack/defense on second line
      const mainAttack = actionValues.MainAttack as string | undefined;
      const attackValue = mainAttack
        ? (actionValues[mainAttack] as number | undefined)
        : undefined;
      const defense = actionValues.Defense as number | undefined;

      if (attackValue || defense) {
        const combatStats: string[] = [];
        if (mainAttack && attackValue) {
          combatStats.push(`${mainAttack} ${attackValue}`);
        }
        if (defense) {
          combatStats.push(`Defense ${defense}`);
        }
        console.log(`    ${combatStats.join(", ")}`);
      }
    }

    // Display vehicles
    for (const veh of shotGroup.vehicles) {
      console.log(`  ${veh.name} (Vehicle)`);
      if (veh.driver) {
        console.log(`    Driver: ${veh.driver.name}`);
      }
    }

    console.log("");
  }
}

export function registerEncounterCommands(program: Command): void {
  const encounter = program
    .command("encounter")
    .description("Manage active combat encounters");

  // SET - Set current encounter
  encounter
    .command("set <fight-id>")
    .description("Set the current encounter context")
    .action(async (fightId) => {
      try {
        // Verify the fight exists and is accessible
        const enc = await getEncounter(fightId);
        setCurrentEncounterId(fightId);
        success(`Current encounter set to: ${enc.name}`);
        info(`Fight ID: ${fightId}`);
        info(`Combatants: ${enc.character_ids.length} characters, ${enc.vehicle_ids.length} vehicles`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to set encounter");
        process.exit(1);
      }
    });

  // STATUS - Show current encounter status
  encounter
    .command("status [fight-id]")
    .description("Show the current encounter status")
    .option("--json", "Output as JSON")
    .action(async (fightId, options) => {
      try {
        // Use provided fight-id or current encounter
        const encounterId = fightId || getCurrentEncounterId();

        if (!encounterId) {
          error("No encounter specified. Use 'encounter set <fight-id>' first or provide a fight ID.");

          // List available fights as a hint
          try {
            const fights = await listFights({ limit: 5, active: true });
            if (fights.fights.length > 0) {
              console.log("\nAvailable fights:");
              for (const f of fights.fights) {
                console.log(`  ${f.id} - ${f.name}`);
              }
            }
          } catch {
            // Ignore error listing fights
          }

          process.exit(1);
        }

        const enc = await getEncounter(encounterId);

        if (options.json) {
          console.log(JSON.stringify(enc, null, 2));
          return;
        }

        printEncounterStatus(enc);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to get encounter status");
        process.exit(1);
      }
    });

  // SPEND - Spend shots (move on initiative)
  encounter
    .command("spend <character> <shots>")
    .description("Character spends shots (moves down initiative)")
    .action(async (characterName, shotsStr) => {
      try {
        const encounterId = getCurrentEncounterId();
        if (!encounterId) {
          error("No encounter set. Use 'encounter set <fight-id>' first.");
          process.exit(1);
        }

        const shots = parseInt(shotsStr, 10);
        if (isNaN(shots) || shots < 1) {
          error("Invalid shot count. Must be a positive number.");
          process.exit(1);
        }

        // Get encounter and find character
        const enc = await getEncounter(encounterId);
        const combatants = extractCombatants(enc);
        const match = findCombatant(characterName, combatants);

        if (!match) {
          error(`No combatant found matching "${characterName}"`);
          console.log("\nCombatants in this fight:");
          for (const c of combatants) {
            console.log(`  ${c.name}`);
          }
          process.exit(1);
        }

        if (Array.isArray(match)) {
          error(`Ambiguous name "${characterName}". Did you mean:`);
          for (const c of match) {
            console.log(`  ${c.name}`);
          }
          process.exit(1);
        }

        const oldShot = match.currentShot;

        // Spend the shots
        const updated = await spendShots(encounterId, match.shotId, shots);

        // Find the updated combatant to show new shot
        const updatedCombatants = extractCombatants(updated);
        const updatedChar = updatedCombatants.find((c) => c.id === match.id);
        const newShot = updatedChar?.currentShot ?? null;

        success(
          `${match.name}: ${formatShot(oldShot)} → ${formatShot(newShot)}`
        );
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to spend shots");
        process.exit(1);
      }
    });

  // ROLL - Roll a swerve
  encounter
    .command("roll [description]")
    .description("Roll a swerve (positive die minus negative die)")
    .action(async (description) => {
      try {
        const result = await rollSwerve();

        const posRolls = result.positives.rolls.join(", ");
        const negRolls = result.negatives.rolls.join(", ");

        console.log("");
        if (description) {
          console.log(`Rolling for: ${description}`);
        }
        console.log(
          `Positive: ${result.positives.sum} (${posRolls})`
        );
        console.log(
          `Negative: ${result.negatives.sum} (${negRolls})`
        );
        console.log(`Swerve: ${result.total >= 0 ? "+" : ""}${result.total}`);

        if (result.boxcars) {
          warn("BOXCARS! Something dramatic happens!");
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to roll swerve");
        process.exit(1);
      }
    });

  // LIST - List combatants in current encounter
  encounter
    .command("list")
    .description("List all combatants in the current encounter")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const encounterId = getCurrentEncounterId();
        if (!encounterId) {
          error("No encounter set. Use 'encounter set <fight-id>' first.");
          process.exit(1);
        }

        const enc = await getEncounter(encounterId);
        const combatants = extractCombatants(enc);

        if (options.json) {
          console.log(JSON.stringify(combatants, null, 2));
          return;
        }

        console.log(`\nCombatants in ${enc.name}:\n`);
        for (const c of combatants) {
          const type = c.characterType ? formatType(c.characterType) : "";
          const shot = formatShot(c.currentShot);
          let line = `  ${c.name} ${type} - ${shot}`;
          if (c.count && c.count > 0) {
            line += ` x${c.count}`;
          }
          console.log(line);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list combatants");
        process.exit(1);
      }
    });

  // ATTACK - Attack a target with damage resolution
  encounter
    .command("attack <attacker>")
    .description("Attack a target with full damage calculation")
    .requiredOption("-t, --target <name>", "Target character name")
    .option("-r, --roll <swerve>", "Use provided swerve value instead of rolling")
    .option("-c, --count <number>", "Number of mooks to target", "1")
    .action(async (attackerName, options) => {
      try {
        const encounterId = getCurrentEncounterId();
        if (!encounterId) {
          error("No encounter set. Use 'encounter set <fight-id>' first.");
          process.exit(1);
        }

        // Get encounter and find combatants
        const enc = await getEncounter(encounterId);
        const combatants = extractCombatants(enc);

        // Find attacker
        const attackerMatch = findCombatant(attackerName, combatants);
        if (!attackerMatch) {
          error(`No combatant found matching "${attackerName}"`);
          listCombatantNames(combatants);
          process.exit(1);
        }
        if (Array.isArray(attackerMatch)) {
          error(`Ambiguous attacker "${attackerName}". Did you mean:`);
          for (const c of attackerMatch) {
            console.log(`  ${c.name}`);
          }
          process.exit(1);
        }

        // Find target
        const targetMatch = findCombatant(options.target, combatants);
        if (!targetMatch) {
          error(`No combatant found matching "${options.target}"`);
          listCombatantNames(combatants);
          process.exit(1);
        }
        if (Array.isArray(targetMatch)) {
          error(`Ambiguous target "${options.target}". Did you mean:`);
          for (const c of targetMatch) {
            console.log(`  ${c.name}`);
          }
          process.exit(1);
        }

        // Get or roll swerve
        let swerve: SwerveResult;
        if (options.roll !== undefined) {
          // Use provided swerve value
          const providedSwerve = parseInt(options.roll, 10);
          if (isNaN(providedSwerve)) {
            error("Invalid swerve value. Must be a number.");
            process.exit(1);
          }
          swerve = {
            positives: { sum: Math.max(0, providedSwerve), rolls: [Math.max(0, providedSwerve)] },
            negatives: { sum: Math.max(0, -providedSwerve), rolls: [Math.max(0, -providedSwerve)] },
            total: providedSwerve,
            boxcars: false,
          };
        } else {
          swerve = await rollSwerve();
        }

        const targetCount = parseInt(options.count, 10) || 1;

        // Calculate attack result
        const result = calculateAttack(attackerMatch, targetMatch, swerve, targetCount);

        // Display result
        console.log("");
        for (const line of formatAttackResult(result)) {
          console.log(line);
        }

        // Build event details for fight_event record
        const eventDetails: Record<string, unknown> = {
          attacker_id: attackerMatch.id,
          attacker_name: attackerMatch.name,
          target_id: targetMatch.id,
          target_name: targetMatch.name,
          swerve: swerve.total,
          attack_total: result.attackRoll,
          defense: result.defense,
          outcome: result.outcome,
          hit: result.hit,
        };

        if (result.hit) {
          eventDetails.smackdown = result.smackdown;
          eventDetails.wounds_dealt = result.woundsDealt;
          if (result.targetIsMook) {
            eventDetails.mooks_dropped = result.mooksDropped;
          }
        }

        const eventDescription = result.hit
          ? `${attackerMatch.name} attacks ${targetMatch.name} - HIT for ${result.targetIsMook ? `${result.mooksDropped} mooks dropped` : `${result.woundsDealt} wounds`}`
          : `${attackerMatch.name} attacks ${targetMatch.name} - MISS`;

        const updates: CombatUpdate[] = [];

        // If hit, apply the damage via API
        if (result.hit) {
          if (result.targetIsMook && result.mooksDropped) {
            // Update mook count
            const newCount = Math.max(0, (targetMatch.count || 0) - result.mooksDropped);
            updates.push({
              shot_id: targetMatch.shotId,
              character_id: targetMatch.id,
              count: newCount,
              event: {
                event_type: "attack",
                description: eventDescription,
                details: eventDetails,
              },
            });
            console.log(`\n${targetMatch.name}: ${targetMatch.count} → ${newCount} mooks remaining`);
          } else if (result.woundsDealt > 0) {
            // Determine if target is a PC (wounds go to action_values) or NPC (wounds go to shot record)
            const isPC = targetMatch.characterType === "PC";

            // Get current wounds from encounter data
            // PCs store wounds in action_values.Wounds, non-PCs store wounds in shot.count
            const charInEnc = enc.shots
              .flatMap((s) => s.characters)
              .find((c) => c.id === targetMatch.id);
            const currentWounds = isPC
              ? (charInEnc?.action_values?.Wounds as number) || 0
              : (charInEnc?.count as number) || 0;
            const newWounds = currentWounds + result.woundsDealt;

            const update: CombatUpdate = {
              shot_id: targetMatch.shotId,
              character_id: targetMatch.id,
              event: {
                event_type: "attack",
                description: eventDescription,
                details: eventDetails,
              },
            };

            if (isPC) {
              // For PCs, wounds go in action_values
              update.action_values = { Wounds: newWounds };
            } else {
              // For non-PCs (Featured Foe, Boss, etc), send incremental wounds
              // Backend adds to shot.count
              update.wounds = result.woundsDealt;
            }

            updates.push(update);

            const woundResult = calculateWoundResult(targetMatch, result.woundsDealt, currentWounds);
            console.log("");
            for (const line of formatWoundResult(woundResult)) {
              console.log(line);
            }
          } else {
            // Hit but dealt 0 wounds (smackdown < toughness) - still record the event
            updates.push({
              shot_id: targetMatch.shotId,
              character_id: targetMatch.id,
              event: {
                event_type: "attack",
                description: `${attackerMatch.name} attacks ${targetMatch.name} - HIT but 0 wounds (blocked by toughness)`,
                details: eventDetails,
              },
            });
          }
        } else {
          // Miss - still record the event for the log
          updates.push({
            shot_id: attackerMatch.shotId,
            character_id: attackerMatch.id,
            event: {
              event_type: "attack",
              description: eventDescription,
              details: eventDetails,
            },
          });
        }

        if (updates.length > 0) {
          await applyCombatAction(encounterId, updates);
          success("Combat action applied");
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to execute attack");
        process.exit(1);
      }
    });

  // MULTIATTACK - Attack multiple targets with damage splitting (Feng Shui 2 rules)
  encounter
    .command("multiattack <attacker>")
    .description("Attack multiple targets with split damage (Feng Shui 2 multi-target rules)")
    .requiredOption("-t, --target <names...>", "Target character names (can specify multiple)")
    .option("-r, --roll <swerve>", "Use provided swerve value instead of rolling")
    .option("-d, --damage <allocation>", "Custom damage allocation (comma-separated, must sum to total damage)")
    .action(async (attackerName, options) => {
      try {
        const encounterId = getCurrentEncounterId();
        if (!encounterId) {
          error("No encounter set. Use 'encounter set <fight-id>' first.");
          process.exit(1);
        }

        // Get encounter and find combatants
        const enc = await getEncounter(encounterId);
        const combatants = extractCombatants(enc);

        // Find attacker
        const attackerMatch = findCombatant(attackerName, combatants);
        if (!attackerMatch) {
          error(`No combatant found matching "${attackerName}"`);
          listCombatantNames(combatants);
          process.exit(1);
        }
        if (Array.isArray(attackerMatch)) {
          error(`Ambiguous attacker "${attackerName}". Did you mean:`);
          for (const c of attackerMatch) {
            console.log(`  ${c.name}`);
          }
          process.exit(1);
        }

        // Parse target names - handle both array format and comma-separated
        let targetNames: string[] = [];
        if (Array.isArray(options.target)) {
          // Handle: -t name1 -t name2 or -t "name1" -t "name2"
          for (const t of options.target) {
            // Also split by comma in case user did -t "name1,name2"
            targetNames.push(...t.split(",").map((s: string) => s.trim()).filter((s: string) => s));
          }
        }

        if (targetNames.length < 2) {
          error("Multi-target attack requires at least 2 targets. Use 'attack' for single targets.");
          process.exit(1);
        }

        // Find all targets
        const targets: Combatant[] = [];
        for (const targetName of targetNames) {
          const targetMatch = findCombatant(targetName, combatants);
          if (!targetMatch) {
            error(`No combatant found matching "${targetName}"`);
            listCombatantNames(combatants);
            process.exit(1);
          }
          if (Array.isArray(targetMatch)) {
            error(`Ambiguous target "${targetName}". Did you mean:`);
            for (const c of targetMatch) {
              console.log(`  ${c.name}`);
            }
            process.exit(1);
          }
          targets.push(targetMatch);
        }

        // Get or roll swerve
        let swerve: SwerveResult;
        if (options.roll !== undefined) {
          const providedSwerve = parseInt(options.roll, 10);
          if (isNaN(providedSwerve)) {
            error("Invalid swerve value. Must be a number.");
            process.exit(1);
          }
          swerve = {
            positives: { sum: Math.max(0, providedSwerve), rolls: [Math.max(0, providedSwerve)] },
            negatives: { sum: Math.max(0, -providedSwerve), rolls: [Math.max(0, -providedSwerve)] },
            total: providedSwerve,
            boxcars: false,
          };
        } else {
          swerve = await rollSwerve();
        }

        // Parse custom damage allocation if provided
        let customDamageAllocation: number[] | undefined;
        if (options.damage) {
          const parsed = options.damage.split(",").map((s: string) => parseInt(s.trim(), 10));
          if (parsed.some(isNaN)) {
            error("Invalid damage allocation. Must be comma-separated numbers.");
            process.exit(1);
          }
          if (parsed.length !== targets.length) {
            error(`Damage allocation count (${parsed.length}) must match target count (${targets.length}).`);
            process.exit(1);
          }
          customDamageAllocation = parsed;
        }

        // Calculate multi-target attack result
        const result = calculateMultiTargetAttack(attackerMatch, targets, swerve, customDamageAllocation);

        // Display result
        console.log("");
        for (const line of formatMultiTargetAttackResult(result)) {
          console.log(line);
        }

        // Build updates for each target
        const updates: CombatUpdate[] = [];

        for (let i = 0; i < result.results.length; i++) {
          const r = result.results[i];
          const target = targets[i];

          // Build event details
          const eventDetails: Record<string, unknown> = {
            attacker_id: attackerMatch.id,
            attacker_name: attackerMatch.name,
            target_id: target.id,
            target_name: target.name,
            swerve: swerve.total,
            attack_total: result.attackRoll,
            defense: r.defense,
            outcome: r.outcome,
            hit: r.hit,
            multi_target: true,
            target_count: result.targetCount,
            allocated_damage: r.allocatedDamage,
          };

          if (r.hit) {
            eventDetails.smackdown = r.smackdown;
            eventDetails.wounds_dealt = r.woundsDealt;
            if (r.targetIsMook) {
              eventDetails.mooks_dropped = r.mooksDropped;
            }
          }

          const eventDescription = r.hit
            ? `${attackerMatch.name} attacks ${target.name} (multi-target ${i + 1}/${result.targetCount}) - HIT for ${r.targetIsMook ? `${r.mooksDropped} mooks dropped` : `${r.woundsDealt} wounds`}`
            : `${attackerMatch.name} attacks ${target.name} (multi-target ${i + 1}/${result.targetCount}) - MISS`;

          if (r.hit) {
            if (r.targetIsMook && r.mooksDropped) {
              const newCount = Math.max(0, (target.count || 0) - r.mooksDropped);
              updates.push({
                shot_id: target.shotId,
                character_id: target.id,
                count: newCount,
                event: {
                  event_type: "attack",
                  description: eventDescription,
                  details: eventDetails,
                },
              });
            } else if (r.woundsDealt > 0) {
              const isPC = target.characterType === "PC";
              const charInEnc = enc.shots
                .flatMap((s) => s.characters)
                .find((c) => c.id === target.id);
              const currentWounds = isPC
                ? (charInEnc?.action_values?.Wounds as number) || 0
                : (charInEnc?.count as number) || 0;
              const newWounds = currentWounds + r.woundsDealt;

              const update: CombatUpdate = {
                shot_id: target.shotId,
                character_id: target.id,
                event: {
                  event_type: "attack",
                  description: eventDescription,
                  details: eventDetails,
                },
              };

              if (isPC) {
                update.action_values = { Wounds: newWounds };
              } else {
                update.wounds = r.woundsDealt;
              }

              updates.push(update);
            } else {
              // Hit but 0 wounds
              updates.push({
                shot_id: target.shotId,
                character_id: target.id,
                event: {
                  event_type: "attack",
                  description: `${attackerMatch.name} attacks ${target.name} (multi-target) - HIT but 0 wounds (blocked by toughness)`,
                  details: eventDetails,
                },
              });
            }
          } else {
            // Miss - record event on attacker for first miss only (to avoid duplicate entries)
            if (i === 0 || !result.results.slice(0, i).some(prev => !prev.hit)) {
              updates.push({
                shot_id: target.shotId,
                character_id: target.id,
                event: {
                  event_type: "attack",
                  description: eventDescription,
                  details: eventDetails,
                },
              });
            }
          }
        }

        if (updates.length > 0) {
          await applyCombatAction(encounterId, updates);
          success("Multi-target combat action applied");
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to execute multi-target attack");
        process.exit(1);
      }
    });

  // WOUND - Apply wounds directly to a target
  encounter
    .command("wound <target> <wounds>")
    .description("Apply wounds directly to a character")
    .action(async (targetName, woundsStr) => {
      try {
        const encounterId = getCurrentEncounterId();
        if (!encounterId) {
          error("No encounter set. Use 'encounter set <fight-id>' first.");
          process.exit(1);
        }

        const woundsToApply = parseInt(woundsStr, 10);
        if (isNaN(woundsToApply) || woundsToApply < 1) {
          error("Invalid wound count. Must be a positive number.");
          process.exit(1);
        }

        // Get encounter and find target
        const enc = await getEncounter(encounterId);
        const combatants = extractCombatants(enc);
        const match = findCombatant(targetName, combatants);

        if (!match) {
          error(`No combatant found matching "${targetName}"`);
          listCombatantNames(combatants);
          process.exit(1);
        }
        if (Array.isArray(match)) {
          error(`Ambiguous name "${targetName}". Did you mean:`);
          for (const c of match) {
            console.log(`  ${c.name}`);
          }
          process.exit(1);
        }

        // Determine if target is a PC (wounds go to action_values) or NPC (wounds go to shot record)
        const isPC = match.characterType === "PC";

        // Get current wounds - PCs in action_values.Wounds, non-PCs in shot.count
        const charInEnc = enc.shots
          .flatMap((s) => s.characters)
          .find((c) => c.id === match.id);
        const currentWounds = isPC
          ? (charInEnc?.action_values?.Wounds as number) || 0
          : (charInEnc?.count as number) || 0;
        const newWounds = currentWounds + woundsToApply;

        // Apply wounds - method depends on character type
        const update: CombatUpdate = {
          shot_id: match.shotId,
          character_id: match.id,
        };

        if (isPC) {
          update.action_values = { Wounds: newWounds };
        } else {
          // For non-PCs, send incremental wounds (backend adds to shot.count)
          update.wounds = woundsToApply;
        }

        await applyCombatAction(encounterId, [update]);

        const woundResult = calculateWoundResult(match, woundsToApply, currentWounds);
        console.log("");
        for (const line of formatWoundResult(woundResult)) {
          console.log(line);
        }
        success("Wounds applied");
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to apply wounds");
        process.exit(1);
      }
    });

  // MOOKS - Adjust mook count
  encounter
    .command("mooks <target> <change>")
    .description("Adjust mook count (use negative number to reduce)")
    .action(async (targetName, changeStr) => {
      try {
        const encounterId = getCurrentEncounterId();
        if (!encounterId) {
          error("No encounter set. Use 'encounter set <fight-id>' first.");
          process.exit(1);
        }

        const change = parseInt(changeStr, 10);
        if (isNaN(change)) {
          error("Invalid change value. Must be a number (negative to reduce).");
          process.exit(1);
        }

        // Get encounter and find target
        const enc = await getEncounter(encounterId);
        const combatants = extractCombatants(enc);
        const match = findCombatant(targetName, combatants);

        if (!match) {
          error(`No combatant found matching "${targetName}"`);
          listCombatantNames(combatants);
          process.exit(1);
        }
        if (Array.isArray(match)) {
          error(`Ambiguous name "${targetName}". Did you mean:`);
          for (const c of match) {
            console.log(`  ${c.name}`);
          }
          process.exit(1);
        }

        if (match.characterType !== "Mook") {
          error(`${match.name} is not a mook group. Use 'wound' for named characters.`);
          process.exit(1);
        }

        const currentCount = match.count || 0;
        const newCount = Math.max(0, currentCount + change);

        // Apply count change
        await applyCombatAction(encounterId, [
          {
            shot_id: match.shotId,
            character_id: match.id,
            count: newCount,
          },
        ]);

        if (change < 0) {
          success(`${match.name}: ${currentCount} → ${newCount} mooks (${Math.abs(change)} dropped)`);
        } else {
          success(`${match.name}: ${currentCount} → ${newCount} mooks (${change} added)`);
        }

        if (newCount === 0) {
          warn("All mooks eliminated!");
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to adjust mook count");
        process.exit(1);
      }
    });

  // DROP - Shortcut to drop mooks (avoids negative number issue)
  encounter
    .command("drop <target> <count>")
    .description("Drop mooks from a mook group")
    .action(async (targetName, countStr) => {
      try {
        const encounterId = getCurrentEncounterId();
        if (!encounterId) {
          error("No encounter set. Use 'encounter set <fight-id>' first.");
          process.exit(1);
        }

        const dropCount = parseInt(countStr, 10);
        if (isNaN(dropCount) || dropCount < 1) {
          error("Invalid count. Must be a positive number.");
          process.exit(1);
        }

        // Get encounter and find target
        const enc = await getEncounter(encounterId);
        const combatants = extractCombatants(enc);
        const match = findCombatant(targetName, combatants);

        if (!match) {
          error(`No combatant found matching "${targetName}"`);
          listCombatantNames(combatants);
          process.exit(1);
        }
        if (Array.isArray(match)) {
          error(`Ambiguous name "${targetName}". Did you mean:`);
          for (const c of match) {
            console.log(`  ${c.name}`);
          }
          process.exit(1);
        }

        if (match.characterType !== "Mook") {
          error(`${match.name} is not a mook group. Use 'wound' for named characters.`);
          process.exit(1);
        }

        const currentCount = match.count || 0;
        const newCount = Math.max(0, currentCount - dropCount);

        // Apply count change
        await applyCombatAction(encounterId, [
          {
            shot_id: match.shotId,
            character_id: match.id,
            count: newCount,
          },
        ]);

        success(`${match.name}: ${currentCount} → ${newCount} mooks (${dropCount} dropped)`);

        if (newCount === 0) {
          warn("All mooks eliminated!");
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to drop mooks");
        process.exit(1);
      }
    });

  // BOOST - Apply Fortune boost effect
  encounter
    .command("boost <character>")
    .description("Character uses Fortune to boost a roll (for tracking)")
    .option("-f, --fortune <amount>", "Fortune points spent", "1")
    .action(async (characterName, options) => {
      try {
        const encounterId = getCurrentEncounterId();
        if (!encounterId) {
          error("No encounter set. Use 'encounter set <fight-id>' first.");
          process.exit(1);
        }

        const fortuneSpent = parseInt(options.fortune, 10) || 1;

        // Get encounter and find character
        const enc = await getEncounter(encounterId);
        const combatants = extractCombatants(enc);
        const match = findCombatant(characterName, combatants);

        if (!match) {
          error(`No combatant found matching "${characterName}"`);
          listCombatantNames(combatants);
          process.exit(1);
        }
        if (Array.isArray(match)) {
          error(`Ambiguous name "${characterName}". Did you mean:`);
          for (const c of match) {
            console.log(`  ${c.name}`);
          }
          process.exit(1);
        }

        // Roll the Fortune die (single exploding d6)
        const swerve = await rollSwerve();
        const fortuneBonus = swerve.positives.sum; // Use positive die as Fortune bonus

        console.log("");
        console.log(`${match.name} spends ${fortuneSpent} Fortune to boost`);
        console.log(`Fortune die: +${fortuneBonus} (${swerve.positives.rolls.join(", ")})`);
        info("Add this bonus to the action result");
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to apply boost");
        process.exit(1);
      }
    });

  // UP-CHECK - Roll Fortune check to stay conscious at 35+ wounds
  encounter
    .command("up-check <character>")
    .description("Roll an Up Check for a character at 35+ wounds")
    .action(async (characterName) => {
      try {
        const encounterId = getCurrentEncounterId();
        if (!encounterId) {
          error("No encounter set. Use 'encounter set <fight-id>' first.");
          process.exit(1);
        }

        // Get encounter and find character
        const enc = await getEncounter(encounterId);
        const combatants = extractCombatants(enc);
        const match = findCombatant(characterName, combatants);

        if (!match) {
          error(`No combatant found matching "${characterName}"`);
          listCombatantNames(combatants);
          process.exit(1);
        }
        if (Array.isArray(match)) {
          error(`Ambiguous name "${characterName}". Did you mean:`);
          for (const c of match) {
            console.log(`  ${c.name}`);
          }
          process.exit(1);
        }

        // Roll swerve for Up Check
        const swerve = await rollSwerve();

        console.log("");
        console.log(`${match.name} makes an Up Check`);
        console.log(
          `Swerve: ${swerve.total >= 0 ? "+" : ""}${swerve.total} (positive: ${swerve.positives.rolls.join(", ")}, negative: ${swerve.negatives.rolls.join(", ")})`
        );

        // Target is 0 (or positive with impairments)
        const target = match.impairments || 0;
        const result = swerve.total;

        if (result >= target) {
          success(`SUCCESS! ${match.name} stays conscious.`);
        } else {
          warn(`FAILED! ${match.name} goes down.`);

          // Mark as out_of_fight via status
          await applyCombatAction(encounterId, [
            {
              shot_id: match.shotId,
              character_id: match.id,
              add_status: ["out_of_fight"],
              remove_status: ["up_check_required"],
            },
          ]);
          info("Character marked as out of fight");
        }

        if (swerve.boxcars) {
          warn("BOXCARS! Something dramatic happens!");
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to perform Up Check");
        process.exit(1);
      }
    });

  // HEAL - Remove wounds from a character
  encounter
    .command("heal <target> <wounds>")
    .description("Heal wounds from a character")
    .action(async (targetName, woundsStr) => {
      try {
        const encounterId = getCurrentEncounterId();
        if (!encounterId) {
          error("No encounter set. Use 'encounter set <fight-id>' first.");
          process.exit(1);
        }

        const woundsToHeal = parseInt(woundsStr, 10);
        if (isNaN(woundsToHeal) || woundsToHeal < 1) {
          error("Invalid wound count. Must be a positive number.");
          process.exit(1);
        }

        // Get encounter and find target
        const enc = await getEncounter(encounterId);
        const combatants = extractCombatants(enc);
        const match = findCombatant(targetName, combatants);

        if (!match) {
          error(`No combatant found matching "${targetName}"`);
          listCombatantNames(combatants);
          process.exit(1);
        }
        if (Array.isArray(match)) {
          error(`Ambiguous name "${targetName}". Did you mean:`);
          for (const c of match) {
            console.log(`  ${c.name}`);
          }
          process.exit(1);
        }

        // Determine if target is a PC (wounds in action_values) or NPC (wounds in shot.count)
        const isPC = match.characterType === "PC";

        // Get current wounds - PCs in action_values.Wounds, non-PCs in shot.count
        const charInEnc = enc.shots
          .flatMap((s) => s.characters)
          .find((c) => c.id === match.id);
        const currentWounds = isPC
          ? (charInEnc?.action_values?.Wounds as number) || 0
          : (charInEnc?.count as number) || 0;
        const newWounds = Math.max(0, currentWounds - woundsToHeal);

        // Apply healing - method depends on character type
        const update: CombatUpdate = {
          shot_id: match.shotId,
          character_id: match.id,
        };

        if (isPC) {
          update.action_values = { Wounds: newWounds };
        } else {
          // For non-PCs, use count to set absolute wound value
          update.count = newWounds;
        }

        await applyCombatAction(encounterId, [update]);

        console.log("");
        success(`${match.name}: ${currentWounds} → ${newWounds} wounds (${woundsToHeal} healed)`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to heal");
        process.exit(1);
      }
    });

  // START - Start the encounter (set sequence to 1)
  encounter
    .command("start")
    .description("Start the encounter (sets sequence to 1)")
    .action(async () => {
      try {
        const encounterId = getCurrentEncounterId();
        if (!encounterId) {
          error("No encounter set. Use 'encounter set <fight-id>' first.");
          process.exit(1);
        }

        const enc = await getEncounter(encounterId);

        if (enc.sequence > 0) {
          warn(`Fight already started at sequence ${enc.sequence}`);
          return;
        }

        // Update fight sequence to 1 and set started_at
        await updateFight(encounterId, {
          sequence: 1,
          started_at: new Date().toISOString()
        });

        success(`Fight "${enc.name}" started!`);
        info(`Sequence: 1`);
        info(`Use 'encounter initiative' to roll initiative for all combatants.`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to start encounter");
        process.exit(1);
      }
    });

  // END - End the encounter
  encounter
    .command("end")
    .description("End the encounter (sets ended_at timestamp)")
    .action(async () => {
      try {
        const encounterId = getCurrentEncounterId();
        if (!encounterId) {
          error("No encounter set. Use 'encounter set <fight-id>' first.");
          process.exit(1);
        }

        const enc = await getEncounter(encounterId);

        if (enc.ended_at) {
          warn(`Fight "${enc.name}" already ended.`);
          return;
        }

        if (!enc.started_at) {
          warn(`Fight "${enc.name}" was never started.`);
        }

        // Update fight with ended_at timestamp
        await updateFight(encounterId, {
          ended_at: new Date().toISOString()
        });

        success(`Fight "${enc.name}" ended!`);
        info(`Sequence: ${enc.sequence}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to end encounter");
        process.exit(1);
      }
    });

  // INITIATIVE - Roll initiative for all combatants
  encounter
    .command("initiative")
    .description("Roll initiative for all combatants (Speed + swerve)")
    .action(async () => {
      try {
        const encounterId = getCurrentEncounterId();
        if (!encounterId) {
          error("No encounter set. Use 'encounter set <fight-id>' first.");
          process.exit(1);
        }

        const enc = await getEncounter(encounterId);

        // Make sure fight is started
        if (enc.sequence === 0) {
          info("Starting fight first...");
          await updateFight(encounterId, {
            sequence: 1,
            started_at: new Date().toISOString()
          });
        }

        // Get all combatants
        const combatants = extractCombatants(enc);

        if (combatants.length === 0) {
          error("No combatants in this encounter.");
          process.exit(1);
        }

        console.log(`\nRolling initiative for ${combatants.length} combatants...\n`);

        // Roll initiative for each combatant
        const initiativeUpdates: { id: string; shot: number; name: string; speed: number; swerve: number }[] = [];

        for (const combatant of combatants) {
          // Roll swerve
          const swerve = await rollSwerve();

          // Get speed (default to 5 if not set)
          let speed = 5;
          if (combatant.type === "character") {
            const charData = enc.shots
              .flatMap((s) => s.characters)
              .find((c) => c.id === combatant.id);
            const actionValues = charData?.action_values || {};
            const speedValue = actionValues.Speed;
            if (typeof speedValue === "number") {
              speed = speedValue;
            } else if (typeof speedValue === "string") {
              speed = parseInt(speedValue, 10) || 5;
            }
          }

          // Calculate initiative: Speed + swerve
          const initiative = speed + swerve.total;

          initiativeUpdates.push({
            id: combatant.shotId,
            shot: initiative,
            name: combatant.name,
            speed,
            swerve: swerve.total,
          });
        }

        // Sort by initiative (highest first) for display
        initiativeUpdates.sort((a, b) => b.shot - a.shot);

        // Display initiative rolls
        for (const init of initiativeUpdates) {
          const swerveSign = init.swerve >= 0 ? "+" : "";
          console.log(
            `  ${init.name}: Speed ${init.speed} ${swerveSign}${init.swerve} = Shot ${init.shot}`
          );
        }

        // Apply the initiative updates
        await updateInitiatives(
          encounterId,
          initiativeUpdates.map((i) => ({ id: i.id, shot: i.shot }))
        );

        console.log("");
        success(`Initiative rolled for ${combatants.length} combatants!`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to roll initiative");
        process.exit(1);
      }
    });

  // LOCATION - Set a character's location in the fight
  encounter
    .command("location <character> <location>")
    .description("Set a character's location in the current fight")
    .action(async (characterName, locationStr) => {
      try {
        const encounterId = getCurrentEncounterId();
        if (!encounterId) {
          error("No encounter set. Use 'encounter set <fight-id>' first.");
          process.exit(1);
        }

        // Get encounter and find character
        const enc = await getEncounter(encounterId);
        const combatants = extractCombatants(enc);
        const match = findCombatant(characterName, combatants);

        if (!match) {
          error(`No combatant found matching "${characterName}"`);
          listCombatantNames(combatants);
          process.exit(1);
        }
        if (Array.isArray(match)) {
          error(`Ambiguous name "${characterName}". Did you mean:`);
          for (const c of match) {
            console.log(`  ${c.name}`);
          }
          process.exit(1);
        }

        const oldLocation = match.location || "(none)";

        // Update location via direct shot update
        await updateShotLocation(encounterId, match.shotId, locationStr);

        success(`${match.name}: ${oldLocation} → ${locationStr}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to set location");
        process.exit(1);
      }
    });
}

// Helper to list combatant names for error messages
function listCombatantNames(combatants: Combatant[]): void {
  console.log("\nCombatants in this fight:");
  for (const c of combatants) {
    console.log(`  ${c.name}`);
  }
}
