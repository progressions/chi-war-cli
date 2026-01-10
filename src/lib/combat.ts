/**
 * Feng Shui 2 Combat Calculations
 *
 * Combat flow:
 * 1. Attack roll = Swerve + Attack Value
 * 2. Compare to target's Defense
 * 3. If hit: Outcome = Attack Roll - Defense
 * 4. Smackdown = Outcome + Damage bonus
 * 5. For non-mooks: Wounds = Smackdown - Toughness (minimum 0)
 * 6. For mooks: Each point of Smackdown drops 1 mook
 */

import type { Combatant, SwerveResult } from "../types/index.js";

export interface AttackResult {
  attacker: string;
  target: string;
  swerve: SwerveResult;
  attackRoll: number;
  defense: number;
  hit: boolean;
  outcome: number;
  damage: number;
  smackdown: number;
  toughness: number;
  woundsDealt: number;
  mooksDropped?: number;
  targetIsMook: boolean;
  boxcars: boolean;
}

export interface WoundResult {
  target: string;
  woundsApplied: number;
  previousWounds: number;
  newWounds: number;
  impairmentChange: number;
  newImpairment: number;
}

/**
 * Calculate attack result given attacker, target, and swerve
 */
export function calculateAttack(
  attacker: Combatant,
  target: Combatant,
  swerve: SwerveResult,
  targetCount?: number
): AttackResult {
  const attackValue = attacker.attackValue ?? 7; // Default attack value
  const damage = attacker.damage ?? 7; // Default damage
  const defense = target.defense ?? 13; // Default defense
  const toughness = target.toughness ?? 5; // Default toughness
  const targetIsMook = target.characterType === "Mook";

  // Apply impairments to attack
  const effectiveAttack = attackValue - (attacker.impairments || 0);
  const attackRoll = swerve.total + effectiveAttack;

  const hit = attackRoll >= defense;
  const outcome = hit ? attackRoll - defense : 0;
  const smackdown = hit ? outcome + damage : 0;

  let woundsDealt = 0;
  let mooksDropped: number | undefined;

  if (hit) {
    if (targetIsMook) {
      // For mooks, each point of smackdown drops one mook
      // If targeting specific count, cap at that count
      const maxMooks = targetCount ?? target.count ?? 1;
      mooksDropped = Math.min(smackdown, maxMooks);
    } else {
      // For non-mooks, wounds = smackdown - toughness
      woundsDealt = Math.max(0, smackdown - toughness);
    }
  }

  return {
    attacker: attacker.name,
    target: target.name,
    swerve,
    attackRoll,
    defense,
    hit,
    outcome,
    damage,
    smackdown,
    toughness,
    woundsDealt,
    mooksDropped,
    targetIsMook,
    boxcars: swerve.boxcars,
  };
}

/**
 * Calculate impairment level from wounds
 * Feng Shui 2 impairment thresholds:
 * - 25-29 wounds: -1 impairment
 * - 30-34 wounds: -2 impairment
 * - 35+ wounds: incapacitated (we'll show -3)
 */
export function calculateImpairment(wounds: number): number {
  if (wounds >= 35) return 3;
  if (wounds >= 30) return 2;
  if (wounds >= 25) return 1;
  return 0;
}

/**
 * Calculate wound application result
 */
export function calculateWoundResult(
  target: Combatant,
  woundsToApply: number,
  currentWounds: number = 0
): WoundResult {
  const previousWounds = currentWounds;
  const newWounds = previousWounds + woundsToApply;

  const previousImpairment = calculateImpairment(previousWounds);
  const newImpairment = calculateImpairment(newWounds);
  const impairmentChange = newImpairment - previousImpairment;

  return {
    target: target.name,
    woundsApplied: woundsToApply,
    previousWounds,
    newWounds,
    impairmentChange,
    newImpairment,
  };
}

/**
 * Format attack result for display
 */
export function formatAttackResult(result: AttackResult): string[] {
  const lines: string[] = [];

  // Header
  lines.push(`${result.attacker} attacks ${result.target}`);

  // Swerve details
  const posRolls = result.swerve.positives.rolls.join(", ");
  const negRolls = result.swerve.negatives.rolls.join(", ");
  const swerveSign = result.swerve.total >= 0 ? "+" : "";
  lines.push(`Swerve: ${swerveSign}${result.swerve.total} (positive: ${posRolls}, negative: ${negRolls})`);

  // Attack calculation
  lines.push(`Attack: ${result.attackRoll} vs Defense ${result.defense}`);

  if (result.boxcars) {
    lines.push("⚠️  BOXCARS! Something dramatic happens!");
  }

  if (!result.hit) {
    lines.push("Result: MISS");
    return lines;
  }

  // Hit results
  lines.push(`Outcome: ${result.outcome}`);
  lines.push(`Smackdown: ${result.outcome} + ${result.damage} damage = ${result.smackdown}`);

  if (result.targetIsMook && result.mooksDropped !== undefined) {
    lines.push(`Mooks dropped: ${result.mooksDropped}`);
  } else {
    lines.push(`Wounds: ${result.smackdown} - ${result.toughness} toughness = ${result.woundsDealt}`);
  }

  return lines;
}

/**
 * Format wound result for display
 */
export function formatWoundResult(result: WoundResult): string[] {
  const lines: string[] = [];

  lines.push(`${result.target}: ${result.previousWounds} → ${result.newWounds} wounds`);

  if (result.impairmentChange > 0) {
    lines.push(`Impairment increased to -${result.newImpairment}`);
  }

  if (result.newWounds >= 35) {
    lines.push("⚠️  CHARACTER DOWN! (35+ wounds)");
  } else if (result.newWounds >= 30) {
    lines.push("⚠️  Critical condition (30+ wounds, -2 impairment)");
  } else if (result.newWounds >= 25) {
    lines.push("⚠️  Wounded badly (25+ wounds, -1 impairment)");
  }

  return lines;
}
