# 비공개 건의함 설정

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

## 빌드 및 검증

Netlify: 저장소 루트를 Base directory로 사용, Build command `node scripts/build.cjs`, Publish directory `public`. netlify.toml에 명시되어 있습니다. `npm run build`로 빌드합니다. 공개 파일만 복사하므로 설정 문서는 배포 정적 파일에 들어가지 않습니다.

방문 통계 화면·주기적 집계 요청·쿠키·서버 함수·외부 데이터베이스 연결 코드는 제거했습니다. 비공개 건의함에는 환경변수나 별도 API 키가 필요하지 않습니다.

데스크톱/모바일 화면, 폼 접수 성공·실패, 실패 시 입력 유지와 중복 억제를 브라우저 모의 응답으로 확인합니다. 실제 Netlify Forms 접수는 폼 감지 활성화 및 배포 후 관리 화면에서 확인해야 합니다.
