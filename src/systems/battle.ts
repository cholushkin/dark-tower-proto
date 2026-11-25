import type { BattleReplay, BattleReplayRound, BattleReplayUnit } from "../model/types";

export interface BattleUnit {
    id: string;
    rank: number;
    health: number;
    attack: number;
    defense: number;
}

function selectHits(units: readonly BattleUnit[], targets: readonly BattleUnit[], rng: () => number) {
    return units.map(attacker => {
        const target = targets[Math.min(targets.length - 1, Math.floor(rng() * targets.length))];
        return { attacker, target, damage: Math.max(1, attacker.attack - target.defense) };
    });
}

export function simulateBattle(
    attackingUnits: readonly BattleUnit[],
    defendingUnits: readonly BattleUnit[],
    rng: () => number,
    logTurn: (message: string) => void,
): { attackers: BattleUnit[]; defenders: BattleUnit[]; replay: BattleReplay } {
    let attackers = attackingUnits.filter(unit => unit.health > 0);
    let defenders = defendingUnits.filter(unit => unit.health > 0);
    const rounds: BattleReplayRound[] = [];
    const snapshot = ({ id, rank, health }: BattleUnit): BattleReplayUnit => ({ id, rank, health });
    const replay = { attackers: attackers.map(snapshot), defenders: defenders.map(snapshot), rounds };
    while (attackers.length > 0 && defenders.length > 0) {
        const hits = [...selectHits(attackers, defenders, rng), ...selectHits(defenders, attackers, rng)];
        const incomingDamage = new Map<BattleUnit, number>();
        for (const { target, damage } of hits) {
            incomingDamage.set(target, (incomingDamage.get(target) ?? 0) + damage);
        }

        const healthChanges: string[] = [];
        const endHealth: BattleReplayRound["endHealth"][number][] = [];
        const applyDamage = (unit: BattleUnit): BattleUnit => {
            const health = unit.health - (incomingDamage.get(unit) ?? 0);
            healthChanges.push(`${unit.id} ${unit.health} → ${health} HP${health <= 0 ? " (defeated)" : ""}`);
            endHealth.push({ unitId: unit.id, health });
            return { ...unit, health };
        };
        attackers = attackers.map(applyDamage).filter(unit => unit.health > 0);
        defenders = defenders.map(applyDamage).filter(unit => unit.health > 0);

        const recordedHits = hits.map(({ attacker, target, damage }) => ({ attackerId: attacker.id, targetId: target.id, damage }));
        rounds.push({ hits: recordedHits, endHealth });
        const hitLog = recordedHits.map(({ attackerId, targetId, damage }) => `${attackerId} → ${targetId} for ${damage}`);
        logTurn(`Turn ${rounds.length} | Hits: ${hitLog.join(", ")} | ${healthChanges.join(", ")}`);
    }
    return { attackers, defenders, replay };
}
