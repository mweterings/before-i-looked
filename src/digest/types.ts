// Plan morning-digest § 1. The contract every part of § 2 builds against: commit this first.

/** One line of `runs/<night>.jsonl`, after parsing. */
export type RunStatus = 'ok' | 'retry' | 'fail';

export type RunLine = {
  at: string; // ISO 8601 with the log's offset; never converted to UTC
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

/** One row per job for the night. */
export type DigestRow = {
  job: string;
  /** `null` when the log has no owner; views show it as `—`. */
  owner: string | null;
  /** Lines for this job, any status. */
  runs: number;
  /** Lines with status `retry`. */
  retries: number;
  lastStatus: RunStatus;
  /** `error` of the last line that had one, or `null`. */
  lastError: string | null;
  /** `at` of the first and last line, as written in the log. */
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  /** Sorted by job. Empty for an empty file. */
  rows: DigestRow[];
  /** Lines that did not parse. Counted, never thrown. */
  badLines: number;
  /** Parsed lines by status, for the board's ok / retry / fail counts (§ 2c). */
  counts: Record<RunStatus, number>;
};

/**
 * Reads `<runsDir>/<night>.jsonl`. Returns `null` when the night has no file (routes answer 404).
 * Implemented in `./read.ts` (issue #6).
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;
