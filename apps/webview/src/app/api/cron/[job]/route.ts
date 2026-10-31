import { timingSafeEqual } from 'node:crypto';

import { collectBatches, sendDueNotifications, sendTestPush, submitNightlyBatch } from '@/lib/jobs';

export const maxDuration = 300;

const JOBS = {
  nightly: submitNightlyBatch,
  collect: collectBatches,
  notify: () => sendDueNotifications(),
  'push-test': (request: Request) => sendTestPush(new URL(request.url).searchParams.get('user')),
} as const;

/** Bearer CRON_SECRET 확인. 비어 있으면 아무도 못 부른다. 길이가 달라도 상수 시간으로 비교한다 */
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const encoder = new TextEncoder();
  const given = encoder.encode(request.headers.get('authorization') ?? '');
  const expected = encoder.encode(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** 스케줄러(Supabase pg_cron, Vercel Cron 등)가 Bearer CRON_SECRET으로 호출 */
async function handle(request: Request, { params }: { params: { job: string } }) {
  if (!authorized(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const job = JOBS[params.job as keyof typeof JOBS];
  if (!job) return Response.json({ error: 'unknown job' }, { status: 404 });
  const startedAt = Date.now();
  const result = await job(request);
  return Response.json({ job: params.job, took_ms: Date.now() - startedAt, ...result });
}

export { handle as GET, handle as POST };
