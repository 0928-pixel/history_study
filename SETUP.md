# 비공개 건의함과 방문 통계 설정

## 비공개 건의함 — 별도 API 키 불필요

방문자는 사이트 하단의 ‘요청사항 적기’를 눌러 의견을 제출합니다. 의견은 Netlify Forms에 저장되고 운영자만 Netlify 관리 화면에서 확인합니다. 이메일 발송 함수와 Resend 설정은 제거했습니다. 수신 이메일 주소는 필요하지 않습니다.

1. Netlify에서 이 사이트의 **Forms** 메뉴를 엽니다.
2. **Form detection**이 꺼져 있으면 **Enable form detection**을 누릅니다. 이메일 알림은 설정할 필요가 없습니다. 기존에 직접 설정한 이메일 알림이 있다면 원하지 않을 경우 삭제하세요.
3. 이 변경을 main에 병합해 재배포합니다. 수동으로 HTML만 올리지 말고 Git 연결 배포를 사용하세요.
4. 배포 후 Forms에 **history-feedback** 폼이 나타나는지 확인합니다.
5. 사이트에서 고유한 테스트 의견을 한 번 보내고 **Forms → history-feedback → Submissions**에서 확인합니다. 보이지 않으면 Spam 목록도 확인하세요.

기존 Netlify 연결 프로젝트의 배포 검사 이름은 `netlify/e-history/deploy-preview`로 확인되었습니다. 대시보드의 실제 연결 저장소·배포 브랜치·요금제·폼 감지 설정에는 접근하지 못했습니다.

### 비용

Netlify 공식 문서 기준 **크레딧 요금제에서는 Forms 접수가 무료·무제한**입니다. **Legacy 요금제는 별도 한도와 과금 정책**이 있으므로 Billing/Forms Usage에서 현재 요금제를 확인하세요. 사이트 트래픽과 배포 등은 계정 요금제의 기존 한도에 포함됩니다. 이 변경은 유료 서비스 가입이나 결제 설정을 추가하지 않습니다.

공식 안내: https://docs.netlify.com/manage/forms/usage-and-billing/

### 스팸·중복·개인정보

Netlify 기본 스팸 필터와 숨김 honeypot 필드를 사용합니다. 화면에서 10~2,000자로 제한하고, 제출 버튼 중복 클릭을 막습니다. 같은 탭 세션에서는 같은 분류·내용의 성공한 제출을 24시간 중복 억제합니다. 이 제한은 브라우저 저장소를 지우거나 다른 기기로 접속하면 적용되지 않으며 서버 전체의 강제 중복 제한은 아닙니다. Netlify가 스팸으로 판단한 제출은 관리 화면의 Spam에 나타나거나 조용히 거절될 수 있습니다.

응답 실패 시 작성한 내용은 남습니다. 자바스크립트 없이도 일반 HTML 폼으로 제출할 수 있습니다. 공개 게시판·공개 목록 API는 추가하지 않았습니다. 의견에는 개인정보를 쓰지 않도록 안내하며, 운영자는 관리 화면에서 불필요한 제출을 삭제하고 계정 접근 권한을 관리하세요. sessionStorage는 동일 탭 세션의 마지막 제출 내용만 보관하며 탭을 닫으면 지워집니다.

공식 설정 문서: https://docs.netlify.com/manage/forms/setup/
스팸 필터: https://docs.netlify.com/manage/forms/spam-filters/

## 방문 통계 — 별도 선택 기능

**건의함은 아래 키 없이 작동합니다.** 기존 요청의 정확한 공용 방문 통계만 Upstash Redis 저장소가 필요합니다. API 키 자체는 결제 수단이 아니지만 서비스 사용량에 따라 요금이 생길 수 있습니다. 원하지 않으면 저장소 서비스를 만들지 마세요. 미설정 상태에서는 통계 이용 불가 안내가 표시되고 건의함은 정상적으로 별도 동작합니다.

Netlify Environment variables의 Functions 범위에 설정할 변수:

| 변수 | 값 |
| --- | --- |
| UPSTASH_REDIS_REST_URL | 영구 Upstash Redis의 REST URL |
| UPSTASH_REDIS_REST_TOKEN | 해당 DB의 읽기·쓰기 토큰 |
| VISITOR_SECRET | 32자 이상의 무작위 비밀 문자열 |
| SITE_ORIGIN | https://histotystudy.netlify.app (실제 운영 주소, 끝 슬래시 없음) |

변수 설정 후 재배포합니다. Preview에서는 별도 DB를 사용하고 정확한 미리보기 출처를 등록하세요. 비밀 값은 HTML이나 저장소에 넣지 마세요.

오늘 접속자는 한국 시간 기준 브라우저 쿠키별 하루 한 번이고, 누적은 매일 방문 수의 합입니다. 설치 시 0부터 시작합니다. 서명 쿠키와 Redis의 원자적 Lua 연산으로 여러 함수 인스턴스에서도 중복 증가를 막습니다. 원본 IP는 방문 통계에 저장하지 않습니다. 쿠키 삭제·차단, 다른 브라우저, JS 비활성화, 자동화 트래픽은 실제 사람 수와 차이를 만듭니다. 일별 중복 표식은 48시간 보관하고 집계 숫자는 영구 보관하므로 DB 삭제나 데이터 eviction을 피하세요.

## 빌드 및 검증

Netlify: 저장소 루트를 Base directory로 사용, Build command `node scripts/build.cjs`, Publish directory `public`, Functions directory `netlify/functions`. netlify.toml에 명시되어 있습니다. 공개 파일만 복사하므로 환경변수 예시·서버 코드·설정 문서는 배포 정적 파일에 들어가지 않습니다.

`npm test`는 방문 통계 함수의 모의 API 테스트를 실행합니다. `npm run build`는 정적 파일을 생성합니다. 실제 Redis Lua 실행과 Netlify Forms 접수는 운영 설정 후 확인해야 합니다. 데스크톱/모바일 폼 제출 성공·실패, 실패 시 입력 유지, 중복 억제와 통계 표시를 브라우저 모의 응답으로 별도 검증합니다.
