import { defaultServing, type Cup, type Serving } from './model.ts';
import { MAX_CUPS, type Settings } from './hash.ts';
import { sampleDay, type Day } from './series.ts';

/* The one mutable app state, plus a change signal everything else listens to. */

export interface LiveCup extends Cup {
  id: number;
  glow: number; // 0 to 1, animated highlight
  ghost: boolean; // being dragged off the axis to be removed
}

export type Drag = { kind: 'bed'; off: number; y: number } | { kind: 'cup'; id: number; off: number; y: number };

let nextId = 1;
const live = (c: Cup): LiveCup => ({ ...c, id: nextId++, glow: 0, ghost: false });

export const state = {
  cups: [] as LiveCup[],
  bed: 23,
  halfLife: 5,
  threshold: 50,
  next: defaultServing(), // what "one more" means, and what a new cup starts as
  selectedId: null as number | null,
  hoverId: null as number | null,
  hoverBed: false,
  keyboardId: null as number | null, // highlighted for a moment after a key press
  keyboardUntil: 0,
  drag: null as Drag | null,
};

let day: Day;
const listeners: Array<() => void> = [];

export const onChange = (fn: () => void) => listeners.push(fn);
export const currentDay = () => day;

export function changed() {
  day = sampleDay(
    state.cups.filter((c) => !c.ghost),
    state,
    state.next,
  );
  for (const fn of listeners) fn();
}

export function load(s: Settings) {
  state.cups = s.cups.map(live);
  state.bed = s.bed;
  state.halfLife = s.halfLife;
  state.threshold = s.threshold;
  const latest = [...s.cups].sort((a, b) => b.t - a.t)[0];
  state.next = latest ? { drink: latest.drink, amount: latest.amount } : defaultServing();
  state.selectedId = null;
}

export const settings = (): Settings => ({
  cups: state.cups.filter((c) => !c.ghost).map(({ t, drink, amount }) => ({ t, drink, amount })),
  bed: state.bed,
  halfLife: state.halfLife,
  threshold: state.threshold,
});

export const findCup = (id: number | null) => state.cups.find((c) => c.id === id);

export function selectedCup() {
  const c = findCup(state.selectedId);
  return c && !c.ghost ? c : undefined;
}

export function addCup(t: number): LiveCup | null {
  if (state.cups.length >= MAX_CUPS) return null;
  const c = live({ t, ...state.next });
  state.cups.push(c);
  return c;
}

export function removeCup(id: number) {
  state.cups = state.cups.filter((c) => c.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  if (state.hoverId === id) state.hoverId = null;
}

/** Changes what a cup is, and makes it the drink for "one more". */
export function setServing(cup: LiveCup, s: Serving) {
  cup.drink = s.drink;
  cup.amount = s.amount;
  state.next = { drink: s.drink, amount: s.amount };
}
