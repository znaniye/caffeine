import { expect, it } from 'vitest';
import { answer } from './copy.ts';
import { mgOf, verdict, type Serving } from './model.ts';

const lim = { bed: 23, threshold: 50, halfLife: 5 };

it('answers "one more?" with the time it is fine until', () => {
  // a 230 ml coffee (91 mg) at 06:00 leaves room for another one until 16:50
  const coffee: Serving = { drink: 'coffee', amount: 230 };
  expect(answer(verdict([{ t: 6, mg: mgOf(coffee) }], mgOf(coffee), lim), coffee, true)).toEqual(['ONE MORE COFFEE (91 MG)?', 'OK UNTIL 16:50']);
});

it('says by when the last cup should have been when over the line', () => {
  const coffee: Serving = { drink: 'coffee', amount: 240 };
  const day = [8, 11, 15.5].map((t) => ({ t, mg: 95 }));
  expect(answer(verdict(day, mgOf(coffee), lim), coffee, true)).toEqual(['OVER THE LINE.', 'LAST CUP BY 10:45']);
});
