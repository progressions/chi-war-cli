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

// =============================================================================
// Multi-Target Attack (Feng Shui 2 Rules)
// =============================================================================

export interface MultiTargetAttackResult {
  attacker: string;
  swerve: SwerveResult;
  attackRoll: number;
  boxcars: boolean;
  totalDamage: number;
  targetCount: number;
  damagePerTarget: number[];
  results: SingleTargetResult[];
}

export interface SingleTargetResult {
  target: string;
  defense: number;
  hit: boolean;
  outcome: number;
  allocatedDamage: number;
  smackdown: number;
  toughness: number;
  woundsDealt: number;
  mooksDropped?: number;
  targetIsMook: boolean;
}

/**
 * Split damage evenly among targets with optional custom allocation.
 * If customAllocation is provided, it must sum to totalDamage.
 */
export function splitDamage(
  totalDamage: number,
  targetCount: number,
  customAllocation?: number[]
): number[] {
  if (customAllocation && customAllocation.length === targetCount) {
    const sum = customAllocation.reduce((a, b) => a + b, 0);
    if (sum === totalDamage) {
      return customAllocation;
    }
    // If sum doesn't match, fall through to even split
  }

  // Even split with remainder distributed to first targets
  const baseDamage = Math.floor(totalDamage / targetCount);
  const remainder = totalDamage % targetCount;

  const allocation: number[] = [];
  for (let i = 0; i < targetCount; i++) {
    allocation.push(baseDamage + (i < remainder ? 1 : 0));
  }

  return allocation;
}

/**
 * Calculate multi-target attack result.
 *
 * Feng Shui 2 Multi-Target Rules:
 * - One attack roll, compare vs each target's Defense
 * - Damage is split evenly among all targets
 * - Remainder distributed as attacker chooses (or evenly)
 * - Each target takes wounds = (allocated damage + outcome) - toughness
 */
export function calculateMultiTargetAttack(
  attacker: Combatant,
  targets: Combatant[],
  swerve: SwerveResult,
  customDamageAllocation?: number[]
): MultiTargetAttackResult {
  const attackValue = attacker.attackValue ?? 7;
  const totalDamage = attacker.damage ?? 7;

  // Apply impairments to attack
  const effectiveAttack = attackValue - (attacker.impairments || 0);
  const attackRoll = swerve.total + effectiveAttack;

  // Split damage among targets
  const damagePerTarget = splitDamage(totalDamage, targets.length, customDamageAllocation);

  const results: SingleTargetResult[] = [];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const allocatedDamage = damagePerTarget[i];
    const defense = target.defense ?? 13;
    const toughness = target.toughness ?? 5;
    const targetIsMook = target.characterType === "Mook";

    const hit = attackRoll >= defense;
    const outcome = hit ? attackRoll - defense : 0;
    // Smackdown uses allocated damage portion, not total damage
    const smackdown = hit ? outcome + allocatedDamage : 0;

    let woundsDealt = 0;
    let mooksDropped: number | undefined;

    if (hit) {
      if (targetIsMook) {
        // Each point of smackdown drops one mook
        const maxMooks = target.count ?? 1;
        mooksDropped = Math.min(smackdown, maxMooks);
      } else {
        // Wounds = smackdown - toughness
        woundsDealt = Math.max(0, smackdown - toughness);
      }
    }

    results.push({
      target: target.name,
      defense,
      hit,
      outcome,
      allocatedDamage,
      smackdown,
      toughness,
      woundsDealt,
      mooksDropped,
      targetIsMook,
    });
  }

  return {
    attacker: attacker.name,
    swerve,
    attackRoll,
    boxcars: swerve.boxcars,
    totalDamage,
    targetCount: targets.length,
    damagePerTarget,
    results,
  };
}

/**
 * Format multi-target attack result for display
 */
export function formatMultiTargetAttackResult(result: MultiTargetAttackResult): string[] {
  const lines: string[] = [];

  // Header
  const targetNames = result.results.map(r => r.target).join(", ");
  lines.push(`${result.attacker} attacks ${result.targetCount} targets: ${targetNames}`);

  // Swerve details
  const posRolls = result.swerve.positives.rolls.join(", ");
  const negRolls = result.swerve.negatives.rolls.join(", ");
  const swerveSign = result.swerve.total >= 0 ? "+" : "";
  lines.push(`Swerve: ${swerveSign}${result.swerve.total} (positive: ${posRolls}, negative: ${negRolls})`);
  lines.push(`Attack Roll: ${result.attackRoll}`);

  if (result.boxcars) {
    lines.push("⚠️  BOXCARS! Something dramatic happens!");
  }

  // Damage split
  lines.push(`Total Damage: ${result.totalDamage} split as [${result.damagePerTarget.join(", ")}]`);
  lines.push("");

  // Results per target
  for (let i = 0; i < result.results.length; i++) {
    const r = result.results[i];
    lines.push(`--- ${r.target} (Defense ${r.defense}) ---`);

    if (!r.hit) {
      lines.push(`  Result: MISS (needed ${r.defense}, rolled ${result.attackRoll})`);
    } else {
      lines.push(`  Result: HIT! Outcome ${r.outcome}`);
      lines.push(`  Smackdown: ${r.outcome} + ${r.allocatedDamage} damage = ${r.smackdown}`);

      if (r.targetIsMook && r.mooksDropped !== undefined) {
        lines.push(`  Mooks dropped: ${r.mooksDropped}`);
      } else {
        lines.push(`  Wounds: ${r.smackdown} - ${r.toughness} toughness = ${r.woundsDealt}`);
      }
    }
    lines.push("");
  }

  // Summary
  const hits = result.results.filter(r => r.hit).length;
  const misses = result.results.filter(r => !r.hit).length;
  const totalWounds = result.results
    .filter(r => !r.targetIsMook)
    .reduce((sum, r) => sum + r.woundsDealt, 0);
  const totalMooks = result.results
    .filter(r => r.targetIsMook)
    .reduce((sum, r) => sum + (r.mooksDropped || 0), 0);

  lines.push(`Summary: ${hits} hit, ${misses} miss`);
  if (totalWounds > 0) {
    lines.push(`  Total wounds dealt: ${totalWounds}`);
  }
  if (totalMooks > 0) {
    lines.push(`  Total mooks dropped: ${totalMooks}`);
  }

  return lines;
}
