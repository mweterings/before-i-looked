import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

// Route tests for plan § 2d: the page and the JSON share one loader, so both are tested here.
// Fixtures are copied or written into a temp dir; runs/ stays read-only.
let runsDir: string;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  copyFileSync(join('runs', '2026-10-28.jsonl'), join(runsDir, '2026-10-28.jsonl'));
  writeFileSync(join(runsDir, '2026-11-01.jsonl'), '');
  writeFileSync(
    join(runsDir, '2026-11-02.jsonl'),
    [
      '{"at":"2026-11-02T01:00:00+01:00","job":"lane/sync","status":"retry","owner":"rook","error":"lock held"}',
      '{"at":"2026-11-02T02:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
      'not json',
      '',
    ].join('\n'),
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

const app = () =>
  createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });

describe('digest page and JSON: normal night (2026-10-28)', () => {
  const jobs = ['fixtures/refresh', 'lane/sync', 'digest/render', 'notes/backup', 'rig/rotate-logs'];

  it('page: 200 with every job and the warning marks', async () => {
    const res = await app().request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of jobs) expect(html).toContain(job);
    expect(html).toContain('3 ⚠');
    expect(html).toContain('fail ⚠');
  });

  it('JSON: 200 with 5 rows in page order and 1 bad line', async () => {
    const page = await (await app().request('/digest/2026-10-28')).text();
    const res = await app().request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.rows).toHaveLength(5);
    expect(night.badLines).toBe(1);
    const rowJobs = night.rows.map((r) => r.job);
    const positions = rowJobs.map((job) => page.indexOf(job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});

describe('digest page and JSON: no file for the night (2026-01-01)', () => {
  it('page: 404 with the missing message', async () => {
    const res = await app().request('/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no digest for this night');
  });

  it('JSON: 404 with the error body', async () => {
    const res = await app().request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no digest for this night', night: '2026-01-01' });
  });
});

describe('digest page and JSON: malformed night (not-a-date)', () => {
  it('page: 404', async () => {
    const res = await app().request('/digest/not-a-date');
    expect(res.status).toBe(404);
  });

  it('JSON: 404', async () => {
    const res = await app().request('/api/digest/not-a-date');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no digest for this night', night: 'not-a-date' });
  });
});

describe('digest page and JSON: empty night (2026-11-01)', () => {
  it('page: 200 with "nothing ran"', async () => {
    const res = await app().request('/digest/2026-11-01');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('JSON: 200 with no rows and all counts 0', async () => {
    const res = await app().request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.rows).toEqual([]);
    expect(night.counts).toEqual({ ok: 0, retry: 0, fail: 0 });
  });
});

describe('digest page and JSON: bad line night (2026-11-02)', () => {
  it('page: 200 with the unparsed-line notice and the job', async () => {
    const res = await app().request('/digest/2026-11-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line(s) did not parse');
    expect(html).toContain('lane/sync');
  });

  it('JSON: 200 with badLines 1 and the one job', async () => {
    const res = await app().request('/api/digest/2026-11-02');
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual(['lane/sync']);
    expect(night.rows[0]?.runs).toBe(2);
  });
});
