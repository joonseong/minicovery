'use client';

import { useState } from 'react';

/** 어드민: 추천 코스로 보여 줄지. 인증은 같은 사이트 쿠키(mc_admin)가 따라간다 */
export function FeatureToggle({ courseId, featured }: { courseId: string; featured: boolean }) {
  const [on, setOn] = useState(featured);
  return (
    <button
      type="button"
      className={on ? 'rounded-lg bg-shape-brand px-3 py-1 text-txt-white-primary' : 'rounded-lg border border-border-button px-3 py-1'}
      onClick={async () => {
        const next = !on;
        setOn(next);
        const res = await fetch('/api/admin/feature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, on: next }),
        });
        if (!res.ok) setOn(!next);
      }}
    >
      {on ? '추천 중' : '추천하기'}
    </button>
  );
}
