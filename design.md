# Claude Pulse — Design System

> 데스크톱 한켠에 항상 떠있는 Claude Code 사용량 모니터링 위젯.
> 무드: **다크 글래스모피즘** — 반투명 검정 + 강한 블러 + 미세 네온 액센트.
> 제 1원칙: 종일 떠있어도 거슬리지 않을 것.

---

## 1. 컬러 토큰

### Surface

| 토큰 | 값 | 용도 |
|---|---|---|
| `--surface-base` | `rgba(12, 14, 18, 0.72)` | 위젯 메인 배경 |
| `--surface-raised` | `rgba(22, 25, 32, 0.78)` | 호버 / 펼친 모드 |
| `--surface-overlay` | `rgba(34, 38, 48, 0.85)` | 우클릭 메뉴 / 툴팁 |
| `--blur` | `24px` | `backdrop-filter: blur()` |
| `--border` | `rgba(255, 255, 255, 0.08)` | 기본 테두리 |
| `--border-strong` | `rgba(255, 255, 255, 0.14)` | 호버 / 활성 테두리 |

### Text

| 토큰 | 값 | 용도 |
|---|---|---|
| `--text-primary` | `rgba(255, 255, 255, 0.95)` | 메인 숫자 |
| `--text-secondary` | `rgba(255, 255, 255, 0.55)` | 보조 정보 |
| `--text-tertiary` | `rgba(255, 255, 255, 0.35)` | 레이블 / 캡션 |

### Usage Ring (사용률 단계별 컬러)

| 토큰 | 값 | 범위 |
|---|---|---|
| `--usage-low` | `#6EE7B7` | 0–60% (민트) |
| `--usage-mid` | `#FCD34D` | 60–85% (앰버) |
| `--usage-high` | `#F87171` | 85–100% (코랄) |

각 컬러에 alpha 0.4 글로우 + box-shadow 동반.

### Time Ring

| 토큰 | 값 | 용도 |
|---|---|---|
| `--time-ring` | `#60A5FA` | 5h 윈도우 카운트다운 (블루) |
| `--time-ring-track` | `rgba(96, 165, 250, 0.12)` | 트랙 배경 |

---

## 2. 타이포그래피

```css
--font-mono: "JetBrains Mono", "SF Mono", ui-monospace, monospace;
--font-sans: "Pretendard", "Inter", system-ui, sans-serif;
```

| 역할 | 폰트 | 크기 | weight | 기타 |
|---|---|---|---|---|
| 핵심 사용률 % | mono | 36px | 600 | tabular-nums |
| 남은 시간 | mono | 14px | 500 | secondary 컬러 |
| 레이블 | sans | 10px | 500 | uppercase, letter-spacing 0.08em |
| 상세 데이터 | mono | 12px | 400 | tabular-nums |

모든 숫자는 `font-variant-numeric: tabular-nums` 필수 — 자릿수 흔들림 방지.

---

## 3. 레이아웃

### 위젯 모드 (기본)

```
크기: 220 × 220 px
모서리: border-radius 24px
프레임: 없음 (frameless)
배경: 투명 + Acrylic vibrancy (Windows 11 네이티브)
항상 위: ON
드래그: 전체 영역 (가운데 숫자만 빼고)
```

### 시각 구성

```
   ╭─────────────────────╮
   │  ╭──────────────╮   │  ← 외부 링 (외경 200, 두께 4)
   │  │  ╭────────╮  │   │     리셋까지 남은 시간 (블루)
   │  │  │        │  │   │
   │  │  │  42%   │  │   │  ← 내부 링 (외경 170, 두께 8)
   │  │  │ 3h 12m │  │   │     사용률 (단계별 컬러)
   │  │  │        │  │   │
   │  │  ╰────────╯  │   │  ← 가운데
   │  ╰──────────────╯   │     사용률 % (36px / 600)
   ╰─────────────────────╯     남은 시간 (14px / secondary)
```

### 펼친 모드 (더블클릭)

```
크기: 320 × 420 px
구성:
  - 상단: 위젯 모드와 동일한 두 링
  - 중간: 모델별 토큰 분포 (Sonnet / Opus / Haiku) — 가로 막대
  - 하단: 24h 시간대별 사용량 — 작은 라인 차트
```

---

## 4. 인터랙션 / 모션

| 동작 | 트리거 | 효과 |
|---|---|---|
| 창 이동 | 좌클릭 드래그 | 어디서든 OK |
| 펼치기 / 접기 | 더블클릭 | 220→320 / 320→220, 250ms ease-out |
| 컨텍스트 메뉴 | 우클릭 | 종료 / 위치 잠금 / 시작 시 자동 실행 / 새로고침 |
| Hover | 마우스 진입 | surface-raised, border-strong, 80ms |
| 80% 돌파 알림 | 사용률 첫 80% 진입 | 내부 링 1회 펄스 (1.5s) |
| 95% 위험 알림 | 사용률 첫 95% 진입 | 내부 링 부드러운 깜빡임 (2s 사이클) |

**전역 transition:** `250ms cubic-bezier(0.4, 0, 0.2, 1)`
**감속이 필요한 곳:** `400ms cubic-bezier(0.16, 1, 0.3, 1)` (펼치기)

---

## 5. 컴포넌트 규칙

### 링 (Ring) 공통
- `<svg>` 기반, `<circle>` 의 `stroke-dasharray` + `stroke-dashoffset` 으로 진행률 표현
- `stroke-linecap: round`
- 진행률 변화는 transition 600ms ease-out

### 숫자 (Number)
- `tabular-nums` 강제
- 사용률은 항상 정수 % (소수점 없음)
- 시간은 `Xh Ym` 포맷 (1시간 미만 시 `Xm Ys`)

### 컨텍스트 메뉴
- `--surface-overlay` 배경
- 항목 height 28px, padding 0 12px
- hover 시 `rgba(255, 255, 255, 0.06)` 배경

---

## 6. 항상 떠있어도 거슬리지 않을 규칙

1. **소리 없음.** 모든 알림은 시각만.
2. **움직임 최소.** 펄스 / 깜빡임은 임계점에서만, 그 외엔 정적.
3. **광량 자제.** 글로우는 alpha 0.4 한도, 그 이상은 산만.
4. **숫자는 흔들리지 않음.** tabular-nums + 일정한 자릿수.
5. **포커스 가져가지 않음.** 모든 동작은 선택적, 자동 팝업 없음.
