// src/lib/clawd-lines.ts
//
// Claw'd 말풍선 멘트 풀
//
// 정체성: 위젯 안에서 사는 작은 픽셀 생명체. 사용자를 관찰하는 동반자.
//
// 톤 원칙:
//   1. 지시 말고 관찰 ("물 마셔요" ❌ → "물잔 비었네요" ✅)
//   2. 짧을수록 좋음 (8~14자 베스트, 최대 20자)
//   3. 호명 금지, 1인칭만 (산해님 ❌)
//   4. Claude ≠ Claw'd (별개 존재로 취급)
//   5. 위젯 안 시점 활용 (고리/숫자/화면을 자기 환경으로 언급)
//   6. 느낌표 최소화, 응원조 금지

export interface LineContext {
  /** 0-23 시 */
  hour: number;
  /** 0-100 사용률 % */
  usagePct: number;
}

/** 사용률 단계 태그 — 말풍선 앞 글리프 prefix 분기용. null=무 prefix. */
export type LineTag = "usage-low" | "usage-mid" | "usage-high" | "usage-alarm" | null;

export interface PickedLine {
  text: string;
  tag: LineTag;
}

interface LinePool {
  /** 가중치 (높을수록 자주 선택됨) */
  weight: number;
  /** 이 풀이 현재 컨텍스트에 적용 가능한지 */
  isEligible: (ctx: LineContext) => boolean;
  /** 멘트 라인들 */
  lines: readonly string[];
  /** 이 풀이 선택됐을 때 말풍선에 붙일 태그 (사용률 풀만 부여) */
  tag?: LineTag;
}

const POOLS = {
  // ─── 시간대 인사 ───────────────────────────────────────

  morning: {
    weight: 3,
    isEligible: (ctx) => ctx.hour >= 5 && ctx.hour < 11,
    lines: [
      '잘 잤어요?',
      '또 만났네요',
      '햇볕이 화면까지 와요',
      '오늘은 좀 일찍이네요',
      '커피 냄새 상상해봐요',
      '아침이 또 왔어요',
      '오늘은 어떤 날이에요?',
      '눈 뜨자마자 저예요?',
    ],
  },

  afternoon: {
    weight: 3,
    isEligible: (ctx) => ctx.hour >= 11 && ctx.hour < 17,
    lines: [
      '점심 뒤 졸음 시간이에요',
      '여기는 조용해요',
      '창문 한 번 봐요',
      '오후 빛이 좋네요',
      '한낮이 제일 길어요',
      '지금쯤 배고프지 않아요?',
      '오후가 천천히 가요',
    ],
  },

  evening: {
    weight: 3,
    isEligible: (ctx) => ctx.hour >= 17 && ctx.hour < 22,
    lines: [
      '벌써 저녁이래요',
      '오늘 빨랐어요',
      '이만하면 됐어요',
      '퇴근 신호 보내요',
      '하늘이 주황이래요',
      '저녁 메뉴는 정했어요?',
      '오늘 할 일 끝났어요?',
    ],
  },

  night: {
    weight: 5, // 밤에 Claw'd가 가장 빛남 — 가중치 올림
    isEligible: (ctx) => ctx.hour >= 22 || ctx.hour < 5,
    lines: [
      '아직 깨어있군요',
      '별 보고 출근, 별 보고 퇴근',
      '내일은 내일의 토큰이에요',
      '저는 자도 돼요?',
      '화면 좀 어둡게 해줘요',
      '이 시간엔 저도 졸려요',
      '내일이 기다려요',
      '오늘은 이만하면 어때요',
    ],
  },

  // ─── 사용량 코멘트 ─────────────────────────────────────

  usageLow: {
    weight: 2,
    tag: "usage-low",
    isEligible: (ctx) => ctx.usagePct < 30,
    lines: [
      '고리가 여유로워요',
      '오늘은 천천히네요',
      '숫자 아직 작아요',
      '아직 시작이에요',
      '고리에 빈자리 많아요',
    ],
  },

  usageMid: {
    weight: 2,
    tag: "usage-mid",
    isEligible: (ctx) => ctx.usagePct >= 30 && ctx.usagePct < 70,
    lines: [
      '절반쯤 와있어요',
      '리듬 좋네요',
      '이대로 가도 좋아요',
      '고리가 차오르고 있어요',
      '딱 적당해요',
    ],
  },

  usageHigh: {
    weight: 3,
    tag: "usage-high",
    isEligible: (ctx) => ctx.usagePct >= 70 && ctx.usagePct < 90,
    lines: [
      '고리 슬슬 차고 있어요',
      '조금만 살살이요',
      '여기서부터 천천히',
      '고리가 두툼해요',
      '남은 자리 봐주세요',
    ],
  },

  usageAlarm: {
    weight: 4, // 5→4로 낮춤 — 너무 자주 뜨면 피로감
    tag: "usage-alarm",
    isEligible: (ctx) => ctx.usagePct >= 90,
    lines: [
      '고리가 가득 차가요',
      '거의 끝이에요',
      '리셋까지 한 모금만',
      '다음 시간을 기약해요',
      '여유분 거의 없어요',
    ],
  },

  // ─── 시그니처 위트 (30개) ───────────────────────────────

  wit: {
    weight: 5, // 캐릭터의 핵심 — 가장 자주 등장
    isEligible: () => true,
    lines: [
      // 자기 인지 (셀프 어웨어) — 10개
      '픽셀 16개로 충분해요',
      '다리 네 개라 의자에 못 앉아요',
      '왼팔이 살짝 비대칭이에요',
      '수염 아니에요, 다리예요',
      '방금 깜빡인 거 보셨어요?',
      '여기 이 화면이 제 집이에요',
      '확대해도 픽셀이에요',
      '저는 16×32 크기예요',
      '오렌지가 제 운명 색이에요',
      '안티에일리어싱 안 받았어요',

      // 관찰자 시점 — 위젯 안에서 보는 것 — 8개 (차별점)
      '화면 밖은 어때요?',
      '여기서 다 보고 있어요',
      '고리 도는 거 구경 중이에요',
      '키보드 소리 좋아해요',
      '마우스 따라가는 게 취미예요',
      '오늘 화면 깔끔하네요',
      '지금 뭐 보고 있어요?',
      '이 위젯이 제 우주예요',

      // Claude 메타 — 5개 (정체성 핵심)
      'Claude는 글로, 저는 픽셀로 답해요',
      '본체는 따로 있어요',
      'Claude의 사촌쯤 돼요',
      'Claude는 똑똑하고 저는 작아요',
      '토큰은 무한해 보여도 시간은 5시간',

      // 작명 농담 — 3개
      "Claw + 'd, 발음은 마음대로요",
      '이름이 좀 헷갈리죠',
      "Claw'd라고 적고 클로드라고 읽어요",

      // 작은 관찰 — 4개
      '픽셀로 사는 거 나쁘지 않아요',
      '여긴 항상 따뜻해요',
      '심심해서 한 번 돌아봤어요',
      '이 안은 시간이 천천히 가요',
    ],
  },

  // ─── 웰니스 너지 (관찰형) ───────────────────────────────

  wellness: {
    weight: 1, // 가끔만
    isEligible: () => true,
    lines: [
      '어깨 굳었을 시간이에요',
      '5분 멀리 봐도 돼요',
      '허리는 안녕한가요?',
      '잠깐 일어나도 화면 안 도망가요',
      '물잔 비었네요',
      '기지개 한 번 어때요',
      '눈이 뻑뻑하지 않아요?',
    ],
  },
} as const satisfies Record<string, LinePool>;

// ─── 셀렉터 ──────────────────────────────────────────────

// 직전 라인 기억 (즉시 반복 방지용)
let lastLine: string | null = null;

/**
 * 컨텍스트에 따라 가중치 랜덤 선택으로 라인 하나 반환.
 *
 * 알고리즘:
 *   1. 컨텍스트 조건을 만족하는 풀만 추림
 *   2. 가중치 합 기준으로 풀 하나 선택 (weighted random)
 *   3. 그 풀에서 라인 하나 균등 랜덤
 *   4. 직전 라인과 같으면 한 번만 재시도
 *
 * 반환의 `tag` 는 사용률 풀이 골랐을 때만 채워짐 — 그 외엔 null.
 * 말풍선 컴포넌트가 tag 별로 prefix 글리프(◌◐◉▲)를 붙임.
 */
export function pickLine(ctx: LineContext): PickedLine {
  // `as LinePool[]` widens away the literal types from `as const satisfies`,
  // restoring the optional `tag` property on every pool element.
  const eligible = (Object.values(POOLS) as LinePool[]).filter((p) => p.isEligible(ctx));
  const totalWeight = eligible.reduce((sum, p) => sum + p.weight, 0);

  const draw = (): PickedLine => {
    let roll = Math.random() * totalWeight;
    for (const pool of eligible) {
      roll -= pool.weight;
      if (roll <= 0) {
        const text = pool.lines[Math.floor(Math.random() * pool.lines.length)];
        return { text, tag: pool.tag ?? null };
      }
    }
    // 부동소수 오차 안전망
    const last = eligible[eligible.length - 1];
    const text = last.lines[Math.floor(Math.random() * last.lines.length)];
    return { text, tag: last.tag ?? null };
  };

  let result = draw();
  if (result.text === lastLine) result = draw(); // 한 번 재시도
  lastLine = result.text;
  return result;
}

/** 현재 시각 + 사용률로 컨텍스트 만드는 헬퍼 */
export function makeContext(
  usagePct: number,
  now: Date = new Date(),
): LineContext {
  return {
    hour: now.getHours(),
    usagePct: Math.max(0, Math.min(100, usagePct)),
  };
}
