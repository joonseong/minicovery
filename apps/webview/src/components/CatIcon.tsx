/** 분야 아이콘 (손그림 두들, 분야 색 원 + 펜 선). 그림은 자리보다 1.25배로 그려 선이 조금 넘친다 (레이아웃 크기는 그대로) */
const FILE: Record<string, string> = {
  '경제·금융': 'econ',
  '경영·마케팅': 'biz',
  '정치·사회': 'politics',
  역사: 'history',
  '철학·종교': 'philo',
  '심리·행동': 'psych',
  과학: 'science',
  '기술·AI': 'tech',
  '건강·의학': 'health',
  '환경·지구': 'earth',
  우주: 'space',
  '수학·논리': 'math',
  '언어·글쓰기': 'writing',
  문학: 'lit',
  '미술·디자인': 'art',
  음악: 'music',
  '영화·대중문화': 'film',
  '음식·와인': 'food',
  '여행·지리': 'travel',
  스포츠: 'sports',
  라이프스타일: 'life',
  기타: 'etc',
};

export function CatIcon({ category, size = 32 }: { category: string; size?: number }) {
  const file = FILE[category] ?? 'etc';
  return (
    <span className="inline-flex flex-shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/img/cat/${file}.svg`} alt="" className="block h-[125%] w-[125%] max-w-none flex-shrink-0 object-contain" />
    </span>
  );
}
