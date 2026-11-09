import { DAY_END, DAY_START, DRINKS, RANGE, defaultServing, inRange, type Cup, type DrinkId, type Limits, type Serving } from './model.ts';

/* Settings live in the URL hash, so any day can be shared as a link:
 *   #cups=480c240,660e30&bed=1380&hl=5&thr=50
 * A cup is minutes since midnight, a drink code and an amount (ml, or mg for pills). */

export interface Settings extends Limits {
  cups: Cup[];
}

export const MAX_CUPS = 10;

export const defaults = (): Settings => ({
  cups: [8, 11, 15.5].map((t) => ({ t, ...defaultServing() })),
  bed: 23,
  halfLife: 5,
  threshold: 50,
});

const BY_CODE = new Map(Object.entries(DRINKS).map(([id, d]) => [d.code, id as DrinkId]));
const TOKEN = /^(\d+)([a-z])?(\d+(?:\.\d+)?)?$/;

export function decode(hash: string): Settings {
  const s = defaults();
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const num = (key: string) => {
    const v = Number.parseFloat(q.get(key) ?? '');
    return Number.isFinite(v) ? v : null;
  };

  const cups = q.get('cups');
  if (cups !== null) s.cups = parseCups(cups, num('mg'));
  const bed = num('bed');
  if (bed !== null && inRange(bed / 60, RANGE.bed)) s.bed = bed / 60;
  const halfLife = num('hl');
  if (halfLife !== null && inRange(halfLife, RANGE.halfLife)) s.halfLife = halfLife;
  const threshold = num('thr');
  if (threshold !== null && inRange(threshold, RANGE.threshold)) s.threshold = threshold;
  return s;
}

function parseCups(raw: string, legacyMg: number | null): Cup[] {
  const cups: Cup[] = [];
  for (const token of raw.split(',')) {
    const m = TOKEN.exec(token.trim());
    if (!m) continue;
    const minutes = Number(m[1]);
    if (minutes < DAY_START * 60 || minutes >= DAY_END * 60) continue;
    const serving = parseServing(m[2], m[3], legacyMg);
    if (!serving) continue;
    cups.push({ t: minutes / 60, ...serving });
    if (cups.length >= MAX_CUPS) break;
  }
  return cups;
}

// Older links had bare minutes and a single `mg` for every cup.
function parseServing(code: string | undefined, amount: string | undefined, legacyMg: number | null): Serving | null {
  if (code === undefined) {
    const custom = legacyMg !== null && legacyMg !== 95 && inRange(legacyMg, DRINKS.pill.amount);
    return custom ? { drink: 'pill', amount: legacyMg } : defaultServing();
  }
  const drink = BY_CODE.get(code);
  if (!drink) return null;
  const q = Number(amount);
  return { drink, amount: inRange(q, DRINKS[drink].amount) ? q : DRINKS[drink].amount.default };
}

export function encode(s: Settings): string {
  const cups = [...s.cups]
    .sort((a, b) => a.t - b.t)
    .map((c) => `${Math.round(c.t * 60)}${DRINKS[c.drink].code}${c.amount}`)
    .join(',');
  return `#cups=${cups}&bed=${Math.round(s.bed * 60)}&hl=${s.halfLife}&thr=${s.threshold}`;
}
