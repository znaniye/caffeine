import { DRINKS, RANGE, elimination, remaining } from './model.ts';
import { defaults } from './hash.ts';
import { changed, load, onChange, state } from './state.ts';
import { byId } from './dom.ts';

type Knob = 'halfLife' | 'threshold';
const UNIT: Record<Knob, string> = { halfLife: ' H', threshold: ' MG' };

export function bindPanel() {
  const panel = byId('panel');
  const button = byId<HTMLButtonElement>('modelBtn');
  const knobs = (Object.keys(UNIT) as Knob[]).map((k) => ({ k, input: byId<HTMLInputElement>(k), out: byId<HTMLOutputElement>(`${k}Out`) }));
  const chipGroups = [...panel.querySelectorAll<HTMLElement>('.chips[data-for]')];

  const toggle = (open = panel.hidden) => {
    panel.hidden = !open;
    button.textContent = open ? 'Close' : 'Model';
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', () => toggle());

  for (const { k, input } of knobs) {
    Object.assign(input, { min: RANGE[k].min, max: RANGE[k].max, step: RANGE[k].step });
    input.addEventListener('input', () => {
      state[k] = Number.parseFloat(input.value);
      changed();
    });
  }
  for (const group of chipGroups) {
    group.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('.chip');
      if (!chip) return;
      state[group.dataset.for as Knob] = Number(chip.dataset.v);
      changed();
    });
  }
  byId('reset').addEventListener('click', () => {
    load(defaults());
    changed();
  });

  // Gardiner et al. 2023 cut-offs, run through this model with a 5 h half-life
  const ke = elimination(5);
  const coffee = 107 * remaining(8.8, ke);
  const preWorkout = 217.5 * remaining(13.2, ke);
  const evidence = Math.round((coffee + preWorkout) / 2);
  const evChip = byId('evChip');
  evChip.dataset.v = String(evidence);
  evChip.textContent = `Evidence ~${evidence}`;
  byId('evNote').textContent =
    'Gardiner et al. 2023 (meta-analysis, 24 studies): to avoid losing sleep, have coffee (107 mg) at least 8.8 h ' +
    'before bed and pre-workout (217.5 mg) at least 13.2 h before bed. With a 5 h half-life this model leaves ' +
    `${Math.round(coffee)} and ${Math.round(preWorkout)} mg at bedtime. The 50 mg line of the original is a rule of thumb.`;
  byId('drinkTable').textContent =
    Object.values(DRINKS)
      .filter((d) => d.unit === 'ml')
      .map((d) => `${d.name} ${Math.round(d.mgPerUnit * 100)}`)
      .join(' · ') + ' MG / 100 ML';

  onChange(() => {
    for (const { k, input, out } of knobs) {
      if (document.activeElement !== input) input.value = String(state[k]);
      out.textContent = `${+state[k].toFixed(1)}${UNIT[k]}`;
    }
    for (const group of chipGroups) {
      const value = state[group.dataset.for as Knob];
      group.querySelectorAll<HTMLElement>('.chip').forEach((chip) => chip.setAttribute('aria-pressed', String(Number(chip.dataset.v) === value)));
    }
  });

  return { toggle };
}
