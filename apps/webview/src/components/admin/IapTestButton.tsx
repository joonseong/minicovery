'use client';

import { useState } from 'react';

const RESULT: Record<string, string> = {
  SUCCESS: '성공 · Apple이 우리 서버에서 200을 받았어요',
  TIMED_OUT: '시간 초과 · 서버가 제때 응답하지 않았어요',
  SSL_ISSUE: 'SSL 문제',
  CIRCULAR_REDIRECT: '리다이렉트 반복',
  NO_RESPONSE: '응답 없음',
  SOCKET_ISSUE: '연결 문제',
  UNSUPPORTED_CHARSET: '지원하지 않는 문자셋',
  INVALID_RESPONSE: '잘못된 응답',
  PREMATURE_CLOSE: '연결이 일찍 끊김',
  UNSUCCESSFUL_HTTP_RESPONSE_CODE: '서버가 200이 아닌 코드를 돌려줬어요 (서명 검증 실패면 401)',
  OTHER: '기타 오류',
};

/** 어드민: Apple에 테스트 알림을 요청하고 전송 결과가 올 때까지 3초마다 확인한다 (최대 30초) */
export function IapTestButton() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('');

  const run = async () => {
    setBusy(true);
    setLog('Apple에 테스트 알림을 요청하는 중…');
    try {
      const res = await fetch('/api/admin/iap-test', { method: 'POST' });
      const data = (await res.json()) as { env?: string; token?: string; error?: string };
      if (!res.ok || !data.token) {
        setLog(`요청 실패: ${data.error ?? res.status} — Vercel의 APPLE_IAP_* 값을 확인해 주세요`);
        return;
      }
      setLog(`${data.env} 환경으로 요청했어요. Apple이 보내길 기다리는 중…`);
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const s = await fetch(`/api/admin/iap-test?env=${data.env}&token=${encodeURIComponent(data.token)}`);
        const { attempts = [], error } = (await s.json()) as { attempts?: { attemptDate: number; sendAttemptResult: string }[]; error?: string };
        if (error) {
          setLog(`결과 확인 실패: ${error}`);
          return;
        }
        if (attempts.length) {
          const last = attempts[attempts.length - 1]!;
          setLog(`${data.env} · ${RESULT[last.sendAttemptResult] ?? last.sendAttemptResult} (${new Date(last.attemptDate).toLocaleTimeString('ko-KR')})`);
          return;
        }
      }
      setLog('30초 안에 결과가 오지 않았어요. 잠시 뒤 다시 눌러 주세요');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run()}
        className="self-start rounded-lg bg-shape-brand px-3 py-2 text-txt-white-primary disabled:opacity-50"
      >
        {busy ? '확인하는 중…' : '테스트 알림 보내기'}
      </button>
      {log ? <p className="text-xs text-txt-black-secondary">{log}</p> : null}
    </div>
  );
}
