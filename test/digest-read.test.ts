import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 5 jobs, sorted, and 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.night).toBe('2026-10-28');
    expect(night?.rows).toHaveLength(5);
    expect(night?.badLines).toBe(1);
    const jobs = night?.rows.map((r) => r.job) ?? [];
    expect(jobs).toEqual([...jobs].sort());
  });

  it('counts retries and the last status', () => {
    const row = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(row?.runs).toBe(4);
    expect(row?.retries).toBe(3);
    expect(row?.lastStatus).toBe('ok');
    expect(row?.lastError).toBe('upstream 503');
    expect(row?.firstAt).toBe('2026-10-29T01:30:00+01:00');
    expect(row?.lastAt).toBe('2026-10-29T01:37:00+01:00');
  });

  it('keeps the last error of a failed job', () => {
    const row = night?.rows.find((r) => r.job === 'notes/backup');
    expect(row?.lastStatus).toBe('fail');
    expect(row?.lastError).toBe('quota exceeded');
    expect(row?.owner).toBe('lane-07');
  });

  it('keeps a null owner', () => {
    const row = night?.rows.find((r) => r.job === 'digest/render');
    expect(row).toBeDefined();
    expect(row?.owner).toBeNull();
  });

  it('counts parsed lines by status', () => {
    const c = night?.counts;
    const total = (c?.ok ?? 0) + (c?.retry ?? 0) + (c?.fail ?? 0);
    expect(total).toBe(night?.rows.reduce((n, r) => n + r.runs, 0));
    expect(c?.retry).toBe(4);
    expect(c?.fail).toBe(1);
  });
});

describe('readNight in a temp runs dir', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for a night with no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('reads an empty file as no rows and zero counts', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({
      night: '2026-01-02',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts bad and invalid lines without throwing, ignores blank lines', () => {
    const lines = [
      '{"at":"2026-01-03T01:00:00+01:00","job":"b","status":"ok"}',
      '',
      'not json',
      '{"at":"2026-01-03T01:01:00+01:00","job":"b","status":"maybe","owner":null}',
      '{"job":"a","status":"ok","owner":null}',
      '[1,2]',
      '{"at":"2026-01-03T01:02:00+01:00","job":"a","status":"fail","owner":"x","error":"boom"}',
      '   ',
    ];
    writeFileSync(join(dir, '2026-01-03.jsonl'), lines.join('\n'));
    const night = readNight(dir, '2026-01-03');
    expect(night?.badLines).toBe(4);
    expect(night?.counts).toEqual({ ok: 1, retry: 0, fail: 1 });
    expect(night?.rows.map((r) => r.job)).toEqual(['a', 'b']);
    expect(night?.rows[1]?.owner).toBeNull();
    expect(night?.rows[0]?.lastError).toBe('boom');
  });
});
