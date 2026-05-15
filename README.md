# Claude Pulse

> Claude Code 사용량을 한눈에 — 화면 구석에 떠 있는 작은 데스크탑 위젯

화면 우측 상단에 자그마하게 떠 있는 원형 위젯이, 지금 본인의 Claude Code (Max 플랜)
사용량 % 와 5시간 / 7일 리셋까지 남은 시간을 보여줍니다. Claude Desktop 의
`/usage` 슬래시 명령과 **완전히 동일한 정확한 수치** 를 띄웁니다.

귀여운 픽셀 캐릭터 Claw'd 가 사용량에 따라 표정이 바뀌고 한마디씩 던지기도
하고, 음악 듣기 기능도 내장되어 있어 작업하는 동안 옆에 두기 좋습니다.

---

## 다운로드 + 설치

### 1단계 — 사전 준비 확인

다음 두 가지가 본인 PC 에 있어야 합니다:

- **Windows 10 또는 11** (64bit)
- **Claude Desktop 앱이 설치되어 있고 로그인된 상태**
  - 설치 안 되어 있다면 [claude.ai/download](https://claude.ai/download) 에서 다운로드
  - 설치 후 한 번 로그인까지 마쳐주세요

### 2단계 — 위젯 다운로드

오른쪽 **[Releases](https://github.com/sanhae0516-eng/claude-pulse/releases/latest)**
페이지에서 가장 최근 버전의 `Claude Pulse_x.x.x_x64_en-US.msi` 파일을 받으세요.

### 3단계 — 설치

받은 `.msi` 파일을 더블클릭합니다.

> **"Windows 에서 PC 를 보호했습니다" 경고가 떠도 정상입니다.**
> 이 앱은 아직 코드 서명이 안 되어 있어서 Windows 가 모르는 게시자로 표시합니다.
>
> **추가 정보** → **그래도 실행** 클릭하시면 됩니다.

설치 화면에서 그냥 `Next` → `Install` → `Finish` 누르면 끝.

### 4단계 — 실행

시작 메뉴에서 "Claude Pulse" 검색해서 실행하면 화면 어딘가에 작은 원형 위젯이
나타납니다. (기본 위치는 우측 상단이지만 드래그로 옮길 수 있습니다.)

---

## 기본 사용법

### 위젯 보기

- **링 두 개**:
  - 바깥쪽 베이지 링 — 5시간 리셋까지 남은 시간 (시계 돌아가듯이)
  - 안쪽 컬러 링 — 사용률 % (60% 민트 → 85% 앰버 → 95% 코랄)
- **가운데 큰 숫자**: 현재 사용률 %
- **그 아래 작은 글씨**: 리셋까지 남은 시간 (`2h 30m` 등)
- **week 14%**: 7일 한도 사용률

### 클릭/드래그

| 동작 | 결과 |
|---|---|
| 빈 영역을 드래그 | 위젯 위치 이동 |
| 우측 하단 톱니바퀴 (⚙) | 설정 패널 열기 |
| 좌측 하단 ♪ 버튼 | 음악 플레이어 열기 |
| 가운데 Claw'd 캐릭터 클릭 | Claw'd 가 한마디 던짐 (한 번 더 누르면 멈춤) |

### 트레이 아이콘

설치하면 시계 옆 시스템 트레이에 작은 아이콘이 생깁니다.

- **좌클릭**: 위젯 보이기 / 숨기기 토글
- **우클릭**: Show / Hide, Quit 메뉴

위젯 창의 X 버튼을 눌러도 완전히 꺼지지 않고 트레이로 숨겨집니다. 진짜로
끄려면 트레이 우클릭 → **Quit** 또는 설정 패널의 **Quit Claude Pulse** 버튼.

---

## 설정 패널 둘러보기

톱니바퀴 클릭하면 4개 탭이 보입니다.

### Appearance — 외관
- **Size**: 위젯 크기 (Compact / Default / Large / Custom slider)
- **Opacity**: 투명도
- **Show character**: Claw'd 표시 여부
- **Show week ring**: 7일 한도 표시 여부
- **Lock position**: 드래그 잠금 (실수로 위치 안 옮기게)

### Colors — 색상
- 채널별 (시간 링 / 사용률 링 / 숫자) 컬러 직접 지정
- 5단계 사용률 구간마다 색 따로 설정 가능
- 마음에 안 들면 **Reset** 으로 기본 팔레트 복귀

### Sound — 소리
- **Sounds**: 클릭 / 알림 효과음 on/off
- **Voice**: Claw'd 가 말할 때 픽셀 톤의 음성 재생
- **Volume**: 음성 볼륨

### About
- 버전 정보
- Quit 버튼 (앱 완전 종료)
- 자동 시작 토글 (Windows 부팅 시 자동 실행)

---

## 음악 플레이어 (♪ 버튼)

위젯 좌측 하단의 ♪ 버튼을 누르면 위젯 바로 아래에 작은 플레이어 창이 펼쳐집니다.

- **폴더 선택**: 음악 파일이 들어있는 폴더 지정 (mp3/flac/wav/m4a/ogg/opus 지원)
- **재생 컨트롤**: 이전 / 재생-정지 / 다음 / 볼륨
- **트랙 목록**: 클릭으로 곡 변경
- **창 따라다님**: 위젯을 드래그하면 플레이어도 같이 움직임

음악이 재생되는 동안 Claw'd 가 비트에 맞춰 **춤추는** 모드로 바뀝니다. 작은 픽셀
음표 4개가 캐릭터 주변에서 둥실둥실 떠올라요.

---

## 문제 해결

### 위젯이 안 켜져요
- Windows 트레이 화살표 (▲) 클릭해서 숨겨진 아이콘 중에 있는지 확인
- 시작 메뉴에서 "Claude Pulse" 검색해서 다시 실행

### "token — open Claude Desktop" 메시지가 떠요
이건 위젯이 Claude Desktop 의 인증 토큰을 못 읽고 있다는 뜻입니다. 다음 순서로 확인:

1. **Claude Desktop 이 설치되어 있나요?**
   - [claude.ai/download](https://claude.ai/download) 또는 Microsoft Store
2. **Claude Desktop 에 로그인하셨나요?**
   - Claude Desktop 을 한 번 열어서 본인 계정으로 로그인 (Anthropic / Google 계정 등)
3. **로그인했는데도 안 되면**:
   - Claude Desktop 을 완전히 종료했다가 다시 켜기
   - 위젯도 종료했다가 다시 실행 (트레이 → Quit → 시작 메뉴에서 재실행)

### "rate-limited · retrying" 이 떠요
Anthropic 서버가 잠시 호출 횟수를 제한한 상태입니다. 위젯이 자동으로 60-90초마다
재시도하니까 그냥 두면 풀립니다.

### 사용량 % 가 안 바뀌어요
위젯은 60초마다 자동 갱신됩니다. 한참 그대로면 다음을 확인:
- 위젯 종료 후 다시 실행
- Claude Desktop 이 실행 중인지

### 모서리에 이상한 게 보여요 / 위젯이 깨져 보여요
최신 버전으로 업데이트하세요. v0.4.1 부터 모서리/투명도 이슈가 해결됐습니다.

### 디버그 로그는 어디 있나요?
문제 진단용 로그가 다음 위치에 자동으로 남습니다:
```
%LOCALAPPDATA%\claude-pulse-auth-debug.log    (토큰 인증 단계별 로그)
%LOCALAPPDATA%\claude-pulse-debug.log         (사용량 API 응답 로그)
```
이슈 리포트할 때 이 두 파일 내용을 첨부해 주시면 도움됩니다.

---

## 자주 묻는 질문

### macOS / Linux 도 지원되나요?
현재는 **Windows 만 지원**합니다. macOS / Linux 의 토큰 저장 방식이 달라서 추가
작업이 필요합니다. 향후 지원 예정.

### 데이터가 정확한가요?
네. Claude Desktop / Claude Code 의 `/usage` 슬래시 명령이 호출하는 **것과 동일한
공식 API** 를 사용합니다. 즉 Anthropic 서버의 가중치 (Opus·Sonnet 차등, 캐시 정책)
가 그대로 반영된 정확한 수치입니다.

### Pro / Free 플랜도 되나요?
Max 플랜 기준으로 디자인됐지만, Pro 플랜도 같은 `/usage` 엔드포인트를 쓰면
동작은 합니다. Free 플랜은 미검증.

### 토큰을 어떻게 가져오나요? 안전한가요?
본인 PC 의 Claude Desktop 이 로컬에 저장해둔 OAuth 토큰을, Windows DPAPI
(본인 계정으로만 복호화 가능) 로 풀어서 사용합니다.

- ✅ 토큰은 **본인 PC 밖으로 안 나갑니다**. (Anthropic 서버에 직접 호출만 함)
- ✅ 다른 사용자 / 다른 PC 가 본인 토큰을 못 가져갑니다 (DPAPI 가 사용자 SID 에
  묶여 있음).
- ⚠️ 위젯이 본인 Claude Desktop 의 저장 파일을 읽는다는 사실이 본인 보안 정책과
  맞지 않다면 사용하지 마세요.

### 자동 업데이트 되나요?
아직 안 됩니다. 새 버전이 나오면 [Releases](https://github.com/sanhae0516-eng/claude-pulse/releases)
페이지에서 새 MSI 받아서 다시 설치하시면 됩니다. (기존 버전 위에 덮어쓰기 가능)

### Anthropic 공식 도구인가요?
**아닙니다.** 개인이 만든 비공식 위젯입니다. Anthropic 과 무관합니다.

---

## 개발자 정보

직접 빌드하고 싶거나 코드 기여하고 싶으면:

### 필요한 도구
- Node.js 20+
- Rust (stable msvc toolchain)
- Visual Studio 2022 Build Tools (VC++ x64 + Windows 11 SDK)

### 개발 모드 실행
```powershell
npm install
npm run tauri dev
```

### MSI 빌드
```powershell
npm run tauri build
```
산출물: `src-tauri/target/release/bundle/msi/`

### 코드 구조
- `src/` — React 프론트엔드 (위젯 UI, 설정 패널, 음악 플레이어)
- `src-tauri/src/` — Rust 백엔드
  - `auth.rs` — Claude Desktop OAuth 토큰 복호화 (DPAPI + AES-GCM)
  - `api.rs` — Anthropic `/api/oauth/usage` 호출
  - `music.rs` — 음악 메타데이터 + 파일 시스템 접근
  - `lib.rs` — 윈도우 setup, 트레이, 음악 창 동기화

---

## 만든 사람

**산해** ([@sanhae0516-eng](https://github.com/sanhae0516-eng))

## 라이선스 / 사용 약관

이 프로젝트는 개인 사이드 프로젝트입니다. 자유롭게 fork / 수정해서 본인 용도로
쓰세요. 다만 Anthropic 의 비공식 API 를 호출하는 특성상, Anthropic 이 정책을
변경하면 언제든 동작이 멈출 수 있다는 점을 유념해 주세요.

## 이슈 / 버그 리포트

문제가 있으면 [Issues](https://github.com/sanhae0516-eng/claude-pulse/issues)
페이지에 적어주세요. 이때 위의 디버그 로그 두 개를 첨부해 주시면 빠르게 원인
파악이 됩니다.
