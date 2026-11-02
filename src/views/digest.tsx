import type { Night } from '../digest/types.js';

const dash = '—';

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr class="nowrap">
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((r) => (
              <tr class={r.retries >= 3 || r.lastStatus === 'fail' ? 'warn' : undefined}>
                <td>{r.job}</td>
                <td class="nowrap">{r.owner ?? dash}</td>
                <td>{r.runs}</td>
                <td>{r.retries >= 3 ? `${r.retries} ⚠` : r.retries}</td>
                <td class="nowrap">{r.lastStatus === 'fail' ? 'fail ⚠' : r.lastStatus}</td>
                <td class="nowrap">{r.lastError ?? dash}</td>
                <td class="nowrap">{r.firstAt}</td>
                <td class="nowrap">{r.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {night.badLines > 0 && <p class="warn">{night.badLines} line(s) did not parse</p>}
    </>
  );
}

export function DigestMissing({ night }: { night: string }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="mute">no digest for this night</p>
    </>
  );
}
