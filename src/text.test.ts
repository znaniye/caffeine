import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, it } from 'vitest';

// House style: no em dashes (or en dashes) anywhere in the copy or the code.
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
const root = process.cwd();
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const files = ['index.html', 'README.md', 'public/favicon.svg', ...walk(join(root, 'src')).map((f) => relative(root, f))];

it.each(files)('%s has no em or en dashes', (file) => {
  const hits = readFileSync(join(root, file), 'utf8')
    .split('\n')
    .flatMap((line, i) => (DASHES.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : []));
  expect(hits).toEqual([]);
});
