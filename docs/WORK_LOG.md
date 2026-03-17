# MMI 프로젝트 작업 로그

## 개요

shadcn/ui 기반 UI/UX 개선 및 기능 개발 작업 기록.
각 Phase별 상세 내용은 하위 파일 참조.

---

## 전체 요약

| 단계 | 기간 | 주요 작업 | 상태 | 상세 |
|------|------|----------|------|------|
| Phase 1: 초기 설정 | ~2026-03-14 | shadcn/ui, 접근성, 번들 최적화, 문서화 (Phase 1~9) | 완료 | [상세](work-log/phase1-setup.md) |
| Phase 2: 핵심 기능 | 2026-03-14~16 | KPI, UTM, 랜딩, 소재, 어드민 분리, 리드 필터 (P2~P12) | 완료 | [상세](work-log/phase2-features.md) |
| Phase 3: 운영 기능 | 2026-03-16~ | 캠페인, 알림, 상태관리, 예약 등록, UTM 개편 (P13~P17) | 완료 | [상세](work-log/phase3-operations.md) |
| Phase 4: 모니터링 + 역할 | 2026-03-16~ | 순위 모니터링, agency_staff 역할, 메뉴 권한 (P18) | 완료 | [상세](work-log/phase4-monitoring.md) |
| E2E 테스트 | 2026-03-16 | Playwright 106개 테스트 | 완료 | [상세](work-log/e2e-tests.md) |
| Phase 5: 대시보드 고도화 | 2026-03-17~ | KPI 재구성, 오늘 요약, 듀얼 차트, 채널 바차트, 퍼널 분리 | 진행 중 | [상세](work-log/phase5-dashboard-overhaul.md) |
| Phase 6: 광고 성과 고도화 | 예정 | 소재 분석, 이상치 알림, 리타겟팅 내보내기, UTM 규칙, 주간 리포트, 멀티터치 어트리뷰션 | 예정 | [향후 작업](#향후-작업-우선순위순) |

---

## 최신 작업 (Phase 5: 대시보드 고도화)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P20 | KST 타임존 전환 | 전체 프로젝트 시간 표기를 UTC → KST(Asia/Seoul) 기준으로 통일. `lib/date.ts`에 KST 유틸 추가, 서비스/API/UI 20개 파일 수정 | 03-18 |
| P19-1 | 공용 인프라 | 채널 색상 유틸(`lib/channel-colors.ts`), StatsCard에 onClick/subtitle/size/icon/subtitleColor props 추가 | 03-17 |
| P19-2A | KPI API 개선 | `today` 오늘 요약(리드/예약/매출 + 전일 대비), `totalConsultations` 필드, comparison에 `totalLeads`/`totalConsultations`/`totalSpend` 추가 | 03-17 |
| P19-2B | 상단 섹션 컴포넌트 | `TodaySummary`(오늘 3카드), `KpiSection`(6카드 비즈니스 흐름순), `SpendLeadTrend`(듀얼 축 ComposedChart) | 03-17 |
| P19-2C | 하단 섹션 컴포넌트 | `ChannelChart`(채널별 바차트), `TreatmentPie`(시술별 매출 파이), `FunnelSection`(퍼널 분리) | 03-17 |

> 상세 구현 계획: [PLAN_dashboard-overhaul.md](plans/PLAN_dashboard-overhaul.md)

---

## Phase 4 작업

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P18 | 순위 모니터링 + agency_staff | DB 4테이블, agency_staff 역할, 메뉴 권한, 순위 CRUD, 월간 테이블+차트 | 03-16 |

## Phase 3 작업

| # | 작업 | 핵심 내용 | 커밋 | 날짜 |
|---|------|----------|------|------|
| P13 | 캠페인별 리드 뷰 | 캠페인 카드 목록 → 리드 상세, 설문 응답 인라인 표시 | 96f7166 | 03-16 |
| P14 | 담당자 SMS 알림 | 솔라피 SMS, 병원별 알림 설정, non-blocking 발송 | 2f51711 | 03-16 |
| P15 | 리드 상태/메모 | 6개 상태 관리, 예약완료 시 bookings 자동 생성, 메모 연동 | 83de85a | 03-16 |
| P16 | 예약 등록 | 예약/결제 페이지에서 직접 등록, 고객 자동 생성 | de204a4 | 03-16 |
| P17 | UTM 페이지 개편 | 목록 + 생성기 모드 분리 | 74760a9 | 03-16 |

---

## DB 마이그레이션 현황

| 파일 | 내용 | 실행 필요 |
|------|------|----------|
| `20240101_add_utm_fields.sql` | leads UTM 필드 추가 | ⚠️ |
| `20240315_utm_templates_links.sql` | utm_templates, utm_links 테이블 | ⚠️ |
| `20260315_landing_pages.sql` | landing_pages 테이블, leads 컬럼 추가 | ⚠️ |
| `20260315_ad_creatives.sql` | ad_creatives 테이블 | ⚠️ |
| `20260315_ad_creatives_utm.sql` | ad_creatives UTM 컬럼 추가 | ⚠️ |
| `20260316_clinic_notify.sql` | clinics 알림 컬럼 추가 | ⚠️ |
| `20260316_lead_status.sql` | leads 상태/타임스탬프 컬럼 추가 | ⚠️ |
| `20260316_lead_notes.sql` | leads 메모 컬럼 추가 | ⚠️ |
| `20260316_landing_pages_random_id.sql` | landing_pages ID 8자리 랜덤으로 변경 | ⚠️ |
| `20260316_leads_landing_page_on_delete.sql` | leads FK ON DELETE SET NULL 추가 | ⚠️ |
| `20260316_lead_raw_logs.sql` | 리드 원본 로그 테이블 (유실 방지) | ⚠️ |
| `20260316_clinic_notify_phones.sql` | 병원 알림 연락처 최대 3개 (TEXT[]) | ⚠️ |
| `20260316_sms_send_logs.sql` | SMS 발송 로그 테이블 | ⚠️ |
| `20260316_clinic_staff_activity.sql` | 활동 추적 컬럼 + activity_logs 테이블 | ⚠️ |
| `20260316_monitoring_agency.sql` | agency_staff 배정/권한 + 모니터링 키워드/순위 테이블 | ⚠️ |

---

## 향후 작업 (우선순위순)

### Phase 6: 광고 성과 고도화

| 순위 | 작업 | 핵심 내용 | 난이도 | 상태 |
|------|------|----------|--------|------|
| 1 | 크리에이티브(소재)별 성과 분석 | `ad_creatives` + `utm_content` 기반 소재별 리드 수/CPL/전환율 대시보드. 어떤 소재가 성과를 내는지 즉시 파악 | 중 | 예정 |
| 2 | 캠페인 성과 이상치 알림 | CPL 목표 초과, CTR 급락 등 이상 징후 자동 감지 → 기존 `sendErrorAlert` SMS 인프라 활용하여 관리자 알림 | 낮 | 예정 |
| 3 | 리타겟팅 오디언스 내보내기 | 리드 상태(부재/보류/거절)·퍼널 이탈 단계별 고객 리스트 CSV 내보내기 → Meta/Google 커스텀 오디언스 업로드용 | 낮 | 예정 |
| 4 | UTM 네이밍 컨벤션 템플릿 | UTM 생성기에 `[Platform]_[Objective]_[Audience]_[Offer]_[Date]` 규칙 템플릿 추가. 캠페인 목적/오디언스 자동 분류 기반 마련 | 낮 | 예정 |
| 5 | 주간 리포트 자동화 | 병원별 주간 성과 요약 자동 생성 (예산 소진율, CPA/ROAS, 상하위 캠페인) → QStash + 카카오 알림톡/이메일 발송 | 중 | 예정 |
| 6 | 멀티터치 어트리뷰션 | First-touch 외 Linear/Time-decay 모델 추가. 기존 `customer-journey` 터치포인트 데이터 활용하여 채널별 정확한 기여도 분석 | 높 | 예정 |

### 기타 개선 항목

| 작업 | 핵심 내용 | 상태 |
|------|----------|------|
| 예약 페이지 유입 경로 | 채널/캠페인 컬럼 추가 | 예정 |
| 단위 테스트 | Jest + React Testing Library | 예정 |
| 성능 모니터링 | Web Vitals 측정 | 예정 |
