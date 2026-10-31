import type { ReactNode } from 'react';

import { AppHeader, Main, Screen } from './ui';

const EMAIL_RE = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;

/** 문단 속 이메일 주소는 mailto 링크로 */
function withMailto(text: string): ReactNode {
  const parts = text.split(EMAIL_RE);
  if (parts.length === 1) return text;
  return parts.map((p, i) =>
    EMAIL_RE.test(p) && p.includes('@') ? (
      <a key={i} href={`mailto:${p}`} className="text-txt-link underline">
        {p}
      </a>
    ) : (
      p
    ),
  );
}

export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: { h: string; p: string[] }[] }) {
  return (
    <Screen>
      <AppHeader layout="nav" title={title} back />
      <Main className="gap-6 pb-10 pt-4">
        <p className="text-sm text-txt-black-tertiary">시행일 {updated}</p>
        {sections.map(s => (
          <section key={s.h} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{s.h}</h2>
            {s.p.map(p => (
              <p key={p} className="text-base leading-7 text-txt-black-secondary">
                {withMailto(p)}
              </p>
            ))}
          </section>
        ))}
      </Main>
    </Screen>
  );
}
