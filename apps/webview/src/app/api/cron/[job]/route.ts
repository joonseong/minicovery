import { collectBatches, sendDueNotifications, sendTestPush, submitNightlyBatch } from '@/lib/jobs';

export const maxDuration = 300;

const JOBS = {
  nightly: submitNightlyBatch,
  collect: collectBatches,
  notify: () => sendDueNotifications(),
  'push-test': (request: Request) => sendTestPush(new URL(request.url).searchParams.get('user')),
} as const;

/** 스케줄러(Supabase pg_cron, Vercel Cron 등)가 Bearer CRON_SECRET으로 호출 */
async function handle(request: Request, { params }: { params: { job: string } }) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const job = JOBS[params.job as keyof typeof JOBS];
  if (!job) return Response.json({ error: 'unknown job' }, { status: 404 });
  return Response.json(await job(request));
}

export { handle as GET, handle as POST };
