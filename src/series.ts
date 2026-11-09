import {
  DAY_SPAN,
  DAY_START,
  amount,
  dayPeak,
  elimination,
  mgOf,
  remaining,
  timeToPeak,
  verdict,
  type Cup,
  type Limits,
  type Point,
  type Serving,
  type Verdict,
} from './model.ts';

/* Everything the chart needs about a day, computed once per change. */

export const COLUMNS = 121; // one every 12 minutes across the axis
export const columnTime = (i: number) => DAY_START + (i * DAY_SPAN) / (COLUMNS - 1);
const HALO = 1.4; // the faint halo shows a 40% longer half-life

export interface Day {
  doses: Point[];
  total: number;
  level: Float32Array; // mg in the body, per column
  halo: Float32Array; // same with the longer half-life
  rise: Float32Array; // 0 to 1, how fast each column climbs while a cup is absorbed
  share: Map<number, Float32Array>; // each cup's part of every column, by cup id
  guide: Map<number, number>; // level about an hour after each cup, where its guide line ends
  peak: Point;
  atBed: number;
  timeToPeak: number;
  verdict: Verdict;
}

export function sampleDay(cups: readonly (Cup & { id: number })[], limits: Limits, next: Serving): Day {
  const ke = elimination(limits.halfLife);
  const keHalo = elimination(limits.halfLife * HALO);
  const tpk = timeToPeak(ke);
  const doses = cups.map((c) => ({ t: c.t, mg: mgOf(c) }));
  const level = new Float32Array(COLUMNS);
  const halo = new Float32Array(COLUMNS);
  const rise = new Float32Array(COLUMNS);
  const share = new Map(cups.map((c) => [c.id, new Float32Array(COLUMNS)]));

  for (let i = 0; i < COLUMNS; i++) {
    const t = columnTime(i);
    level[i] = amount(t, doses, ke);
    halo[i] = Math.max(level[i], amount(t, doses, keHalo));
    const slope = (amount(t + 0.02, doses, ke) - level[i]) / 0.02; // mg/h
    rise[i] = Math.min(1, Math.max(0, slope / 60)) ** 0.7;
    cups.forEach((c, k) => {
      share.get(c.id)![i] = remaining(t - c.t, ke) * doses[k].mg;
    });
  }

  return {
    doses,
    total: doses.reduce((sum, d) => sum + d.mg, 0),
    level,
    halo,
    rise,
    share,
    guide: new Map(cups.map((c) => [c.id, amount(c.t + tpk, doses, ke)])),
    peak: dayPeak(doses, ke),
    atBed: amount(limits.bed, doses, ke),
    timeToPeak: tpk,
    verdict: verdict(doses, mgOf(next), limits),
  };
}
