/* 어드민 대시보드의 기간별 막대 차트. 막대는 24px 이하·윗끝만 4px 둥글게, 막대·조각 사이 2px, 눈금선은 1px 실선.
   마지막 기간은 아직 진행 중이라 연하게 그린다. 막대 칸 전체에 마우스를 올리면 값이 뜨고, 표 보기도 둔다.
   parts가 있으면 로그인(파랑)·비로그인(주황)으로 쌓고 범례를 단다 (두 색은 색약 검사 통과).
   카드 너비가 바뀌어도 글자 크기가 그대로이게 HTML로 그린다 */

const SERIES = '#2a78d6';
const PARTIAL = '#86b6ef';
export const LOGIN_COLOR = '#2a78d6';
export const ANON_COLOR = '#eb6834';

export type ValueFormat = 'won' | 'sec' | undefined;

export function formatValue(n: number, format: ValueFormat) {
  if (format === 'won') return `₩${n.toLocaleString()}`;
  if (format === 'sec') return `${n.toLocaleString()}초`;
  return n.toLocaleString();
}

/** 0부터 시작하는 깔끔한 눈금 최댓값 (1·2·5 × 10ⁿ) */
function niceMax(max: number) {
  if (max <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 5, 10].find(s => s * power >= max)!;
  return step * power;
}

const compact = (n: number) => (n >= 1000 ? `${Number((n / 1000).toFixed(1))}K` : String(Number(n.toFixed(1))));

export function ColumnChart({
  title,
  note,
  labels,
  values,
  parts,
  format,
  unitWord,
}: {
  title: string;
  note?: string;
  labels: string[];
  values: number[];
  /** 로그인·비로그인으로 나눠 쌓기 (합이 values) */
  parts?: { login: number[]; anon: number[] };
  format?: ValueFormat;
  /** 머리글의 '이번 주 · 지난주' 같은 말 */
  unitWord: { now: string; prev: string };
}) {
  const n = values.length;
  const last = values[n - 1] ?? 0;
  const prev = values[n - 2] ?? 0;
  const empty = values.every(v => v === 0);
  const max = niceMax(Math.max(...values));
  const every = Math.ceil(n / 6);
  const shown = (i: number) => (n - 1 - i) % every === 0;
  const stack = parts
    ? [
        { name: '로그인', values: parts.login, color: LOGIN_COLOR },
        { name: '비로그인', values: parts.anon, color: ANON_COLOR },
      ]
    : null;
  const tip = (i: number) =>
    `${labels[i]}: ${formatValue(values[i]!, format)}` +
    (stack ? ` (${stack.map(s => `${s.name} ${s.values[i]}`).join(' · ')})` : '') +
    (i === n - 1 ? ' · 진행 중' : '');

  return (
    <section className="flex flex-col rounded-2xl border border-fuse-line bg-shape-white p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {note ? <p className="mt-0.5 text-xs text-fuse-sub">{note}</p> : null}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-2xl font-bold leading-none">{formatValue(last, format)}</p>
          <p className="mt-1 text-xs text-fuse-sub">
            {unitWord.now} · {unitWord.prev} {formatValue(prev, format)}
          </p>
          {stack ? <p className="mt-0.5 text-xs text-fuse-sub">{stack.map(s => `${s.name} ${s.values[n - 1]}`).join(' · ')}</p> : null}
        </div>
      </header>
      {stack ? (
        <div className="mt-3 flex gap-3 text-xs text-fuse-sub">
          {stack.map(s => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
      {empty ? (
        <p className="mt-4 flex h-[158px] items-center justify-center text-xs text-fuse-faint">아직 기록이 없어요</p>
      ) : (
        <div className="mt-4" role="img" aria-label={`${title} 기간별 막대 차트. 값은 표로 보기에 있어요`}>
          <div className="relative ml-9 h-[140px]">
            {[1, 0.5, 0].map(t => (
              <div key={t} className="absolute inset-x-0 border-t border-[#ECECEF]" style={{ top: `${(1 - t) * 100}%` }}>
                <span className="absolute -left-9 -top-[7px] w-7 text-right text-[11px] leading-none text-fuse-sub" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {compact(max * t)}
                </span>
              </div>
            ))}
            <div className="absolute inset-0 flex items-end">
              {values.map((v, i) => {
                const height = `${(v / max) * 100}%`;
                // 쌓을 때 맨 위 조각만 윗끝을 둥글게 (아래부터 로그인 → 비로그인)
                const top = stack ? [...stack].reverse().find(s => s.values[i]! > 0) : undefined;
                return (
                  <div key={i} title={tip(i)} className="flex h-full flex-1 items-end justify-center px-px">
                    {v > 0 && stack ? (
                      <div className="flex w-full max-w-[24px] flex-col-reverse gap-[2px]" style={{ height, opacity: i === n - 1 ? 0.55 : 1 }}>
                        {stack.map(s =>
                          s.values[i]! > 0 ? (
                            <div key={s.name} className={s === top ? 'rounded-t-[4px]' : ''} style={{ flexGrow: s.values[i], flexBasis: 0, background: s.color }} />
                          ) : null,
                        )}
                      </div>
                    ) : v > 0 ? (
                      <div className="w-full max-w-[24px] rounded-t-[4px]" style={{ height, background: i === n - 1 ? PARTIAL : SERIES }} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="ml-9 mt-1.5 flex">
            {labels.map((l, i) => (
              <span key={i} className="flex-1 whitespace-nowrap text-center text-[11px] text-fuse-sub">
                {shown(i) ? l : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      <details className="mt-3 text-xs text-fuse-sub">
        <summary className="cursor-pointer select-none">표로 보기</summary>
        <table className="mt-2 w-full" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {stack ? (
            <thead>
              <tr>
                <th className="py-1 text-left font-medium">기간</th>
                {stack.map(s => (
                  <th key={s.name} className="py-1 text-right font-medium">
                    {s.name}
                  </th>
                ))}
                <th className="py-1 text-right font-medium">합계</th>
              </tr>
            </thead>
          ) : null}
          <tbody>
            {values.map((v, i) => (
              <tr key={i} className="border-t border-fuse-line">
                <td className="py-1">{labels[i]}</td>
                {stack?.map(s => (
                  <td key={s.name} className="py-1 text-right text-fuse-ink">
                    {s.values[i]}
                  </td>
                ))}
                <td className="py-1 text-right text-fuse-ink">{formatValue(v, format)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
