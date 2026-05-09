# Claude Pulse

Claude Code (Max 플랜) 사용량을 실시간으로 보여주는 다크 글래스모피즘 데스크톱 위젯.

- **외부 블루 링** — 5시간 윈도우 리셋까지 남은 시간
- **내부 컬러 링** — 토큰 사용률 (60% 민트 → 85% 앰버 → 100% 코랄)
- **가운데 숫자** — 사용률 % + 리셋까지 남은 시간

## 동작 원리 (그리고 한계)

`~/.claude/projects/**/*.jsonl` 의 `assistant` 메시지 수를 세서
최근 5시간 윈도우 내 사용량을 추정합니다.

- 윈도우 시작 = 5h 내 가장 오래된 assistant 메시지
- 리셋 = 윈도우 시작 + 5h
- 기본 한도 = 200 메시지 (Max 5x 추정치, `parser.rs::DEFAULT_LIMIT`)

### 정확도에 대한 솔직한 고지

**위젯의 % 는 근사치입니다 (`~44%` 같이 틸데로 표기).**

Claude Code 내장 `/usage` 명령은 Anthropic 서버의 가중치 기반 정확한 수치를
반환하지만, 그 데이터는 인터랙티브 모드에서만 접근 가능하고 외부 앱이
호출할 공개 API가 없습니다. (Opus·Sonnet 차등 가중치, 캐시 정책 등은 비공개.)

이 위젯은 로컬 JSONL 의 메시지 수를 세는 것뿐이므로 Claude 의 공식 % 와
정확히 일치하지 않습니다. 자기 환경에 맞춰 조정하려면 `DEFAULT_LIMIT` 를
수정하거나, 향후 추가될 `~/.claude-pulse/config.json` 으로 오버라이드하세요.

## 개발

```bash
npm install
npm run tauri dev
```

브라우저에서 UI 만 미리보려면:

```bash
npm run dev
```

(Tauri 환경 밖에서는 mock 데이터로 렌더됨)

## 빌드

```bash
npm run tauri build
```

산출물: `src-tauri/target/release/bundle/`

## 디자인

[design.md](./design.md) 참고.
