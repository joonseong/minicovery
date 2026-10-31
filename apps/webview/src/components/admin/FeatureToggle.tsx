'use client';

import { useState } from 'react';

/** 어드민: 추천 코스로 보여 줄지 */
export function FeatureToggle({ courseId, featured, token }: { courseId: string; featured: boolean; token: string }) {
  const [on, setOn] = useState(featured);
  return (
    <button
      type="button"
      className={on ? 'rounded-lg bg-shape-brand px-3 py-1 text-txt-white-primary' : 'rounded-lg border border-border-button px-3 py-1'}
      onClick={async () => {
        const next = !on;
        setOn(next);
        await fetch(`/api/admin/feature?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, on: next }),
        });
      }}
    >
      {on ? '추천 중' : '추천하기'}
    </button>
  );
}
