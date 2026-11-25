import { actionButton, createPopupFrame, element } from '../../components/PopupFrame/PopupFrame';
import type { BattleVisualizationUnit, BattleVisualizationViewModel } from './BattleVisualizationViewModel';
import { battleFormation, playbackRounds, type BattlePoint } from './BattlePlayback';
import '../../components/PopupFrame/PopupFrame.css';
import '../../components/MinionComponent/MinionComponent.css';
import './BattleVisualizationView.css';

function position({ x, y }: BattlePoint) {
  return { left: `${x * 100}%`, top: `${y * 100}%` };
}

function createUnit(unit: BattleVisualizationUnit, side: 'attacker' | 'defender', home: BattlePoint) {
  const root = element('div', `dt-battle__unit dt-battle__unit--${side}`);
  const card = element('div', 'dt-minion');
  const portrait = element('div', 'dt-minion__portrait');
  const image = element('img', 'dt-minion__portrait-texture');
  image.src = unit.portrait.src;
  image.alt = unit.portrait.alt;
  portrait.append(image);
  card.append(portrait, element('span', 'dt-minion__rank', unit.rankLabel));

  const health = element('div', 'dt-battle__health');
  const fill = element('span');
  health.setAttribute('aria-hidden', 'true');
  health.append(fill);
  root.append(card, health);
  Object.assign(root.style, position(home));

  return {
    root, home, side,
    setHealth(ratio: number) { fill.style.transform = `scaleX(${ratio})`; },
    markDefeated() { root.classList.add('dt-battle__unit--defeated'); },
  };
}

async function animate(
  target: HTMLElement, keyframes: Keyframe[], duration: number, signal: AbortSignal,
  easing = 'ease-out',
): Promise<void> {
  if (signal.aborted) return;
  const animation = target.animate(keyframes, { duration, easing });
  const cancel = () => animation.cancel();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    await animation.finished;
  } catch (error) {
    if (!signal.aborted) throw error;
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}

export function mountBattleVisualizationView(
  host: HTMLElement, model: BattleVisualizationViewModel, onClose: () => void,
): { destroy(): void } {
  const backdrop = element('div', 'dt-battle__backdrop');
  const frame = createPopupFrame({ title: 'Battle Replay', modifier: 'battle', caption: 'plain', onClose });
  const close = frame.close!;
  const battlefield = element('div', 'dt-battle__field');
  const landscape = element('img', 'dt-battle__landscape');
  landscape.src = model.backgroundUrl;
  landscape.alt = '';
  const formations = element('div', 'dt-battle__formations');
  const attackers = element('div', 'dt-battle__side');
  const defenders = element('div', 'dt-battle__side');
  attackers.setAttribute('role', 'group');
  attackers.setAttribute('aria-label', 'Attackers');
  defenders.setAttribute('role', 'group');
  defenders.setAttribute('aria-label', 'Defenders');
  formations.append(attackers, defenders);
  battlefield.append(landscape, element('div', 'dt-battle__line'), formations);
  frame.body.append(battlefield);

  const progress = element('div', 'dt-battle__progress');
  const roundLabel = element('span', 'dt-battle__round-label', model.rounds.length ? 'Round' : 'No combat rounds');
  const rounds = element('ol', 'dt-battle__rounds');
  rounds.setAttribute('aria-label', 'Battle rounds');
  const indicators = model.rounds.map((_, index) => {
    const indicator = element('li', 'dt-battle__round', String(index + 1));
    rounds.append(indicator);
    return indicator;
  });
  progress.append(roundLabel);
  if (indicators.length) progress.append(rounds);

  let playback: AbortController | undefined;
  let activeRound: HTMLElement | undefined;
  const replay = actionButton('Replay', 'gold', restart);
  frame.footer.append(progress, replay);
  backdrop.append(frame.root);
  host.append(backdrop);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) onClose(); });
  backdrop.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      (document.activeElement === close ? replay : close).focus();
    }
  });

  function restart(): void {
    playback?.abort();
    playback = new AbortController();
    activeRound?.removeAttribute('aria-current');
    activeRound = undefined;
    rounds.scrollLeft = 0;
    void play(playback.signal);
  }

  async function play(signal: AbortSignal): Promise<void> {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const formation = battleFormation(model.attackers.length, model.defenders.length);
    battlefield.style.setProperty('--dt-battle-unit-size', `${formation.unitSize * 100}%`);
    const units = new Map<string, ReturnType<typeof createUnit>>();
    for (const side of ['attacker', 'defender'] as const) {
      const isAttacker = side === 'attacker';
      const roster = isAttacker ? model.attackers : model.defenders;
      const positions = isAttacker ? formation.attackers : formation.defenders;
      const nodes = roster.map((unit, index) => {
        const node = createUnit(unit, side, positions[index]);
        units.set(unit.id, node);
        return node.root;
      });
      (isAttacker ? attackers : defenders).replaceChildren(...nodes);
    }

    await Promise.all([...units.values()].map(unit => animate(unit.root,
      [position({ x: unit.side === 'attacker' ? .25 : .75, y: .53 }), position(unit.home)],
      reduceMotion ? 0 : 560, signal,
    )));
    if (signal.aborted) return;

    for (const round of playbackRounds(model)) {
      activeRound?.removeAttribute('aria-current');
      activeRound = indicators[round.index];
      activeRound.setAttribute('aria-current', 'step');
      rounds.scrollLeft = activeRound.offsetLeft - (rounds.clientWidth - activeRound.clientWidth) / 2;

      for (const hit of round.hits) {
        const actor = units.get(hit.attackerId)!;
        const target = units.get(hit.targetId)!;
        const towards = {
          x: actor.home.x + (target.home.x - actor.home.x) * .55,
          y: actor.home.y + (target.home.y - actor.home.y) * .55,
        };
        const edge = formation.unitSize / 2 + .012;
        const impact = {
          x: actor.side === 'attacker' ? Math.min(towards.x, .5 - edge) : Math.max(towards.x, .5 + edge),
          y: towards.y,
        };
        actor.root.classList.add('dt-battle__unit--acting');
        if (!reduceMotion) await animate(actor.root, [position(actor.home), position(impact)], 175, signal, 'ease-in');
        if (signal.aborted) return;

        target.setHealth(hit.healthRatio);
        const damage = element('span', 'dt-battle__damage', `−${hit.damage}`);
        Object.assign(damage.style, position({ x: target.home.x, y: target.home.y - formation.unitSize * .48 }));
        battlefield.append(damage);
        // The text stays long enough to read before the next recorded attack begins.
        const float = animate(damage, reduceMotion
          ? [{ opacity: 1 }, { opacity: 1 }]
          : [{ translate: '0 0', opacity: 1 }, { translate: '0 -12px', opacity: 1, offset: .7 }, { translate: '0 -24px', opacity: 0 }],
        390, signal);
        await Promise.all([float, reduceMotion ? undefined : animate(actor.root, [position(impact), position(actor.home)], 185, signal)]);
        damage.remove();
        if (signal.aborted) return;
        actor.root.classList.remove('dt-battle__unit--acting');
      }

      for (const change of round.endHealth) {
        const unit = units.get(change.unitId)!;
        unit.setHealth(change.healthRatio);
        if (change.defeated) unit.markDefeated();
      }
    }
  }

  close.focus();
  restart();
  return { destroy() { playback?.abort(); backdrop.remove(); } };
}
