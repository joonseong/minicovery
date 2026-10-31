'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { postJson } from '@/lib/client/ndjson';
import type { Recommended } from '@/lib/learning';

import { LimitSheet, MonthlySheet, ReplaceSheet } from '../QuotaSheets';
import { AppHeader, Footer, Main, PrimaryButton, Screen } from '../ui';

type Reason = 'free' | 'over' | 'monthly' | 'daily';

/** 다른 사람이 만든 코스 미리보기: 목차를 보고 그대로 받는다 (만든 사람은 드러나지 않음) */
export function RecommendScreen(props: {
  course: Recommended & { titles: string[]; levelLabel: string };
  quota: 'ok' | Reason;
  currentTopic?: string;
  replace: boolean;
  plus: boolean;
  resetLabel?: string;
}) {
  const router = useRouter();
  const { course } = props;
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<Reason | null>(null);
  // 이미 받은 코스면 지우고 다시 받는 대신 이어 읽기로
  const [already, setAlready] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const take = async () => {
    if (busy) return;
    if (props.quota !== 'ok' && !(props.quota === 'free' && props.replace)) {
      setSheet(props.quota);
      return;
    }
    setBusy(true);
    setNotice('');
    const res = await postJson<{ firstDropId?: string; reason?: Reason | 'already' | 'missing'; courseId?: string }>('/api/courses/copy', {
      sourceId: course.id,
      replace: props.replace,
    });
    setBusy(false);
    if (res.data.firstDropId) router.replace(`/drop/${res.data.firstDropId}`);
    else if (res.status === 409 || res.data.reason === 'already') setAlready(res.data.courseId ?? null);
    else if (res.data.reason === 'missing') setNotice('지금은 받을 수 없는 코스예요.');
    else if (res.data.reason) setSheet(res.data.reason);
    else setNotice('코스를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  };

  return (
    <Screen className="relative">
      <AppHeader layout="nav" back />
      <Main className="pb-6 pt-4">
        <p className="text-sm font-semibold text-txt-black-tertiary">
          추천 코스 · {course.category} · {course.levelLabel}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-1px]">{course.title}</h1>
        <p className="mt-2 text-sm font-semibold text-txt-point">
          {course.copies ? `${course.copies}명이 받았어요 · ` : ''}
          {course.total}편
        </p>
        <ol className="mt-6 flex flex-col gap-2">
          {course.titles.map((t, i) => (
            <li key={t} className="flex min-h-14 items-center gap-3 rounded-2xl bg-shape-depth1 p-4">
              <span className="w-6 flex-shrink-0 text-center text-sm font-bold text-txt-black-tertiary">{i + 1}</span>
              <span className="flex-1 text-sm">{t}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-txt-black-secondary">
          다른 사람이 만든 코스를 그대로 받아요. 첫 Drop은 바로 읽을 수 있고, 다음 편부터 하루 한 편씩 열려요.
        </p>
        {notice ? <p className="mt-3 text-sm text-txt-error">{notice}</p> : null}
      </Main>
      <Footer className="gap-2">
        {already !== null ? (
          <>
            <p className="text-center text-sm font-semibold text-txt-point">이미 받은 코스예요</p>
            <PrimaryButton href={already ? `/course/${already}` : '/library'} replace>
              이어 읽기
            </PrimaryButton>
          </>
        ) : (
          <>
            <PrimaryButton onClick={() => void take()}>{busy ? '받는 중…' : '이 코스 받기'}</PrimaryButton>
            <p className="text-center text-sm text-txt-black-secondary">새 코스 만들기 1번으로 세요</p>
          </>
        )}
      </Footer>
      <ReplaceSheet
        open={sheet === 'free'}
        onClose={() => setSheet(null)}
        courseTopic={props.currentTopic}
        replaceHref={`/recommend/${course.id}?replace=1`}
      />
      <MonthlySheet open={sheet === 'monthly'} onClose={() => setSheet(null)} resetLabel={props.resetLabel} />
      <LimitSheet kind={sheet === 'daily' || sheet === 'over' ? sheet : null} onClose={() => setSheet(null)} plus={props.plus} />
    </Screen>
  );
}
