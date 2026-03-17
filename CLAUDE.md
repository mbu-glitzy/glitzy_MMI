# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

MMI(Medical Marketing Intelligence) - 병원 마케팅 인텔리전스 멀티테넌트 SaaS 대시보드.
슈퍼어드민이 여러 병원 고객사를 통합 관리하고, 병원별 독립된 데이터/계정/광고 API를 운영.

## 개발 명령어

```bash
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint 검사
npm run start    # 프로덕션 서버 실행
npm run analyze  # 번들 크기 분석 (브라우저에서 시각화)
```

## 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **인증**: NextAuth.js (Credentials Provider, JWT 전략)
- **데이터베이스**: Supabase (PostgreSQL)
- **스타일링**: Tailwind CSS + shadcn/ui
- **차트**: Recharts (코드 스플리팅 래퍼 사용)
- **토스트**: Sonner
- **작업 큐**: Upstash QStash

## 문서

| 문서 | 설명 |
|------|------|
| [docs/SPEC.md](docs/SPEC.md) | 프로젝트 요구사항 명세 |
| [docs/API.md](docs/API.md) | REST API 엔드포인트 문서 |
| [docs/COMPONENTS.md](docs/COMPONENTS.md) | UI 컴포넌트 사용 가이드 |
| [docs/WORK_LOG.md](docs/WORK_LOG.md) | 작업 로그 |

## 아키텍처

### 멀티테넌트 구조
```
슈퍼어드민 (Glitzy)
├── 실행사 담당자 (agency_staff) ← 다중 병원 배정, 메뉴 권한 제한
├── 병원 A (clinic_id: 1)
│   ├── 병원 관리자 (clinic_admin) ← 전체 데이터 조회, 담당자 관리
│   └── 병원 담당자 (clinic_staff) ← 예약/결제/고객/리드만
├── 병원 B (clinic_id: 2)
└── 병원 C (clinic_id: 3)
```

### 역할 기반 접근 (4단계)
| 역할 | 권한 |
|------|------|
| `superadmin` | 전체 병원 접근, 병원/계정 관리, `?clinic_id=X`로 특정 병원 조회 |
| `agency_staff` | 다중 병원 배정(`user_clinic_assignments`), 계정별 메뉴 권한(`user_menu_permissions`), `?clinic_id=X`로 배정된 병원만 조회 |
| `clinic_admin` | 자신의 병원 전체 데이터, KPI/광고/콘텐츠, 담당자 계정 관리 |
| `clinic_staff` | 예약/결제, 고객(CDP), 캠페인 리드, 챗봇만 접근 (광고/KPI 차단) |

### 데이터 흐름
```
외부 API (Google/Meta/TikTok/YouTube/Instagram)
    ↓ lib/services/* (동기화 함수)
    ↓ app/api/*/route.ts (API 엔드포인트)
    ↓ Supabase Database
    ↓ app/(dashboard)/*/page.tsx (프론트엔드)
```

### 주요 디렉토리
| 디렉토리 | 용도 |
|---------|------|
| `app/(dashboard)/` | 인증된 대시보드 페이지들 (그룹 라우트) |
| `app/api/` | API 라우트 |
| `lib/services/` | 외부 API 동기화 서비스 |
| `lib/` | 유틸리티 모듈 (아래 상세) |
| `components/ui/` | shadcn/ui 컴포넌트 (다크테마 커스텀) |
| `components/common/` | 프로젝트 공용 컴포넌트 |
| `components/charts/` | Recharts 래퍼 (코드 스플리팅) |
| `components/attribution/` | 매출 기여 분석 UI (퍼널, CPL/ROAS, 고객 여정 등) |

### 클라이언트 병원 선택 (ClinicContext)
```typescript
import { useClinic } from '@/components/ClinicContext'

const { selectedClinicId, clinics, setSelectedClinicId } = useClinic()
```
- `ClinicProvider`가 대시보드 레이아웃을 감싸고 있음
- `localStorage` 키 `mmi_selected_clinic`에 선택된 병원 ID 저장
- agency_staff에게 배정된 병원이 1개뿐이면 자동 선택
- `/api/my/clinics`와 `/api/my/menu-permissions`에서 데이터 로드

## 인증 보안

### 로그인 흐름
```
사용자 → NextAuth Credentials → lib/auth.ts authorize()
  ├─ Rate Limit 체크 (lib/rate-limit.ts: IP:username 키, 15분/5회)
  ├─ DB 사용자 조회 + bcrypt 검증
  ├─ 성공/실패 로그 기록 (login_logs 테이블, non-blocking)
  └─ JWT 토큰 발급 (password_version 포함)
```

### 세션 무효화 (password_version)
- `users.password_version` 컬럼 (기본값 1)
- 비밀번호 변경 시 `password_version` 증가
- `getAuthUser()`에서 토큰의 `password_version`과 DB 비교 → 불일치 시 401
- 레거시 토큰(password_version 없음)은 검증 건너뜀

### IP/UA 전달 패턴
`app/api/auth/[...nextauth]/route.ts`에서 `headers()`로 IP/UA 추출 → `setRequestContext()`로 모듈 레벨 변수에 저장 → `authorize()`에서 사용

### 미들웨어 (middleware.ts)
NextAuth 미들웨어로 인증 필수 경로 제어. 인증 불필요 경로: `api/`, `login`, `lp`(랜딩페이지)

## 핵심 유틸리티 모듈

### API 미들웨어 (lib/api-middleware.ts)
```typescript
import { withAuth, withClinicFilter, withClinicAdmin, withSuperAdmin, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'

// 인증만 필요한 경우
export const GET = withAuth(async (req, { user }) => {
  return apiSuccess({ data })
})

// clinic_id 필터링이 필요한 경우 (대부분의 API)
export const GET = withClinicFilter(async (req, { user, clinicId, assignedClinicIds }) => {
  let query = supabase.from('table').select('*')
  // applyClinicFilter: clinicId, assignedClinicIds 자동 처리 (agency_staff 포함)
  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (!filtered) return apiSuccess([]) // agency_staff 배정 병원 0개
  return apiSuccess(data)
})

// clinic_admin 이상 (clinic_staff 차단)
export const GET = withClinicAdmin(async (req, { user, clinicId }) => {
  return apiSuccess(data)
})

// superadmin 전용 API
export const POST = withSuperAdmin(async (req, { user }) => {
  return apiSuccess({ created: true })
})
```

### 로깅 (lib/logger.ts)
```typescript
import { createLogger } from '@/lib/logger'

const logger = createLogger('ServiceName')

logger.debug('디버그 메시지', { context: 'value' })  // 개발환경만
logger.info('정보 로그', { clinicId, action: 'sync' })
logger.warn('경고', { reason: 'rate limit' })
logger.error('에러 발생', error, { userId })
```
- 개발환경: 읽기 쉬운 형식 출력
- 프로덕션: JSON 형식 (로그 수집 도구 호환)

### 외부 API 클라이언트 (lib/api-client.ts)
```typescript
import { fetchJSON, fetchWithRetry } from '@/lib/api-client'

// JSON 응답 처리 (재시도 + 타임아웃 내장)
const result = await fetchJSON<ResponseType>(url, {
  service: 'MetaAds',  // 로깅용
  timeout: 30000,      // 타임아웃 (기본 30초)
  retries: 3,          // 재시도 횟수 (기본 3회)
})

if (result.success) {
  console.log(result.data)
} else {
  console.error(result.error, `시도 횟수: ${result.attempts}`)
}
```
- 429 Too Many Requests: Retry-After 헤더 자동 처리
- Exponential backoff 재시도

### UTM 파라미터 처리 (lib/utm.ts)
```typescript
import { parseUtmFromUrl, sanitizeUtmParams, mergeUtmParams, getUtmSourceLabel } from '@/lib/utm'

// URL에서 UTM 추출
const utmFromUrl = parseUtmFromUrl(inflowUrl)

// sanitize (XSS 방지)
const safeUtm = sanitizeUtmParams(requestBody)

// 병합 (명시적 값 우선)
const finalUtm = mergeUtmParams(explicit, utmFromUrl)

// 표시용 라벨
getUtmSourceLabel('meta')  // → 'Meta'
```

### 보안 헬퍼 (lib/security.ts)
```typescript
import { parseId, sanitizeString, isValidBookingStatus, canModifyBooking } from '@/lib/security'

// ID 파싱
const bookingId = parseId(id)
if (!bookingId) return apiError('유효한 ID가 필요합니다.')

// 상태값 검증
if (!isValidBookingStatus(status)) return apiError('유효하지 않은 상태')

// XSS 방지 sanitize
const safeNotes = sanitizeString(notes, 1000)

// 리소스 소유권 검증
const check = await canModifyBooking(bookingId, user)
if (!check.allowed) return apiError(check.error, 403)
```

## UI 컴포넌트 (요약)

```typescript
// shadcn/ui 기본
import { Button, Card, Badge, Input, Select, Dialog, Table, Skeleton } from '@/components/ui/*'
import { toast } from 'sonner'

// 커스텀 Variants
<Card variant="glass" />      // 글래스모피즘
<Button variant="glass" />    // 글래스 버튼
<Badge variant="meta" />      // 채널별 색상 (meta/google/tiktok/naver/kakao)
<Badge variant="success" />   // 상태별 색상 (success/warning/info)

// 공용 컴포넌트
import { PageHeader, ChannelBadge, StatusBadge, EmptyState } from '@/components/common'

// 차트 (코드 스플리팅 적용)
import { AreaChart, BarChart, PieChart, LineChart, ... } from '@/components/charts'
```

상세 사용법: [docs/COMPONENTS.md](docs/COMPONENTS.md)

### 활동 추적 (lib/activity-log.ts)
```typescript
import { logActivity } from '@/lib/activity-log'

// 데이터 변경 시 활동 로그 기록 (non-blocking, 실패해도 메인 플로우 안 막음)
await logActivity(supabase, {
  userId: user.id,
  clinicId: targetClinicId,
  action: 'booking_create',       // booking_create, booking_status_change, payment_create, lead_status_change 등
  targetTable: 'bookings',
  targetId: booking.id,
  detail: { customer_id: 123, status: 'confirmed' },
})
```
- bookings/payments/consultations/leads에 `created_by`/`updated_by` 컬럼으로 마지막 수정자 추적
- `activity_logs` 테이블에 변경 이력 전체 기록

### 삭제 데이터 보관 (lib/archive.ts)
```typescript
import { archiveBeforeDelete, archiveBulkBeforeDelete } from '@/lib/archive'

// 단일 삭제 전 스냅샷 보관
await archiveBeforeDelete(supabase, { table: 'bookings', recordId: id, deletedBy: user.id, clinicId })

// 벌크 삭제 전 스냅샷 보관
await archiveBulkBeforeDelete(supabase, { table: 'leads', recordIds: ids, deletedBy: user.id, clinicId })
```
- `deleted_records` 테이블에 삭제 전 데이터 전체 JSON 보관
- 데이터 삭제 시 반드시 호출 (감사 추적 + 복구 가능)

### 에러 알림 (lib/error-alert.ts)
```typescript
import { sendErrorAlert } from '@/lib/error-alert'

await sendErrorAlert({ type: 'lead_webhook_fail', message: '에러 상세', clinicId })
```
- 프로덕션 에러 발생 시 관리자에게 SMS 알림 (`ADMIN_ALERT_PHONES` 환경변수)
- 쿨다운 5분, 일일 최대 50건 제한
- 에러 타입: `lead_webhook_fail`, `ad_sync_fail`, `press_sync_fail`, `db_connection_fail`

### 채널 정규화 (lib/channel.ts)
```typescript
import { normalizeChannel } from '@/lib/channel'
normalizeChannel('facebook')  // → 'Meta'
```
- utm_source/platform 값을 canonical 채널명으로 변환 (Meta, Google, TikTok 등)
- `lib/channel-colors.ts`: 채널별 Recharts 색상 코드 (`getChannelColor(channel)`)

### 날짜/시간 유틸 (lib/date.ts)
```typescript
import { formatDate, formatDateTime, formatTime, getKstDateString, getKstDayStartISO, getKstDayEndISO } from '@/lib/date'

// 표시용 포맷 (모두 KST 기준)
formatDate('2026-03-18T15:00:00Z')     // → '2026. 3. 19.'
formatDateTime('2026-03-18T15:00:00Z') // → '3월 19일 00:00'
formatTime('2026-03-18T15:00:00Z')     // → '00:00'

// 서버용 KST 날짜 유틸
getKstDateString()       // → '2026-03-19' (KST 기준 YYYY-MM-DD)
getKstDayStartISO()      // → KST 오늘 00:00의 UTC ISO 문자열
getKstDayEndISO()        // → KST 오늘 23:59:59.999의 UTC ISO 문자열
```
- 모든 날짜 표시에 `timeZone: 'Asia/Seoul'` 명시 (서버/클라이언트 동일 결과)
- 날짜 문자열 생성 시 `toISOString().split('T')[0]` 대신 `getKstDateString()` 사용 필수

### SMS 발송 (lib/solapi.ts)
```typescript
import { sendSmsWithLog } from '@/lib/solapi'

// 발송 + DB 로그 기록, 실패 시 logId 반환하여 QStash 재시도 활용
const { success, logId, error } = await sendSmsWithLog(supabase, {
  to: '010-1234-5678', text: '알림 메시지',
  clinicId: 1, leadId: 123,
})
```
- `sms_send_logs` 테이블에 모든 발송 내역 기록 (status: sent/retrying/failed)
- 실패 시 `/api/qstash/sms-retry`로 자동 재시도 (최대 3회, 3분→5분 간격)
- 병원별 알림 연락처 최대 3개 (`clinics.notify_phones TEXT[]`)

## 데이터베이스 스키마

### 핵심 테이블
| 테이블 | 용도 |
|--------|------|
| `clinics` | 병원 고객사 (notify_phones, notify_enabled) |
| `users` | 로그인 계정 (role: superadmin/clinic_admin/clinic_staff, clinic_id) |
| `customers` | 고객 정보 (phone_number로 식별) |
| `leads` | 리드/문의 (UTM 파라미터, landing_page_id, updated_by) |
| `bookings` | 예약 (created_by, updated_by) |
| `consultations` | 상담 (created_by, updated_by) |
| `payments` | 결제 (created_by) |
| `ad_campaign_stats` | 광고 통계 |
| `clinic_api_configs` | 병원별 광고 API 키 |
| `landing_pages` | 랜딩 페이지 (8자리 랜덤 ID) |
| `lead_raw_logs` | 리드 원본 로그 (유실 방지, 멱등성 키) |
| `sms_send_logs` | SMS 발송 로그 (재시도 추적) |
| `activity_logs` | 활동 이력 (누가 무엇을 변경했는지) |
| `user_clinic_assignments` | agency_staff 다중 병원 배정 |
| `user_menu_permissions` | agency_staff 메뉴 권한 |
| `monitoring_keywords` | 순위 모니터링 키워드 (place/website/smartblock) |
| `monitoring_rankings` | 일별 순위 데이터 (keyword_id + rank_date UNIQUE) |
| `login_logs` | 로그인 시도 이력 (user_id, ip_address, success, failure_reason) |
| `deleted_records` | 삭제 데이터 스냅샷 보관 (감사/복구용) |

### 멀티테넌트 필터링 (필수)
```typescript
// 모든 쿼리에 clinic_id 필터 적용
const clinicId = await getClinicId(req.url)
if (clinicId) query = query.eq('clinic_id', clinicId)

// INSERT 시 clinic_id 포함
await supabase.from('table').insert({ clinic_id: clinicId, ...data })
```

## 환경변수

### 필수
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `CRON_SECRET` (Cron Job 인증)

### 선택 (서비스별)
- 광고 API: `GOOGLE_ADS_*`, `META_*`, `TIKTOK_*`
- 콘텐츠 API: `YOUTUBE_API_KEY`, `KAKAO_REST_API_KEY`
- AI: `ANTHROPIC_API_KEY`
- SMS: `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_NUMBER`
- 메시징: `QSTASH_*`, `KAKAO_*`
- 에러 알림: `ADMIN_ALERT_PHONES` (프로덕션 에러 SMS 수신 번호)

## 환경 분리 운영

### 브랜치 전략
```
main (프로덕션) → Production 배포
  └── develop (개발/스테이징) → Preview 배포
        └── feature/* (기능 개발)
```

| 브랜치 | 용도 | Vercel 환경 |
|--------|------|-------------|
| `main` | 프로덕션 배포 | Production |
| `develop` | 개발/테스트 | Preview |
| `feature/*` | 기능 개발 | Preview (PR 생성 시) |

### Cron Jobs

| 경로 | 스케줄 | 용도 |
|------|--------|------|
| `/api/cron/sync-ads` | 매일 03:00 | 광고 데이터 동기화 |
| `/api/cron/sync-press` | 매일 00:00 | 언론보도 동기화 |

로컬 테스트:
```bash
curl -X POST http://localhost:3000/api/cron/sync-ads -H "Authorization: Bearer $CRON_SECRET"
```

## 주의사항

### 코드 작성 시 필수 체크리스트
1. **멀티테넌트 격리**: 모든 DB 쿼리에 `clinic_id` 필터 적용 확인
2. **역할 검증**: API는 `withSuperAdmin`/`withClinicAdmin`/`withClinicFilter` 래퍼 사용, 페이지는 `useEffect`로 역할 가드 추가
3. **활동 추적**: bookings/payments/consultations/leads 변경 시 `created_by`/`updated_by` + `logActivity()` 호출
4. **보안**: 사용자 입력은 `sanitizeString`, ID는 `parseId`로 검증
5. **타입 안전**: TypeScript strict 모드 준수
6. **인증 타입**: `types/next-auth.d.ts`에서 Session/JWT 타입 확장 시 `password_version` 필드 유지
7. **레이아웃 밸런스**: 아래 "UI 레이아웃 밸런스 규칙" 항목 준수

### UI 레이아웃 밸런스 규칙
같은 그리드 행에 배치되는 카드/차트는 반드시 시각적으로 균형을 맞춰야 한다.

**같은 행 카드 높이 통일**
- 같은 그리드 행의 카드들은 동일한 콘텐츠 높이를 사용
- 차트가 포함된 카드: `ResponsiveContainer height`를 양쪽 카드가 같은 값으로 설정
- 데이터 건수가 다를 경우: `Math.max(좌측.length, 우측.length)` 기준으로 높이 계산
- `items-stretch`로 억지로 늘리지 않음 (하단 빈 여백 발생)

**리스트/범례 제한**
- 차트 범례, 항목 목록 등은 **최대 5~6개**로 제한
- 초과 항목은 "기타"로 합산하거나 "더보기"로 접기
- 범례가 차트보다 길어지면 안 됨

**차트 높이 가이드**
```
카드 내 차트: 160px ~ 360px (데이터 건수에 따라 동적)
수평 바차트: items * 44px + 20px (항목당 44px)
영역/라인 차트: 모바일 180px, 데스크탑 240px
파이/도넛 차트: 160px (고정)
```

**간격 패턴**
```
섹션 간: mb-6 md:mb-8
카드 그리드 gap: gap-2 md:gap-3 (KPI), gap-3 (차트)
카드 내부 패딩: p-4 md:p-5 (기본), p-5 md:p-6 (강조)
```

**StatsCard 높이 정렬**
- `h-full` 클래스로 같은 행의 카드 높이 통일
- subtitle/trend 유무에 관계없이 높이가 맞아야 함

### 페이지 역할 가드 패턴
```typescript
// superadmin 전용 페이지
useEffect(() => {
  if (user && user.role !== 'superadmin') router.replace('/')
}, [user, router])
if (user?.role !== 'superadmin') return null

// clinic_admin 이상 (clinic_staff 차단)
useEffect(() => {
  if (user?.role === 'clinic_staff') router.replace('/patients')
}, [user, router])
```

### 서버 시작 시 환경변수 검증
`instrumentation.ts`에서 서버 시작 시 `lib/env.ts`의 `validateEnv()`를 호출하여 필수 환경변수를 검증. 프로덕션에서 누락 시 서버 시작 실패.

### 테스트 방법
```bash
# 빌드 검증 (타입 에러 검출)
npm run build

# ESLint 검사
npm run lint

# E2E 테스트 (Playwright)
npm run test:e2e           # 전체 실행
npm run test:e2e:headed    # 브라우저 표시
npm run test:e2e:ui        # Playwright UI 모드
npm run test:e2e:report    # 리포트 보기

# 특정 테스트 파일만 실행
npx playwright test e2e/tests/auth.spec.ts
```
- 인증 상태는 `storageState` (`.auth/superadmin.json`)로 관리
- `PLAYWRIGHT_BASE_URL` 환경변수로 테스트 대상 URL 변경 가능
- 테스트 구조: `e2e/fixtures/` (인증 픽스처), `e2e/pages/` (Page Object Model), `e2e/tests/` (스펙)

### 코드 작성 시 추가 참고
8. **삭제 보관**: 데이터 삭제 시 `archiveBeforeDelete()` 호출하여 `deleted_records`에 스냅샷 보관
9. **채널 정규화**: 광고 채널 표시 시 `normalizeChannel()` 사용, 차트 색상은 `getChannelColor()` 사용
10. **KST 타임존**: 날짜 표시는 `lib/date.ts` 포맷 함수 사용, 날짜 문자열 생성은 `getKstDateString()` 사용. `toISOString().split('T')[0]` 금지 (UTC 기준이라 KST 자정~09시 사이 날짜 오류)

### DB 마이그레이션
SQL 마이그레이션 파일은 `supabase/migrations/`에 위치. 파일명은 `YYYYMMDD_설명.sql` 형식.
테스트 시드 데이터: `supabase/seed_test_data.sql`
