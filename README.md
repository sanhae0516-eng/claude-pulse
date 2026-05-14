# Claude Pulse

Claude Code (Max 플랜) 사용량을 실시간으로 보여주는 다크 글래스모피즘 데스크톱 위젯.

- **외부 블루 링** — 5시간 윈도우 리셋까지 남은 시간
- **내부 컬러 링** — 토큰 사용률 (60% 민트 → 85% 앰버 → 100% 코랄)
- **가운데 숫자** — 사용률 % + 리셋까지 남은 시간

## 동작 원리

Claude Code 의 `/usage` 슬래시 명령이 호출하는 것과 **동일한** 인증
엔드포인트 (`https://api.anthropic.com/api/oauth/usage`) 를 직접 호출합니다.
Anthropic 서버의 가중치 기반 정확한 수치 (Opus·Sonnet 차등, 캐시 정책 반영) 를
그대로 받아오므로 `/usage` 와 일치합니다.

토큰 흐름 (Windows 기준):

1. `%APPDATA%\Claude\Local State` 에서 `os_crypt.encrypted_key` 를 읽어
   DPAPI 로 복호화 → AES-256 마스터키 획득 (Chromium v10 cookie 방식과 동일)
2. `%APPDATA%\Claude\config.json` 의 `oauth:tokenCache` 를 AES-256-GCM 으로
   복호화 → OAuth access token 추출
3. 추출된 토큰으로 `/api/oauth/usage` 에 `anthropic-beta: oauth-2025-04-20`
   헤더와 함께 호출

구현은 [src-tauri/src/auth.rs](./src-tauri/src/auth.rs) 와
[src-tauri/src/api.rs](./src-tauri/src/api.rs) 참고.

### 요구사항

- **Claude Desktop 앱이 설치되어 있고 로그인되어 있어야 합니다.** OAuth 토큰
  캐시를 Claude Desktop 이 관리하기 때문입니다. Claude Code CLI 만 설치된
  상태로는 동작하지 않습니다 (CLI 는 `~/.claude/projects/` 에 별도 저장).
- Windows 외 OS 는 현재 토큰 복호화 경로가 미구현 (`auth.rs` 의
  `dpapi_decrypt` 가 Windows-only).

### 문제 진단

위젯이 데이터를 못 가져오면 다음 두 로그 파일을 확인하세요 (append 모드):

- `%LOCALAPPDATA%\claude-pulse-auth-debug.log` — 토큰 단계별 성공/실패
- `%LOCALAPPDATA%\claude-pulse-debug.log` — `/usage` HTTP 응답

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
