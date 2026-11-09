import { describe, expect, it } from 'vitest';
import { amount, dayPeak, elimination, fmtTime, latestSlot, maxFrom, mgOf, remaining, timeToPeak, verdict, type Point } from './model.ts';

const ke = elimination(5);
const lim = { bed: 23, threshold: 50, halfLife: 5 };
const coffees = (...ts: number[]): Point[] => ts.map((t) => ({ t, mg: 95 }));
const near = (actual: number, expected: number, tolerance: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);

describe('reproduces the numbers shown in the original video', () => {
  it.each([
    { cups: [8, 11, 15.5], bed: 67 },
    { cups: [8, 11, 20 + 20 / 60], bed: 100 },
    { cups: [8, 11, 12.25], bed: 54 },
    { cups: [8, 11, 12.25, 19], bed: 111 },
  ])('$cups leaves about $bed mg at 23:00', ({ cups, bed }) => {
    near(amount(23, coffees(...cups), ke), bed, 1.5);
  });

  it('peaks at 138 mg around 11:57 with cups at 08:00 and 11:00', () => {
    const peak = dayPeak(coffees(8, 11, 20 + 20 / 60), ke);
    near(peak.mg, 138, 2);
    near(peak.t * 60, 11 * 60 + 57, 6);
  });

  it('peaks at 203 mg around 13:06 with cups at 08:00, 11:00 and 12:15', () => {
    const peak = dayPeak(coffees(8, 11, 12.25, 19), ke);
    near(peak.mg, 203, 2);
    near(peak.t * 60, 13 * 60 + 6, 6);
  });
});

describe('pharmacokinetics', () => {
  it('has nothing in the body before intake', () => {
    expect(remaining(0, ke)).toBe(0);
    expect(remaining(-1, ke)).toBe(0);
  });

  it('peaks about an hour after a cup', () => {
    near(timeToPeak(ke), 1.16, 0.05);
  });

  it('halves every half-life once absorbed', () => {
    near(remaining(15, ke) / remaining(10, ke), 0.5, 0.001);
  });

  it('puts the Gardiner et al. cut-offs at about 33 and 37 mg at bedtime', () => {
    near(107 * remaining(8.8, ke), 33.3, 0.5);
    near(217.5 * remaining(13.2, ke), 36.8, 0.5);
  });
});

describe('verdict', () => {
  it('says "last cup by 10:45" for the default day, like the original', () => {
    expect(verdict(coffees(8, 11, 15.5), 95, lim)).toEqual({ kind: 'late', by: 10.75 });
  });

  it('is over the line even without the last cup for 4 cups', () => {
    expect(verdict(coffees(8, 11, 12.25, 19), 95, lim)).toEqual({ kind: 'over' });
  });

  it('gives the latest time for one more cup when under the line', () => {
    const doses = [{ t: 6, mg: 91 }];
    const v = verdict(doses, 95, lim);
    expect(v.kind).toBe('room');
    if (v.kind !== 'room') return;
    expect(maxFrom([...doses, { t: v.until, mg: 95 }], 23, ke)).toBeLessThanOrEqual(50);
    expect(maxFrom([...doses, { t: v.until + 1 / 12, mg: 95 }], 23, ke)).toBeGreaterThan(50);
  });

  it('counts caffeine still being absorbed after bedtime', () => {
    // At 23:00 a cup taken at 22:55 has barely been absorbed, but it peaks during the night.
    expect(maxFrom([{ t: 22 + 55 / 60, mg: 95 }], 23, ke)).toBeGreaterThan(50);
    expect(latestSlot([], 95, lim)).toBeLessThan(19);
  });

  it('asks to skip a dose that crosses the line at any time of day', () => {
    expect(verdict([{ t: 22, mg: 600 }], 95, lim)).toEqual({ kind: 'skip' });
    expect(verdict([], 600, lim)).toEqual({ kind: 'full' });
  });
});

describe('drinks and formatting', () => {
  it('converts volume to milligrams', () => {
    near(mgOf({ drink: 'coffee', amount: 240 }), 95, 0.1);
    near(mgOf({ drink: 'espresso', amount: 30 }), 63.6, 0.1);
    expect(mgOf({ drink: 'pill', amount: 200 })).toBe(200);
  });

  it('formats times past midnight', () => {
    expect(fmtTime(10.75)).toBe('10:45');
    expect(fmtTime(25.5)).toBe('01:30');
    expect(fmtTime(23.9999)).toBe('00:00');
  });
});
