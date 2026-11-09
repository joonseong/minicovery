'use client';

import { useState } from 'react';

import { postJson } from '@/lib/client/ndjson';

import { cx } from './ui';

/** 다른 사람이 만든 코스 좋아요 (하트). 누르면 바로 바뀌고, 저장에 실패하면 되돌린다. 만든 사람에게 알림이 간다 */
export function LikeButton({ courseId, initial }: { courseId: string; initial: boolean }) {
  const [liked, setLiked] = useState(initial);
  const [busy, setBusy] = useState(false);
  // 좋아요를 켤 때마다 하트가 커졌다 작아진다 (key가 바뀌면 애니메이션을 처음부터)
  const [pop, setPop] = useState(0);

  const toggle = async () => {
    if (busy) return;
    const on = !liked;
    setLiked(on);
    if (on) setPop(n => n + 1);
    setBusy(true);
    const res = await postJson(`/api/recommended/${courseId}/like`, { on });
    setBusy(false);
    if (!res.ok) setLiked(!on);
  };

  return (
    <button
      type="button"
      aria-label="좋아요"
      aria-pressed={liked}
      onClick={() => void toggle()}
      className={cx(
        'mc-press flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border bg-shape-white',
        liked ? 'border-fuse-hot' : 'border-fuse-edge',
      )}
    >
      <svg key={pop} width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className={pop ? 'mc-heart-pop' : undefined}>
        <path
          d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.4 4.5 6.9 4.5c2.1 0 3.8 1.2 5.1 3 1.3-1.8 3-3 5.1-3 3.5 0 5.4 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z"
          fill={liked ? '#FF4D6D' : 'none'}
          stroke={liked ? '#FF4D6D' : '#0B0B0C'}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
