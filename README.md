# English Basket

오늘 만난 영어를 모으고 다시 써 보는, 한국어 사용자를 위한 개인 영어 학습 PWA입니다. 외부 UI 라이브러리나 빌드 단계 없이 Node.js 22 이상에서 실행됩니다.

## PC에서 시작하기

1. `start.cmd`를 실행하거나 `node --env-file-if-exists=.env server.mjs`를 실행합니다.
2. 브라우저에서 `http://localhost:4317`을 엽니다.
3. 내 바구니에서 단어·숙어·표현·문장을 입력합니다. 연결 없이 수집·복습·Level 안내·기록 확인이 가능합니다.
4. GPT 사용 시 `.env.example`을 `.env`로 복사하고 `OPENAI_API_KEY`와 긴 임의 문자열 `BASKET_TOKEN`을 입력합니다. 서버를 다시 실행하고 앱 설정에 같은 개인 접속 암호를 입력합니다. 서버 주소는 비워 둡니다.

API 키는 브라우저에 입력하지 않습니다. ChatGPT 대화 링크나 기존 대화는 앱의 로그인 또는 API 연결을 제공하지 않습니다. GPT 대화와 평가는 OpenAI API 연결이 필요하고 별도 API 요금이 발생할 수 있습니다. 현재 기본 모델은 설정 가능한 `gpt-4o-mini`입니다. 서버는 Responses API의 구조화 출력을 사용하고 `store:false`로 요청합니다. 학습 자료와 대화는 요청 시 OpenAI로 전송됩니다. API 데이터 처리 정책은 별도로 확인하세요.

## 매일의 흐름

- 오늘의 표현 담기 → 새/과거 표현 섞어서 복습 → Level 목표 확인 → 1분 GPT 대화 또는 3개 장면 미니 테스트 → 종료 후 핵심 교정 최대 2개와 표현별 사용 결과 기록.
- Stage: 읽어서 이해 → 도움받아 사용 → 도움 없이 사용 → 서로 다른 장면에서 사용 → 최소 3일 뒤에도 독립 사용. 마지막 Stage가 ‘내 것이 된 표현’입니다.
- Level 1~6은 상황 설명과 영어 복잡도를 조절하는 앱의 학습 단계입니다. 공인 CEFR 등급이 아닙니다. 3개 응답, 2개 이상 독립 사용, GPT의 상황별 의사소통 평가를 모두 충족하면 올라갑니다.
- 대화 시간은 대화 화면이 활성 상태일 때만 누적하고 응답 대기 시간은 제외합니다. 실제 발화 시간을 측정하는 음성 분석은 아닙니다. 60초 이상 완료한 대화로 연속일을 계산하며 날짜는 한국 시간입니다.
- ‘다시 살아난 표현’은 마지막 성공 또는 수집 후 7일 이상 지난 표현을 성공적으로 재사용했을 때 기록합니다.
- 음성 입력은 브라우저 SpeechRecognition, 읽어주기는 SpeechSynthesis를 사용합니다. 기기 지원과 마이크 권한에 따라 이용 가능하며 입력은 전송 전 확인할 수 있습니다. 실시간 음성 API 통화는 다음 확장 단계입니다.
- 진행 중인 대화와 입력 초안은 현재 탭에 임시 저장되어 새로고침 후에도 1분 대화 화면에서 이어갈 수 있습니다. 탭을 닫기 전 종료 버튼으로 평가와 영구 저장을 마쳐 주세요.

## GitHub와 모바일 배포

공개 저장소: https://github.com/Park-hyojoon/english-basket

모바일 앱 주소: https://park-hyojoon.github.io/english-basket/

GitHub 설정 → Pages → Source는 GitHub Actions입니다. `.github/workflows/pages.yml`은 검사 후 `public/`만 배포합니다. main에 변경 사항을 올리면 화면이 자동 배포됩니다.

GitHub Pages는 정적 화면만 실행합니다. 실제 GPT는 별도 HTTPS Node 서버가 필요합니다. 서버 배포 시 환경 변수 `OPENAI_API_KEY`, `BASKET_TOKEN`, `HOST=0.0.0.0`, 플랫폼의 `PORT`, `ALLOWED_ORIGINS=https://park-hyojoon.github.io`를 설정하세요. 앱 설정에서 해당 HTTPS 서버 주소와 개인 접속 암호를 입력합니다. 서버 주소에 경로를 붙이지 마세요. CORS 허용 주소는 경로 없이 정확한 origin입니다. 접속 암호는 탭 단위 저장이며 백업/영구 저장에 포함되지 않습니다. API는 인증과 요청 크기 제한 및 IP별 분당 20회 제한을 적용합니다. 개인 사용 서버 구조이며 다중 사용자 인증/결제/클라우드 DB는 포함하지 않습니다.

모바일에서 배포된 HTTPS 주소를 열고 홈 화면에 추가합니다. Android 설치 메뉴 또는 iPhone Safari 공유 → 홈 화면에 추가를 사용할 수 있습니다. 첫 방문 후 오프라인 수집·복습·기록 조회가 가능합니다. GPT 기능은 온라인 연결이 필요합니다.

## 데이터와 확장 구조

학습 데이터는 브라우저 `english-basket-v1`에 저장됩니다. 자동 기기 동기화는 없습니다. 설정의 백업 내보내기/가져오기로 기기 간 이동하며 ID 기반으로 이력을 병합합니다. 브라우저 데이터를 지우면 기록을 잃을 수 있으므로 주기적으로 백업하세요. 개인 백업과 `.env`는 공개 저장소에 올리지 마세요.

`public/domain.mjs`: 숙달·혼합·날짜·성장·백업 병합. `public/app.mjs`: 화면과 학습 흐름. `coach.mjs`: GPT 프롬프트·스키마·검증. `server.mjs`: 인증·API·정적 서버. 이후 계정/동기화, 간격 반복, 실시간 음성, 상황 라이브러리를 모듈별로 확장할 수 있습니다.

검사: `node --test tests/*.test.mjs`. 배포마다 서비스 워커의 CACHE 버전을 갱신하세요.

공식 API 참고: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
