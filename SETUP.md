# 방문 통계와 비공개 건의함 설정

## 현재 구조와 배포

기존 저장소는 루트의 index.html과 이미지로 구성된 정적 사이트이며, 기존 netlify.toml·package.json·서버 함수는 없었습니다. Netlify 대시보드의 실제 연결 저장소/배포 브랜치/환경변수는 이 작업에서 접근하지 못했습니다.

추가한 netlify.toml은 Node 22로 `node scripts/build.cjs`를 실행하고, 공개 파일만 `public/`에 복사합니다. Publish directory는 `public`, Functions directory는 `netlify/functions`입니다. Base directory는 저장소 루트(빈 값)로 두세요. 수동으로 HTML만 업로드하면 서버 함수가 배포되지 않습니다. Netlify 사이트가 `0928-pixel/history_study` 저장소의 main 브랜치와 연결되어 있는지 확인한 뒤 변경을 병합하고 재배포하세요.

## 필요한 외부 서비스와 환경변수

Netlify 프로젝트의 **Project configuration → Environment variables**에서 아래 값을 추가하세요. 런타임 **Functions** 범위가 포함되어야 합니다. 비밀 값은 저장소나 HTML에 적지 마세요. 설정 후 재배포가 필요합니다. 키를 채팅으로 보내지 않아도 됩니다.

| 변수 | 설정할 값 |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Upstash Console에서 영구 Redis 데이터베이스를 만든 뒤 REST API URL 복사 |
| `UPSTASH_REDIS_REST_TOKEN` | 같은 데이터베이스의 읽기·쓰기 REST token (read-only token 사용 불가) |
| `VISITOR_SECRET` | 32자 이상의 무작위 비밀 문자열. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`로 생성 가능 |
| `RESEND_API_KEY` | Resend에서 발급한 이메일 전송 권한 API 키 |
| `FEEDBACK_FROM` | Resend에서 인증한 도메인의 발신 주소. 예: `한국사 탐험대 <feedback@소유한도메인>` |
| `FEEDBACK_TO` | 운영자가 지정한 비공개 수신 이메일 주소 |
| `SITE_ORIGIN` | **https://histotystudy.netlify.app** (끝 슬래시 없음). 별도 도메인이 있으면 쉼표로 구분 |

Resend의 Domains 메뉴에서 본인이 소유한 도메인을 추가하고 안내하는 DNS 레코드로 인증하세요. 소유하지 않은 `naver.com` 주소를 발신자로 설정하면 안 됩니다. 테스트 발신 주소는 수신 제한이 있으므로 실제 운영에서는 인증한 도메인이 필요합니다. 수신 주소만 네이버 메일로 설정합니다. 발송 API의 수락은 수신함 도착 보장이 아니므로 Resend Logs와 네이버 스팸함도 확인하세요.

Production 환경변수는 프로덕션에만 설정하세요. Deploy Preview는 별도 Redis와 테스트 수신자를 사용하고, 해당 미리보기 URL을 `SITE_ORIGIN`에 정확히 등록하세요. 여러 환경이 같은 Redis를 사용하면 집계도 공유됩니다. Netlify 비용 및 서비스별 사용량 한도도 계정에서 확인하세요.

## 집계의 의미와 정확성

- 오늘 접속자는 **한국 시간 00:00~23:59, 같은 브라우저 쿠키 기준 하루 한 번**입니다. 누적 접속자는 매일 집계된 방문 수의 합이며 실시간 동시 접속자가 아닙니다.
- 서버가 UUID를 발급하고 HMAC으로 서명한 Secure·HttpOnly·SameSite 쿠키(1년)를 사용합니다. 브라우저에서 숫자를 저장하거나 올리지 않습니다. 공유 Redis의 Lua 스크립트가 일별 중복 확인과 오늘/누적 증가를 한 번에 원자적으로 처리합니다. 여러 탭의 최초 접속은 지원 브라우저에서 Web Locks로 직렬화합니다.
- 집계는 설치 시 0부터 시작하며 과거 방문 수를 복구하지 않습니다. JS를 끄거나 네트워크가 끊기면 집계되지 않습니다. 다른 기기·브라우저, 쿠키 삭제/차단, 자동화 트래픽은 실제 사람 수와 차이가 납니다. 로그인 없이 사람 자체를 완벽하게 식별할 수는 없습니다.
- 일별 중복 표식은 48시간 후 삭제되고 일별 수치와 누적 값은 영구 보관됩니다. Redis를 삭제하거나 만료시키면 수치가 사라집니다. 메모리 초과 시 키를 임의 삭제하는 eviction을 사용하지 말고 데이터 보존/백업 정책을 확인하세요.
- 화면은 60초마다 통계를 읽고 열린 화면이 한국 시간 자정을 지나면 새 날짜 방문을 등록합니다. 저장소 오류 시 가짜 0을 표시하지 않고 안내 문구를 표시합니다.

## 이메일·스팸·중복 방지

- 수신 주소는 서버 환경변수에서만 읽습니다. 클라이언트가 전달한 수신자는 무시하며 HTML/JS/응답에 운영자 이메일이나 API 키를 넣지 않습니다.
- 분류는 허용 목록, 본문은 공백 정리 후 10~2,000자, 전체 요청은 12KB로 제한합니다. 일반 텍스트 이메일로 보내 HTML 삽입을 방지합니다.
- 같은 출처의 JSON POST만 허용하며 숨김 필드(honeypot)를 검사합니다. Origin 검사는 브라우저의 외부 사이트 요청을 막지만 직접 요청하는 봇의 인증 수단은 아닙니다.
- Netlify가 제공하는 신뢰 IP 헤더만 사용해 IP별 시간당 최대 5회, 전체 24시간 최대 200회를 Redis에서 공용 제한합니다. 원본 IP는 저장하지 않고 HMAC 값만 최대 1시간 보관합니다. 같은 학교/가정의 공유 IP도 제한을 공유합니다.
- 동일 분류·내용은 모든 방문자를 통틀어 24시간 중복 억제합니다. 처리 중 잠금은 60초이며 함수가 중단되어도 만료됩니다. Resend에도 동일 본문 기반 idempotency key를 보내 네트워크 오류 후 재시도에 의한 중복 발송을 방지합니다. 전송 실패 시 입력 내용은 화면에 남습니다.
- 키/저장소가 없거나 API가 실패하면 성공으로 꾸미지 않고 503을 반환합니다. 운영 환경에서 더 강한 봇 방어가 필요하면 Turnstile 등 서버 검증을 추가하세요. 현재 구성은 honeypot과 공유 rate limit 기반입니다.

## 테스트와 운영 확인

`npm test`, `npm run build`를 실행하세요. 테스트는 외부 API를 모의 처리해 쿠키 서명, 한국 시간 자정, 집계 요청 형태, 입력 검증, 출처, 전송 제한, 동시 중복 요청, 이메일 실패/재시도, 설정 누락을 검사합니다. 실제 Redis Lua 실행과 실제 이메일 도착은 키 설정 후 별도 확인해야 합니다.

배포 후 다음을 확인하세요.

1. Functions 목록에 visitors와 feedback이 표시되는지 확인합니다.
2. 같은 브라우저에서 새로고침해도 오늘 수치가 증가하지 않고, 새 브라우저에서 한 번 증가하는지 확인합니다.
3. 다른 기기에서 공용 수치가 일치하는지 확인하고 한국 시간 자정 이후 일별 수치를 확인합니다.
4. 건의함에서 고유한 테스트 의견을 한 번 보내 Resend Logs와 네이버 수신함에서 확인합니다. 같은 의견을 재전송해 한 번만 발송되는지 확인합니다.
5. 잘못된 Origin, 짧은 본문, 연속 요청이 각각 거절되는지 확인합니다. 브라우저 소스/네트워크 응답에 수신 주소·키가 없는지 확인합니다.
6. 키를 제거한 미리보기에서 통계 오류 안내와 폼 내용 보존을 확인합니다.

공식 문서: [Netlify 함수 환경변수](https://docs.netlify.com/build/functions/environment-variables/), [Upstash REST API](https://upstash.com/docs/redis/features/restapi), [Resend 이메일 API](https://resend.com/docs/api-reference/emails/send-email), [Resend 중복 방지](https://resend.com/changelog/idempotency-keys).
