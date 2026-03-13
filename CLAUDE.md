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
```

## 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **인증**: NextAuth.js (Credentials Provider, JWT 전략)
- **데이터베이스**: Supabase (PostgreSQL)
- **스타일링**: Tailwind CSS
- **차트**: Recharts
- **작업 큐**: Upstash QStash

## 아키텍처

### 멀티테넌트 구조
```
슈퍼어드민 (Glitzy)
├── 병원 A (clinic_id: 1) ← 병원A 어드민, 광고 API 키, 고객/리드/예약/결제 데이터
├── 병원 B (clinic_id: 2)
└── 병원 C (clinic_id: 3)
```

### 역할 기반 접근
- `superadmin`: 전체 병원 접근, 병원/계정 관리, 병원 선택 스위처 사용 가능
- `clinic_admin`: 담당 병원 데이터만 접근

### 데이터 흐름
```
외부 API (Google/Meta/TikTok/YouTube/Instagram)
    ↓ lib/services/* (동기화 함수)
    ↓ app/api/*/route.ts (API 엔드포인트)
    ↓ Supabase Database
    ↓ app/(dashboard)/*/page.tsx (프론트엔드)
```

### 주요 디렉토리
- `app/(dashboard)/` - 인증된 대시보드 페이지들 (그룹 라우트)
- `app/api/` - API 라우트 (24개 엔드포인트)
- `lib/services/` - 외부 API 동기화 서비스 (Google Ads, Meta, TikTok, YouTube, Instagram, Press)
- `lib/auth.ts` - NextAuth 설정 (bcrypt 인증)
- `lib/session.ts` - 세션 헬퍼 (getClinicId, requireSuperAdmin)
- `components/ClinicContext.tsx` - 병원 선택 상태 Context

### 인증 흐름
1. `app/login/page.tsx` → NextAuth Credentials
2. Supabase `users` 테이블 조회 + bcrypt 검증
3. JWT 토큰에 role, clinic_id 포함
4. `middleware.ts`에서 인증 보호
5. `ClinicContext`로 병원 선택 상태 관리 (localStorage 연동)

### Cron Jobs (vercel.json)
- `/api/cron/sync-ads` - 매일 03:00 광고 데이터 동기화
- `/api/cron/sync-press` - 매일 00:00 언론보도 동기화

## 데이터베이스 스키마

### 핵심 테이블
- `clinics` - 병원 고객사
- `users` - 로그인 계정 (role, clinic_id)
- `customers` - 고객 정보 (clinic_id)
- `leads` - 리드/문의 (clinic_id)
- `bookings` - 예약 (clinic_id)
- `payments` - 결제 (clinic_id)
- `ad_campaign_stats` - 광고 통계 (clinic_id)
- `clinic_api_configs` - 병원별 광고 API 키

### 멀티테넌트 필터링
모든 API에서 세션의 clinic_id 또는 쿼리 파라미터로 데이터 필터링:
```typescript
const clinicId = await getClinicId()
query.eq('clinic_id', clinicId)
```

## 환경변수

필수 환경변수 (.env.local):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `CRON_SECRET` (Cron Job 인증)
- 광고 API: `GOOGLE_ADS_*`, `META_*`, `TIKTOK_*`
- 콘텐츠 API: `YOUTUBE_API_KEY`, `KAKAO_REST_API_KEY`
