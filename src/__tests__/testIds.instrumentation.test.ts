import fs from 'fs';
import path from 'path';
import { TEST_IDS } from '../testing/testIds';

const SRC = path.join(__dirname, '..');

function walk(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) return walk(full);
    if (/\.(tsx|ts)$/.test(name) && !name.includes('.test.')) return [full];
    return [];
  });
}

describe('Maestro / e2e testID instrumentation', () => {
  const haystack = walk(SRC)
    .filter((f) => !f.includes(`${path.sep}testing${path.sep}`))
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');

  it.each(Object.entries(TEST_IDS))('wires testID %s = %s into UI source', (key, id) => {
    const referenced = haystack.includes(id) || haystack.includes(`TEST_IDS.${key}`);
    expect(referenced).toBe(true);
  });
});
