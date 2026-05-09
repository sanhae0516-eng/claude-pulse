## Claude Pulse v0.1.0

Claude Code Max / Pro 플랜 사용량을 실시간으로 보여주는 데스크톱 위젯입니다.

### 다운로드 (Windows 10 / 11)

| 파일 | 용도 |
|---|---|
| `Claude Pulse_0.1.0_x64-setup.exe` | **추천** — NSIS 설치 프로그램 (1.8 MB) |
| `Claude Pulse_0.1.0_x64_en-US.msi` | MSI 설치 프로그램 (2.7 MB) |
| `claude-pulse-portable.exe` | 포터블 — 설치 없이 실행 (4.9 MB) |
| `ClaudePulse-v0.1.0-windows-x64.zip` | 위 셋 + README 통합 (6.4 MB) |

### 사전 조건

- Windows 10 / 11
- [Claude Desktop](https://claude.ai/download) 설치 + 로그인
- Claude Max 또는 Pro 구독

### 설치 시 주의

코드 서명을 하지 않았으므로 **Windows SmartScreen 경고**가 뜹니다 (정상):
1. "추가 정보" 클릭
2. "실행" 버튼 클릭

### 주요 기능

- Anthropic 의 `/api/oauth/usage` 엔드포인트 직접 호출 (Claude Desktop 의 `/usage` 슬래시 명령과 동일 데이터)
- 5h 세션 사용률 + 리셋 카운트다운
- 7d 주간 한도 사용률
- 픽셀 마스코트 Claw'd
- 설정 패널 (크기 / 투명도 / 색상 프리셋 / 위치 잠금 / 시작 시 자동 실행)
- localStorage 캐시로 콜드 스타트 즉시 표시
- 60초 자동 폴링, 429 무음 처리

### 안전성

위젯은 사용자 PC 안에서만 동작합니다:
1. `%APPDATA%\Claude\config.json` 의 OAuth 토큰을 Windows DPAPI 로 디크립트
2. Anthropic 공식 API (`api.anthropic.com`) 직접 호출
3. **외부 서버로 토큰이나 데이터 전송 없음**

### 한계

- Anthropic 비공식 도구 — Claude Desktop 의 토큰 저장 방식이 변경되면 작동 중단 가능
- Windows 전용 (DPAPI 의존)
- Claude Code OAuth scope 사용

자세한 사용법은 ZIP 의 README.md 참고.
