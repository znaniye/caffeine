import { DRINKS, fmtTime, mgOf, type Serving, type Verdict } from './model.ts';

export const header = (cups: number, mg: number, halfLife: number) =>
  `${cups} CUP${cups === 1 ? '' : 'S'} · ${Math.round(mg)} MG · HALF-LIFE ${+halfLife.toFixed(1)}H`;

/** The answer at the bottom, as parts that can share a line or stack. */
export function answer(v: Verdict, next: Serving, hasCups: boolean): string[] {
  const one = `${DRINKS[next.drink].noun} (${Math.round(mgOf(next))} MG)`;
  switch (v.kind) {
    case 'room':
      return hasCups ? [`ONE MORE ${one}?`, `OK UNTIL ${fmtTime(v.until)}`] : ['NO CAFFEINE YET.', `${one} OK UNTIL ${fmtTime(v.until)}`];
    case 'full':
      return ['UNDER THE LINE.', `NO ROOM FOR ONE MORE ${one}`];
    case 'late':
      return ['OVER THE LINE.', `LAST CUP BY ${fmtTime(v.by)}`];
    case 'skip':
      return ['OVER THE LINE.', 'SKIP THE LAST CUP'];
    case 'over':
      return ['OVER THE LINE', 'EVEN WITHOUT THE LAST CUP'];
  }
}

export const HINT = {
  mouse: ['CLICK A CUP TO SET DRINK & SIZE · CLICK AXIS TO ADD', 'DRAG CUPS · DOUBLE-CLICK TO REMOVE · DRAG BED LINE'],
  touch: ['TAP A CUP TO SET DRINK & SIZE · TAP AXIS TO ADD', 'DRAG CUPS · DRAG ONE DOWN TO REMOVE · DRAG BED LINE'],
};
