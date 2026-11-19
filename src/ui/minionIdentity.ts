import { MINION_IDENTITIES, type MinionIdentityDef } from '../data/minions';
import type { MinionPortrait } from './components/MinionComponent/MinionComponent.types';
import { asset } from './screens/assets';

// Keep each runtime minion paired with one configured identity across all screens.
const identitiesById = new Map<string, MinionIdentityDef>();
function identityFor(id: string): MinionIdentityDef {
  let identity = identitiesById.get(id);
  if (!identity) {
    identity = MINION_IDENTITIES[identitiesById.size % MINION_IDENTITIES.length];
    identitiesById.set(id, identity);
  }
  return identity;
}
export function nameFor(id: string): string {
  return identityFor(id).name;
}
export function portraitFor(id: string): MinionPortrait {
  const identity = identityFor(id);
  return { kind: 'texture', src: asset(identity.avatar), alt: `Portrait of ${identity.name}` };
}
