/*
 * Caffeine in the body: one-compartment pharmacokinetics with first-order
 * absorption and elimination (the Bateman function). Doses add up linearly.
 *
 *   A(t) = sum of D * ka/(ka - ke) * (exp(-ke*dt) - exp(-ka*dt)),  ke = ln2 / half-life
 *
 * Times are hours since midnight. The day runs from 06:00 to 06:00 (6 to 30).
 */

export const KA = 2.7; // absorption rate, 1/h: a cup peaks about an hour after you drink it
export const DAY_START = 6;
export const DAY_SPAN = 24;
export const DAY_END = DAY_START + DAY_SPAN;

export interface Range {
  min: number;
  max: number;
  step: number;
}

/** Allowed values for the settings, shared by the share link parser and the sliders. */
export const RANGE = {
  bed: { min: 18, max: 28, step: 0.25 },
  halfLife: { min: 1.5, max: 15, step: 0.5 },
  threshold: { min: 10, max: 150, step: 1 },
} satisfies Record<string, Range>;

export const inRange = (v: number, r: Range) => v >= r.min && v <= r.max;

/** An amount at a time: a dose you drink, or a sample of the curve. */
export interface Point {
  t: number;
  mg: number;
}

export interface Limits {
  bed: number;
  threshold: number;
  halfLife: number;
}

export const elimination = (halfLife: number) => Math.LN2 / halfLife;

/** Fraction of a dose still in the body `dt` hours after drinking it. */
export function remaining(dt: number, ke: number): number {
  if (dt <= 0) return 0;
  return (KA / (KA - ke)) * (Math.exp(-ke * dt) - Math.exp(-KA * dt));
}

export function amount(t: number, doses: readonly Point[], ke: number): number {
  let sum = 0;
  for (const d of doses) sum += remaining(t - d.t, ke) * d.mg;
  return sum;
}

/** Hours from drinking a single dose to its peak. */
export const timeToPeak = (ke: number) => Math.log(KA / ke) / (KA - ke);

/** Highest amount from `t0` over the next 12 h, sampled every 5 min. */
export function maxFrom(doses: readonly Point[], t0: number, ke: number): number {
  let max = 0;
  for (let k = 0; k <= 144; k++) max = Math.max(max, amount(t0 + k / 12, doses, ke));
  return max;
}

/** Peak of the day, sampled every minute. */
export function dayPeak(doses: readonly Point[], ke: number): Point {
  let best = { t: DAY_START, mg: 0 };
  for (let k = 0; k <= DAY_SPAN * 60; k++) {
    const t = DAY_START + k / 60;
    const mg = amount(t, doses, ke);
    if (mg > best.mg) best = { t, mg };
  }
  return best;
}

/**
 * Latest 5 minute slot between 06:00 and bedtime for one more dose of `mg`
 * that keeps you under the threshold from bedtime on, counting what is still
 * being absorbed after you lie down. `null` when no slot works.
 */
export function latestSlot(base: readonly Point[], mg: number, lim: Limits): number | null {
  const ke = elimination(lim.halfLife);
  const ok = (slot: number) => maxFrom([...base, { t: slot / 12, mg }], lim.bed, ke) <= lim.threshold;
  let lo = DAY_START * 12;
  let hi = Math.floor(lim.bed * 12 + 1e-9);
  if (!ok(lo)) return null;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ok(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo / 12;
}

export type Verdict =
  | { kind: 'room'; until: number } // under the line, one more is fine until `until`
  | { kind: 'full' } // under the line, but one more crosses it whenever you have it
  | { kind: 'late'; by: number } // over the line, the last cup had to be by `by`
  | { kind: 'skip' } // over the line, the last cup crosses it at any time of day
  | { kind: 'over' }; // over the line even without the last cup

export function verdict(doses: readonly Point[], nextMg: number, lim: Limits): Verdict {
  const ke = elimination(lim.halfLife);
  if (maxFrom(doses, lim.bed, ke) <= lim.threshold) {
    const until = latestSlot(doses, nextMg, lim);
    return until === null ? { kind: 'full' } : { kind: 'room', until };
  }
  const others = [...doses].sort((a, b) => a.t - b.t);
  const last = others.pop();
  if (!last || maxFrom(others, lim.bed, ke) > lim.threshold) return { kind: 'over' };
  const by = latestSlot(others, last.mg, lim);
  return by === null ? { kind: 'skip' } : { kind: 'late', by };
}

/** "HH:MM", wrapping past midnight. */
export function fmtTime(t: number): string {
  const m = ((Math.round(t * 60) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/* ---------- drinks ---------- */

export type DrinkId = 'coffee' | 'espresso' | 'tea' | 'cola' | 'energy' | 'pill';

export interface Drink {
  code: string; // one letter, used in share links
  name: string; // label on the picker
  noun: string; // used in sentences
  unit: 'ml' | 'mg'; // what the amount slider measures
  mgPerUnit: number;
  amount: Range & { default: number };
}

// Typical values. Real drinks vary a lot with beans, roast and brewing.
export const DRINKS: Record<DrinkId, Drink> = {
  // filter coffee, about 95 mg per 240 ml
  coffee: { code: 'c', name: 'Coffee', noun: 'COFFEE', unit: 'ml', mgPerUnit: 0.396, amount: { default: 240, min: 20, max: 600, step: 10 } },
  // about 64 mg per 30 ml shot
  espresso: { code: 'e', name: 'Espresso', noun: 'ESPRESSO', unit: 'ml', mgPerUnit: 2.12, amount: { default: 30, min: 15, max: 120, step: 5 } },
  // black tea, about 47 mg per 240 ml
  tea: { code: 't', name: 'Tea', noun: 'TEA', unit: 'ml', mgPerUnit: 0.2, amount: { default: 240, min: 50, max: 600, step: 10 } },
  // about 34 mg per 355 ml can
  cola: { code: 'k', name: 'Cola', noun: 'COLA', unit: 'ml', mgPerUnit: 0.096, amount: { default: 350, min: 100, max: 1000, step: 10 } },
  // about 80 mg per 250 ml can
  energy: { code: 'r', name: 'Energy', noun: 'ENERGY DRINK', unit: 'ml', mgPerUnit: 0.32, amount: { default: 250, min: 100, max: 1000, step: 10 } },
  // caffeine pills, pre-workout: entered in mg
  pill: { code: 'm', name: 'Pill / mg', noun: 'DOSE', unit: 'mg', mgPerUnit: 1, amount: { default: 200, min: 10, max: 600, step: 5 } },
};

export const isDrinkId = (s: string): s is DrinkId => Object.hasOwn(DRINKS, s);

/** A drink and how much of it. */
export interface Serving {
  drink: DrinkId;
  amount: number;
}

/** A serving at a time of day. */
export interface Cup extends Serving {
  t: number;
}

export const mgOf = (s: Serving) => s.amount * DRINKS[s.drink].mgPerUnit;
export const defaultServing = (drink: DrinkId = 'coffee'): Serving => ({ drink, amount: DRINKS[drink].amount.default });
