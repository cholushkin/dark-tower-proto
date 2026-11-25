import type { BattleVisualizationViewModel } from './BattleVisualizationViewModel';

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function* playbackRounds(model: BattleVisualizationViewModel, random = Math.random) {
  const maxHealth = new Map([...model.attackers, ...model.defenders].map(unit => [unit.id, unit.initialHealth]));
  const displayedHealth = new Map(maxHealth);
  const attackerIds = new Set(model.attackers.map(unit => unit.id));
  const ratio = (id: string, health: number) => Math.min(1, Math.max(0, health / maxHealth.get(id)!));

  for (const [index, round] of model.rounds.entries()) {
    const attackers = round.hits.filter(hit => attackerIds.has(hit.attackerId));
    const defenders = round.hits.filter(hit => !attackerIds.has(hit.attackerId));
    // Spread both sides' actions through the round, even when one side has far fewer units.
    const order = [attackers, defenders].flatMap(side => shuffled(side, random).map((hit, slot) => ({
      hit,
      moment: (slot + random()) / side.length,
    }))).sort((a, b) => a.moment - b.moment);
    // All recorded actions play. Only the recorded round-end snapshot can mark a unit defeated.
    const hits = order.map(({ hit }) => {
      const nextHealth = displayedHealth.get(hit.targetId)! - hit.damage;
      displayedHealth.set(hit.targetId, nextHealth);
      return { ...hit, healthRatio: ratio(hit.targetId, nextHealth) };
    });
    const endHealth = round.endHealth.map(({ unitId, health }) => {
      displayedHealth.set(unitId, health);
      return { unitId, healthRatio: ratio(unitId, health), defeated: health <= 0 };
    });
    yield { index, hits, endHealth };
  }
}

export interface BattlePoint { readonly x: number; readonly y: number }

export function battleFormation(attackerCount: number, defenderCount: number, random = Math.random) {
  const largestSide = Math.max(1, attackerCount, defenderCount);
  const columns = Math.ceil(Math.sqrt(largestSide / 2));
  const rows = Math.ceil(largestSide / columns);
  const cellWidth = .40 / columns;
  const cellHeight = .80 / rows;
  const unitSize = Math.min(.13, cellWidth * .82, cellHeight * .72);
  const cells = Array.from({ length: columns * rows }, (_, index) => index);

  // One randomly jittered position per cell leaves clearance for the portrait and health bar.
  const positions = (count: number, offset: number): BattlePoint[] =>
    shuffled(cells, random).slice(0, count).map(cell => ({
      x: offset + .05 + (cell % columns + .5) * cellWidth + (random() - .5) * (cellWidth - unitSize * 1.12),
      y: .12 + (Math.floor(cell / columns) + .5) * cellHeight + (random() - .5) * (cellHeight - unitSize * 1.25),
    }));

  return { unitSize, attackers: positions(attackerCount, 0), defenders: positions(defenderCount, .5) };
}
