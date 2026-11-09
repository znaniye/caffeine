import { describe, expect, it } from 'vitest';
import { decode, defaults, encode, MAX_CUPS, type Settings } from './hash.ts';

describe('share link', () => {
  it('round-trips settings', () => {
    const s: Settings = {
      cups: [
        { t: 8, drink: 'coffee', amount: 240 },
        { t: 25.5, drink: 'espresso', amount: 60 },
      ],
      bed: 23.5,
      halfLife: 6.5,
      threshold: 35,
    };
    expect(decode(encode(s))).toEqual(s);
  });

  it('falls back to defaults without a hash', () => {
    expect(decode('')).toEqual(defaults());
  });

  it('reads old links with bare minutes as 240 ml coffees', () => {
    expect(decode('#cups=480,660&bed=1380&hl=5&mg=95&thr=50').cups).toEqual([
      { t: 8, drink: 'coffee', amount: 240 },
      { t: 11, drink: 'coffee', amount: 240 },
    ]);
  });

  it('reads old links with a custom dose as pills', () => {
    expect(decode('#cups=480&mg=63').cups).toEqual([{ t: 8, drink: 'pill', amount: 63 }]);
  });

  it('drops invalid cups and resets bad amounts', () => {
    expect(decode('#cups=480x240,100c240,abc,660c99999,720e30').cups).toEqual([
      { t: 11, drink: 'coffee', amount: 240 },
      { t: 12, drink: 'espresso', amount: 30 },
    ]);
  });

  it('allows an empty day and caps the number of cups', () => {
    expect(decode('#cups=').cups).toEqual([]);
    const many = Array.from({ length: 20 }, (_, i) => `${480 + i * 10}c240`).join(',');
    expect(decode(`#cups=${many}`).cups).toHaveLength(MAX_CUPS);
  });

  it('ignores out-of-range settings', () => {
    const s = decode('#bed=60&hl=99&thr=-1');
    expect([s.bed, s.halfLife, s.threshold]).toEqual([23, 5, 50]);
  });
});
