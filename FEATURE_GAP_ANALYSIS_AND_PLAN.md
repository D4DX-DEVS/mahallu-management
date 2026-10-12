# Mahallu ERP — Gap Analysis & Implementation Plan

> Source spec: `mahallu-cms/MUSLIM_MAHALLU_MANAGEMENT_ERP_Detailed.md`
> Compared against: `mahallu-api` (Express + TS + Mongoose) and `mahallu-cms` (React 18 + Vite + TS + Tailwind + Zustand).
> Date: 2026-08-12

This document is the single execution plan. Each task is written so a coding model (Sonnet-level) can implement it independently by following the **Global Rules** plus the task's own spec. Do tasks in order within a phase; phases in order A → B → C.

---

## 0. GLOBAL RULES (apply to EVERY task — read before coding anything)

### 0.1 Backend conventions (mahallu-api)

- Stack: Express + TypeScript + Mongoose. Layering: `src/routes/*.ts` → `src/controllers/*.ts` → `src/models/*.ts` (+ `src/services` only for cross-cutting logic like ledger posting or schedulers).
- **Every new model MUST have** `tenantId` (indexed, required) and `timestamps: true`. Follow existing models (`Family.ts`, `Member.ts`) for style.
- Malayalam support: any user-facing name/title field gets a sibling `<field>_ml` optional string (pattern already used: `houseName_ml`, `name_ml`).
- Auth: all routes behind existing `authMiddleware` + `tenantMiddleware` + `tenantFilter`. Roles: `super_admin | mahall | survey | institute | member`. Restrict writes to `mahall` (and `super_admin`) unless the task says otherwise.
- **Pagination is ALWAYS server-side.** Reuse the existing utilities `getPaginationParams()` and `createPaginationResponse()`. Standard list endpoint contract:
  - Request: `GET /api/<module>?page=1&limit=10&search=&status=&sortBy=`
  - Response: `{ success: true, data: [...], pagination: { page, limit, skip, total, totalPages } }`
  - Search uses case-insensitive regex on the module's primary name fields. Never return unbounded lists.
- Soft delete via `status` field where records matter historically (follow Member pattern); hard delete only for pure config rows.
- **Indexes:** besides `tenantId`, every new model gets compound indexes for its hot list queries — at minimum `(tenantId, status)` and `(tenantId, <primary date field>)`. Uniques where stated (e.g. GraveRecord `(tenantId, cemeteryId, graveNo)`, ClassAttendance `(tenantId, classId, date)`, VolunteerProfile `(tenantId, memberId)`).
- **Backward compatibility:** all new fields on existing models (Member, Family, Committee, Tenant, Programs) are optional; old documents without them must remain valid. Frontend must render safely when these fields are `undefined` (no crashes, show "—").
- Add Swagger JSDoc blocks on routes (existing pattern in every route file).
- Register new routes in the main app router file; add model exports where existing models are indexed.
- Log mutations through the existing `ActivityLog` flow (it is middleware-driven — no extra code needed if routes go through the standard stack; verify one create call appears in activity logs).

### 0.2 Frontend conventions (mahallu-cms)

- Structure: `src/features/<domain>/pages/<Page>.tsx`, services in `src/services/<name>Service.ts`, shared UI in `src/components/ui/` (Button, Card, Table, Modal, Pagination, etc. — 23 components exist; REUSE them, do not create parallel ones).
- Forms: `react-hook-form` + `zod` (existing pattern). HTTP: `axios` instance with auth/tenant interceptors (reuse existing api wrapper).
- **SSR pagination on every list page**: state = `currentPage`, `itemsPerPage` (default 10), `debouncedSearch`; fetch with `{ page, limit, search, sortBy }`; render `<Pagination>` component fed by server `pagination` object. NEVER `.slice()` a full array client-side. Copy the pattern from `FamiliesList.tsx`.
- **Every new file ≤ 500 lines.** If a page grows past ~400 lines, split: extract table columns/config, modal subcomponents, or a `use<Module>List.ts` hook into sibling files. This is a hard rule for all new files.
- **Mobile-first responsive.** Base classes target mobile; add `sm:`/`md:`/`lg:`/`xl:` upward. No fixed pixel widths on content containers. Tables wrap in `overflow-x-auto`.
- **Card grid rule (user requirement): minimum 2 cards per row on mobile.** Standard grids:
  - Stat/summary cards: `grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4`
  - Two-column detail cards: `grid grid-cols-2 md:grid-cols-2 gap-3` (collapse to `grid-cols-1` ONLY when card content cannot fit half-width on a 360px screen, e.g. long forms).
  - Card text must scale: `text-xs sm:text-sm` labels, `text-base sm:text-xl` values, so 2-up fits on mobile.
- Menu: add entries in `src/constants/menuItems.ts` with correct `roles` array. Routes go in the route definitions (see Task A0 — App.tsx must be split first).
- Detail/Create/Edit page set per module mirrors existing modules (List → Detail → Create → Edit + optional QuickAdd modal).

### 0.3 Definition of done (every task)

1. Backend: model + routes + controller + Swagger; list endpoint paginated; tenant-scoped; `npm run build` (tsc) passes.
2. Frontend: service + pages + menu entry + route; list page uses server pagination; grids follow 0.2; build passes.
3. Manual check: create → list (paginate) → edit → detail renders on 360px-wide viewport without horizontal page scroll.
4. **Minimal tests (backend):** each task ships one small test file (use existing test setup if the repo has one; otherwise a supertest/jest smoke file) covering: (a) happy-path create+list, (b) tenant isolation — a request with tenant B's token cannot read tenant A's record (expect 403/404/empty), (c) role/permission denial for a restricted route, (d) workflow-transition rejection where the task defines a status machine (e.g. welfare `pending → disbursed` directly must fail).
5. **Execution mode:** run ONE task at a time; verify (build + tests + manual check) before starting the next. Never batch multiple tasks into one autonomous run.

---

## 1. GAP ANALYSIS (spec module → current state)

Legend: ✅ exists, 🟡 partial, ❌ missing. "API"/"CMS" = backend/frontend.

| # | Spec module (§) | API | CMS | Gap summary |
|---|---|---|---|---|
| 1 | Mahallu registration + classification (§3) | 🟡 | 🟡 | Tenant exists; no `classification` (fully_functional / partially_functional / urban_mosque / musalla) field or module gating |
| 2 | Mahallu profile (§4) | ✅ | ✅ | Tenant + Mahall Settings cover it |
| 3 | Dashboard (§6.2) | ✅ | ✅ | Exists; extend later with register counts (Task A3) |
| 4 | Families / Members (§6) | ✅ | ✅ | Solid. Minor field gaps (welfare status, special requirements) — Task A2 |
| 5 | Survey & demographics (§5) | 🟡 | 🟡 | Member fields exist; NO survey snapshot module, locality info, or renewal cycle |
| 6 | Community registers (§7) | ❌ | ❌ | No auto-generated registers (zakat payers/beneficiaries, job seekers, marriageable, volunteers, welfare) |
| 7 | Khutbah mgmt (§8.1) | ❌ | ❌ | Nothing |
| 8 | Imam/Qadhi mgmt (§8.2) | 🟡 | 🟡 | Employee model can hold them; no religious-staff profile (qualifications, service history) |
| 9 | Islamic programs (§8.3) | 🟡 | 🟡 | Programs exist (as Institute type='program'); no class types/audience tagging |
| 10 | Madrasa education (§9) | 🟡 | 🟡 | Institute type='madrasa' only; no students, classes, attendance, exams, results |
| 11 | Academic support / scholarships (§9.2, §13) | ❌ | ❌ | Nothing |
| 12 | Adult Qur'an learning (§10) | ❌ | ❌ | Nothing (folds into education module) |
| 13 | Zakat collection (§11) | ✅ | ✅ | Collection exists |
| 14 | Zakat distribution + beneficiaries (§11) | ❌ | ❌ | No beneficiary DB, verification, distribution, Fitr/Qurbani |
| 15 | Qard Hasan + emergency relief (§12) | ❌ | ❌ | Nothing |
| 16 | Employment & economy (§14) | 🟡 | 🟡 | Institute employees only; no job seekers, employers, vacancies, skills |
| 17 | Library (§15) | ❌ | ❌ | Nothing |
| 18 | Counselling (§16) | ❌ | ❌ | Nothing; needs restricted access |
| 19 | Maslahat / dispute resolution (§17) | ❌ | ❌ | Nothing |
| 20 | Marriage services (§17.1, §21) | 🟡 | 🟡 | Nikah registration + NOC exist; no marriageable directory / proposals |
| 21 | Inheritance tracking (§17.2) | ❌ | ❌ | Nothing |
| 22 | Youth volunteer wing (§18) | ❌ | ❌ | Nothing |
| 23 | Women's forum (§19) | ❌ | ❌ | Nothing (delivered via program/committee tagging + registers) |
| 24 | Health & medical (§20) | 🟡 | 🟡 | Blood group + blood bank report exist; no doctor directory, camps, palliative cases |
| 25 | Community development projects (§22) | ❌ | ❌ | Nothing |
| 26 | Mosque mgmt + maintenance (§24) | 🟡 | 🟡 | Assets + AssetMaintenance exist; no mosque profile (capacity, facilities, staff roles) |
| 27 | Cemetery (§25) | ❌ | ❌ | Death registration exists; no cemetery/grave records |
| 28 | Finance (§26) | ✅ | ✅ | Strong: ledgers, day book, trial balance, balance sheet, petty cash, salary |
| 29 | Clusters (§27) | ❌ | ❌ | Only free-text `area` on Family |
| 30 | Committees (§28) | ✅ | ✅ | Exists incl. meetings/minutes |
| 31 | Committee term mgmt (§29) | ❌ | ❌ | No term dates or expiry notifications |
| 32 | Communication (§30) | 🟡 | 🟡 | Push notifications + WhatsApp varisangya reminders; no announcement broadcast w/ channel selection, no SMS/email |
| 33 | Annual gathering + report (§31) | ❌ | ❌ | Nothing |
| 34 | Development Index (§32) | ❌ | ❌ | Phase C |
| 35 | AI assistant (§33) | ❌ | ❌ | Phase C |
| 36 | Analytics & reports (§34) | 🟡 | 🟡 | Finance reports strong; missing demographic/welfare/education reports |
| 37 | Security & privacy (§35) | 🟡 | 🟡 | JWT, roles, tenant isolation, activity logs exist; no 2FA, no per-module restricted access (needed for counselling/welfare) |
| 38 | Multi-Mahallu (§36) | ✅ | ✅ | Tenant architecture already multi-org |

Also flagged: **`mahallu-cms/src/App.tsx` is 1,548 lines** (route definitions) — violates the 500-line rule and blocks clean addition of ~15 new modules. Fix first (Task A0).

---

## 2. PHASE A — Foundation & Phase-1 gaps

### Task A0 — Split App.tsx routes (refactor, do FIRST)

**CMS only.** `App.tsx` (1,548 lines) → thin shell (<150 lines).

1. Create `src/routes/` with one file per menu domain: `communityRoutes.tsx`, `financeRoutes.tsx`, `serviceRoutes.tsx`, `adminRoutes.tsx`, `memberRoutes.tsx`, plus `index.tsx` that composes them. Each file exports an array of `<Route>` elements (or route objects) and stays under 500 lines.
2. `App.tsx` keeps providers, layout wrapper, and `<Routes>{...allRoutes}</Routes>`.
3. No behavior change. Verify: app builds, spot-check 5 existing routes (dashboard, families list, a finance report, member portal, login).
   **Route inventory check (mandatory):** before refactor, dump the full route list (grep `path=` in App.tsx → save to a scratch file). After refactor, dump again from `src/routes/*`. Counts and paths must match exactly, including which routes are inside protected/role-gated wrappers. A route refactor silently dropping one route is the main failure mode — this check catches it.
4. All later tasks add routes to the appropriate `src/routes/*.tsx` file, never to App.tsx.

Also split `NOCList.tsx` (575), `VarisangyaList.tsx` (567), `AssetDetail.tsx` (529), `MahallMain.tsx` (528): extract PDF helpers / modal subcomponents / config into sibling files until each is <500 lines. Behavior unchanged.

### Task A1 — Mahallu classification & module gating

**API:** add to Tenant model: `classification: 'fully_functional' | 'partially_functional' | 'urban_mosque' | 'musalla'` (default `fully_functional`). Expose in tenant CRUD.
**Gating is configurable, not hard-coded** (spec §3 says "appropriate modules for other categories", not "remove modules"). Tenant already has a `features` map — reuse it: classification only sets the DEFAULT feature set on tenant create/update (`fully_functional` = all on; `partially_functional` = all on, admin trims; `urban_mosque` default = mosque/programs/members/finance/communication on, family-survey-welfare-education off; `musalla` default = minimal). Super admin can toggle any feature per tenant regardless of classification.
**CMS:** classification select in Tenants Management (super_admin) + feature toggles list; read-only badge in Mahall Settings. Store `features` in authStore tenant object; helper `isModuleEnabled(moduleKey)` reads it; use it to filter `menuItems` and guard routes.

### Task A2 — Member/Family field extensions (feeds registers & welfare)

**API:** extend `Member`: `occupation` (string), `occupationSector` (enum: government|private|self_employed|abroad|unemployed|student|homemaker|retired|none), `monthlyIncomeRange` (enum: none|below_10k|10k_25k|25k_50k|above_50k), `skills` (string[]), `isJobSeeker` (bool), `isZakatPayer` (bool), `isZakatEligible` (bool), `isWidow` (bool), `hasDisability` (bool), `disabilityDetails` (string), `isMarriageable` (bool), `isVolunteer` (bool), `volunteerSkills` (string[]). Extend `Family`: `economicStatus` (enum: stable|struggling|needs_assistance), `welfareStatus` (enum: none|receiving|applied|needs_review), `specialRequirements` (string), `housingType` (enum: own|rented|shared|none).
All optional — no migration needed (Mongoose adds on write).
**Flag semantics:** these are candidate/registration flags maintained by admins — NOT verified statuses. Final zakat eligibility comes from B1 verification; volunteer status from B5 profile. Derivable flags get assists, not automation: when `maritalStatus` is set to widowed on a female member, default `isWidow=true` (editable); warn (don't block) when `isJobSeeker=true` while `occupationSector` is an employed value.
**CMS:** add these fields to Member and Family Create/Edit forms in a new collapsible "Socio-economic details" section (mobile-first, `grid grid-cols-1 md:grid-cols-2 gap-4` for form inputs), and to Detail pages as info cards (`grid grid-cols-2 md:grid-cols-3 gap-3`).

### Task A3 — Community Registers (§7) — derived, no new collections

**API:** new route group `/api/registers` with paginated GET endpoints, each a filtered Member/Family query (reuse pagination utils):
- `/zakat-payers` (isZakatPayer), `/zakat-beneficiaries` (isZakatEligible), `/job-seekers` (isJobSeeker), `/skilled-workers` (skills non-empty), `/students` (occupationSector=student or education-based), `/marriageable` (isMarriageable, gender filter param), `/volunteers` (isVolunteer), `/welfare` (family welfareStatus/economicStatus filters + isWidow/isOrphan/hasDisability member filters), `/widows`, `/elderly` (age >= 60, param overridable), `/unemployed` (occupationSector=unemployed).
- Plus `/summary` returning counts of each register (single aggregate) for dashboard cards.
**CMS:** new feature `src/features/registers/` with ONE generic `RegisterList.tsx` page (config-driven: title, endpoint, columns) + a `registerConfigs.ts`; routes `/registers/:key`. Menu: "Community → Registers" submenu listing all registers. Dashboard: add "Registers" stat card row using `/summary` (`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3`).

### Task A4 — Survey & Demographics module (§5)

**API:** two models.
- `SurveySnapshot`: tenantId, surveyDate, type (`comprehensive|annual`), nextReviewDate (auto: +4y for comprehensive, +1y for annual), stats object (totalHouseholds, totalPopulation, men, women, children, youth, seniorCitizens, students, married, unmarried, employed, unemployed, widows, orphans, disabled, familiesNeedingAssistance — all numbers), notes, createdBy. Endpoint `POST /api/surveys/generate` computes all stats from live Family/Member aggregates and saves a snapshot; `GET /api/surveys` paginated list; `GET /api/surveys/:id`.
- `LocalityFacility`: tenantId, name, name_ml, type (enum: school|college|hospital|religious_institution|public_institution|library|organization|public_space|business|other), address, contactNo, notes, status. Full CRUD `/api/locality-facilities`.
**CMS:** feature `src/features/survey/`: `SurveyList.tsx` (snapshots, paginated), `SurveyDetail.tsx` (stat cards `grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3`, comparison vs previous snapshot), "Generate Survey" button (confirm modal), `FacilitiesList/Create/Edit`. Dashboard warning card when latest snapshot's `nextReviewDate` is past ("Survey renewal overdue") — this implements the §5.3 renewal cycle, not just history. Menu: "Community → Survey & Demographics".

### Task A5 — Welfare module (§7.6, §12.2 basic, §21.2)

**API:** models:
- `WelfareScheme`: tenantId, name, name_ml, category (enum: medical|housing|education|livelihood|food|marriage_assistance|emergency|other), description, budgetAmount, status (active|closed).
- `WelfareApplication`: tenantId, schemeId, familyId, memberId (optional), requestedAmount, reason, priority (low|medium|high|urgent), status (`pending|verified|approved|rejected|disbursed|closed`), verificationNotes, approvedAmount, disbursedDate, disbursedVia (cash|bank|ledger), ledgerItemId (optional link when disbursed through finance), createdBy.
- Status transitions via `PUT /api/welfare/applications/:id/status` (validate allowed transitions: pending→verified→approved→disbursed→closed, any→rejected).
- On `disbursed` with `disbursedVia='ledger'`, create a LedgerItem (source: `welfare`) via existing ledger service pattern.
- CRUD + paginated lists: `/api/welfare/schemes`, `/api/welfare/applications` (filters: schemeId, status, priority).
**CMS:** feature `src/features/welfare/`: SchemesList/Create/Edit, ApplicationsList (status filter tabs), ApplicationDetail (timeline of status changes, action buttons per role), ApplicationCreate (family/member picker — reuse QuickAdd pickers). Summary cards on ApplicationsList: total/pending/approved/disbursed (`grid grid-cols-2 sm:grid-cols-4 gap-3`). Menu: "Services → Welfare". Roles: `mahall` full, `survey` create+view only.

### Task A6 — Mosque profile & maintenance (§24)

**API:** model `MosqueProfile` (one per tenant, upsert): tenantId (unique), capacity, facilities (string[] from fixed options: parking|wudu_area|women_prayer_area|ac|library|madrasa_hall|janazah_facility|other), prayerFacilities notes, imamName/imamMemberId, muazzinName, khateebName, staffNotes. Endpoints: `GET/PUT /api/mosque-profile`. Maintenance reuses existing Asset + AssetMaintenance (no new model) — ensure category filter `building` works.
**CMS:** feature `src/features/mosque/`: single `MosqueProfile.tsx` page (view + edit mode), facility chips as cards `grid grid-cols-2 sm:grid-cols-3 gap-3`. Link "Maintenance" button → existing Assets list filtered. Menu: "Community → Mosque".

### Task A7 — Clusters (§27)

**API:** model `Cluster`: tenantId, name, code, coordinatorMemberId, teamMemberIds (max 3, ref Member), notes, status. Add `clusterId` (optional ref) to Family. Endpoints: CRUD `/api/clusters`; `GET /api/clusters/:id/families` (paginated); `PUT /api/families/:id` accepts clusterId; bulk assign `POST /api/clusters/:id/assign-families` (body: familyIds[]).
- `ClusterVisit`: tenantId, clusterId, familyId, visitDate, visitedBy, notes, issuesFound, followUpNeeded (bool). CRUD + paginated list `/api/cluster-visits?clusterId=`.
**CMS:** feature `src/features/clusters/`: ClustersList (card grid `grid grid-cols-2 lg:grid-cols-3 gap-3` showing name, coordinator, family count), ClusterDetail (families table paginated, visits tab, assign-families modal with checkbox list + search), VisitCreate modal. Menu: "Community → Clusters". Roles: mahall + survey.

### Task A8 — Committee terms & expiry notifications (§29)

**API:** extend Committee: `termStartDate`, `termEndDate`, `maxTermYears` (default 3). Daily cron (reuse existing scheduler service pattern from varisangya reminders): committees with termEndDate within 60 days → create Notification for tenant admins ("Committee term ending"). Endpoint filter `GET /api/committees?expiring=true`.
**CMS:** term dates in Committee Create/Edit; badge on CommitteesList ("Term ends <date>", red if <60 days); dashboard alert card if any expiring.

### Task A9 — Communication / Announcements (§30)

**API:** model `Announcement`: tenantId, title, title_ml, body, category (enum: announcement|program|emergency|welfare|education|news), audience (enum: all|families|committee|cluster|custom), audienceRefIds (ObjectId[]), channels (subset of: push|whatsapp|sms|email — only `push` + `whatsapp` actually send now, others stored for future), sentAt, status (draft|sent), createdBy. `POST /api/announcements/:id/send` fans out via existing OneSignal + WhatsApp scheduler services; SMS/email branches left as TODO stubs returning `not_configured`.
**CMS:** feature `src/features/communication/`: AnnouncementsList (paginated, status chips), AnnouncementCreate (audience picker, channel checkboxes), AnnouncementDetail. Menu: "Services → Announcements". Existing Notifications pages stay; announcements are the broadcast layer.

**Phase A report additions (§34.1):** extend `/api/reports` with `GET /demographics` (age-group/education/employment aggregates) and matching CMS report page under Reports menu (Recharts + stat cards 2-up mobile).

---

## 3. PHASE B — Community Service modules (spec Phase 2)

### Task B1 — Zakat beneficiaries & distribution (§11)

**API:**
- `ZakatBeneficiary`: tenantId, memberId/familyId, category (enum: fakir|miskin|amil|muallaf|riqab|gharim|fisabilillah|ibnussabil|other), verificationStatus (pending|verified|rejected), verifiedBy, verifiedDate, notes, priorityArea (enum: medical|housing|education|livelihood|living_expenses), status (active|inactive).
- `ZakatDistribution`: tenantId, beneficiaryId, amount, distributionDate, type (enum: `regular|monthly|fitr|qurbani`), paymentMethod, receiptNo, remarks, createdBy. On create, optionally post LedgerItem (source `zakat_distribution`).
- Paginated CRUD for both; `GET /api/zakat/summary` (collected [existing Zakat model] vs distributed totals, per year).
- Member `isZakatEligible` (A2) is only a CANDIDATE flag feeding the register; actual eligibility = ZakatBeneficiary with `verificationStatus='verified'`. Distributions only allowed against verified beneficiaries (validate on create).
**CMS:** new `src/features/zakat/`: BeneficiariesList (verification status tabs), BeneficiaryCreate (member picker), DistributionsList/Create, ZakatSummary page (cards: collected/distributed/balance/beneficiary count — `grid grid-cols-2 sm:grid-cols-4 gap-3`). Menu: "Services → Zakat" (move existing Zakat collection page under it).

### Task B2 — Qard Hasan & Emergency Relief (§12)

**API:**
- `QardLoan`: tenantId, applicantMemberId, familyId, amount, purpose (enum: medical|education|housing|business|marriage|other), appliedDate, status (`applied|under_review|approved|rejected|disbursed|repaying|closed|defaulted`), approvedAmount, approvedBy, disbursedDate, repaymentMonths, monthlyInstallment, outstandingBalance, notes, **repaymentSchedule: [{ dueDate, amount, paidAmount (default 0), status (`due|partial|paid|overdue`) }]** — generated automatically on `disbursed` (approvedAmount ÷ repaymentMonths, monthly due dates from disbursedDate).
- `QardRepayment`: tenantId, loanId, amount, paymentDate, receiptNo, remarks. On create: apply amount to oldest unpaid installments in `repaymentSchedule` (fill paidAmount, update installment status), decrement loan.outstandingBalance; auto-set loan status `closed` when balance hits 0. A daily job (or on-read check) marks past-due unpaid installments `overdue`.
- `ReliefCase`: tenantId, familyId/memberId, description, urgency (low|medium|high|critical), status (`reported|verified|approved|assisted|closed`), assistanceGiven, amount, followUpDate, notes.
- Paginated CRUD; `GET /api/qard/summary` (total disbursed, outstanding, active loans).
- Validation: repayment amount ≤ outstandingBalance; approvedAmount ≤ requested amount unless override flag.
**CMS:** feature `src/features/loans/`: LoansList (status tabs), LoanDetail (repayment schedule table + repayment history + "Add repayment" modal), LoanCreate, ReliefList/Create/Detail. Summary cards 2-up mobile. Menu: "Services → Qard Hasan" and "Services → Emergency Relief". Restrict to `mahall` role.

### Task B3 — Education / Madrasa system (§9, §10, §13)

Largest new module — split into 3 sub-tasks, each independently shippable.

**B3.1 Students & classes. API:** `MadrasaClass`: tenantId, instituteId (ref, type madrasa), name, name_ml, academicYear, classType (enum: `weekend_madrasa|tuition|adult_quran|remedial|other`), teacherEmployeeId, subjects (string[]), schedule (string), status. `StudentEnrollment`: tenantId, classId, memberId, rollNo, enrollDate, status (active|completed|dropped). Paginated CRUD both; `GET /api/madrasa-classes/:id/students`.
**CMS:** feature `src/features/education/`: ClassesList (card grid 2-up mobile: name, teacher, student count), ClassDetail (students tab), ClassCreate/Edit, EnrollStudent modal (member picker). Menu: "Services → Education".

**B3.2 Attendance & exams. API:** `ClassAttendance`: tenantId, classId, date, records: [{ enrollmentId, present: bool }], markedBy. One doc per class per date (unique compound index). `Exam`: tenantId, classId, name, examDate, maxMarks, results: [{ enrollmentId, marks, grade }]. Endpoints: `POST /api/class-attendance` (upsert by class+date), `GET /api/class-attendance?classId&month`, Exam CRUD + results update.
**CMS:** AttendanceSheet page (date picker + student checklist — mobile: full-width rows with toggle), ExamsList/ExamDetail (results entry table), student progress section on ClassDetail (attendance % + exam averages).

**B3.3 Scholarships & academic support (§13). API:** `Scholarship`: tenantId, name, amount, academicYear, criteria, status. `ScholarshipAward`: tenantId, scholarshipId, memberId, awardedDate, amount, status (applied|approved|paid), remarks. Plus ONE lightweight model covering the rest of §9.2/§13 (career guidance, competitive-exam mentoring, dropout prevention, academic awards): `AcademicSupportCase`: tenantId, memberId, type (enum: `career_guidance|competitive_exam|dropout_risk|tuition|remedial|academic_award`), description, mentorName, startDate, status (`open|in_progress|resolved|closed`), outcome, notes. Paginated CRUD all three.
**CMS:** ScholarshipsList/Create, AwardsList (per scholarship), AwardCreate (student picker from education register), AcademicSupportList (type filter tabs)/Create/Detail. Education report page (§34.3): students count, attendance %, results summary, scholarships, support cases — stat cards + Recharts.

### Task B4 — Employment & Economy (§14)

**API:** derived register from A2 covers job seekers/skills. Add:
- `Employer`: tenantId, name, businessType, contactPerson, contactNo, location, memberId (optional — employer who is a member), notes, status. (§14.1 lists employers as a register entity, not a string.)
- `JobVacancy`: tenantId, employerId (ref Employer; optional free-text employerName fallback for one-off posts), title, location, skillsRequired (string[]), salaryRange, status (open|filled|closed), postedDate, description.
- `SkillTraining`: tenantId, name, trainerName, startDate, endDate, participants: [{ memberId, certificateIssued: bool, employmentOutcome: enum(none|employed|self_employed) }], status.
- Paginated CRUD; `GET /api/employment/summary`.
**CMS:** feature `src/features/employment/`: VacanciesList/Create/Detail, TrainingsList/Create/Detail (participants tab with add-member modal), summary cards. Job Seekers register already at `/registers/job-seekers` — link from menu. Menu: "Services → Employment".

### Task B5 — Volunteer wing (§18) & Women/Youth (§19, §23)

**API:** `VolunteerProfile`: tenantId, memberId (unique per tenant), wings (subset: `youth|women|general`), serviceTypes (subset: janazah|grave_digging|patient_transport|palliative|emergency|first_aid|disaster|environment|govt_scheme_support|medical|other), availability (enum: anytime|weekends|emergency_only), notes, status. `VolunteerAssignment`: tenantId, volunteerIds[], serviceType, date, description, status (assigned|completed|cancelled), completionNotes. Paginated CRUD; filter by wing/serviceType.
**CMS:** feature `src/features/volunteers/`: VolunteersList (wing filter tabs: All/Youth/Women), VolunteerCreate (member picker + service type checkboxes as chips `grid grid-cols-2 sm:grid-cols-3 gap-2`), AssignmentsList/Create, service history on volunteer detail. Menu: "Services → Volunteers". Women's forum & youth wing are CROSS-MODULE, not standalone CRUD domains — delivered by: wing-filtered volunteer views (here), their committees (existing), audience-tagged programs (B7), women/youth class types & enrollments (B3), women-audience health camps (B6), and counselling categories (B8). Do not claim §18/§19 complete until those tagged views exist in each of those modules.

### Task B6 — Health & Medical (§20)

**API:** `HealthResource`: tenantId, type (enum: `doctor|blood_donor|palliative_case|patient_support|elderly_care`), memberId (optional), name, specialty/bloodGroup (conditional), contactNo, availability, notes, status. `MedicalCamp`: tenantId, name, campDate, location, organizer, attendeeCount, notes, status. Paginated CRUD; blood donors can also derive from Member.bloodGroup (keep existing blood-bank report; HealthResource covers non-member donors + doctors).
**CMS:** feature `src/features/health/`: DoctorsDirectory, BloodDonors (merge report + resources), PalliativeCases + PatientSupport (restricted — behind the B8 sensitive-module permission `health`, not just role), CampsList/Create. Doctors card grid 2-up mobile. Menu: "Services → Health". API: `palliative_case` and `patient_support` types route through `sensitiveAccess('health')` middleware (B8); doctor/blood_donor/camps stay role-gated only.

### Task B7 — Khutbah & Imam management (§8)

**API:** `Khateeb`: tenantId, name, name_ml, memberId (optional), qualifications, contactNo, status. `Khutbah`: tenantId, khateebId, date (Friday), topic, topic_ml, notes, resourceUrl (S3 upload reuse), status (scheduled|delivered|cancelled). Religious staff — SKIP new model, but Employee requires an `instituteId`; **architectural decision (do not improvise): add `mosque` to the Institute `type` enum, auto-create one "Mosque" institute per tenant (seed on first use), and record imam/muazzin/qadhi as Employees of it with those designation values.** Salary + service history then come free via existing Employee + SalaryPayment; MosqueProfile (A6) links to these employee/member ids. Paginated CRUD; `GET /api/khutbahs?upcoming=true`.
**CMS:** feature `src/features/religious/`: KhutbahSchedule (list by month, upcoming card first), KhutbahCreate/Edit, KhateebsList/Create. Menu: "Services → Religious Services". Islamic programs (§8.3): add `audience` (enum: all|men|women|youth|children|families) + `programType` (quran_class|hadith|fiqh|lecture|family|other) fields to existing Programs — filter chips on ProgramsList.

### Task B8 — Counselling & Maslahat (§16, §17) — RESTRICTED ACCESS

**API:** permission gate first — per-module, NOT a single boolean: add `sensitiveModules: string[]` to User permissions object (allowed values: `counselling|maslahat|inheritance|health|welfare`). New middleware factory `sensitiveAccess(moduleKey)` — 403 unless `user.permissions.sensitiveModules` includes that key or super_admin. One boolean would over-grant: counselling access must not imply inheritance or health access. Models:
- `CounsellingCase`: tenantId, caseNo (auto), category (enum: marriage|family|adolescent|education|parenting|behaviour|career), clientMemberId (optional — allow anonymous name string), counsellorName, appointmentDate, status (`open|in_progress|follow_up|closed`), sessionNotes: [{ date, note, addedBy }], closureNotes.
- `DisputeCase` (Maslahat): tenantId, caseNo, type (enum: family|marriage|divorce|community|inheritance|other), parties (string[]), description, mediators (string[]), status (`registered|mediation|resolved|referred|closed`), resolutionNotes, referredTo.
- `InheritanceCase` (§17.2): tenantId, deceasedMemberId/name, deathRegistrationId (optional ref), heirs: [{ name, relation, contactNo }], status (`reported|documentation|referred|distributed|closed`), referredScholar, notes. (System tracks only — no rulings, per spec boundary.)
- Routes: counselling behind `sensitiveAccess('counselling')`, disputes behind `sensitiveAccess('maslahat')`, inheritance behind `sensitiveAccess('inheritance')`. ActivityLog covers access history.
**CMS:** feature `src/features/counselling/`: CasesList (category filter), CaseDetail (session notes timeline, add-note form), CaseCreate; DisputesList/Detail/Create; InheritanceList/Detail/Create. Menu items visible per-module via `user.permissions.sensitiveModules` (extend menu roles logic). User management: "Sensitive modules" multi-checkbox in user edit (mahall admin grants). Menu: "Services → Counselling", "Services → Maslahat".

### Task B9 — Marriage services (§17.1, §21)

**API:** marriageable directory = register (A3) from `isMarriageable`. Add `MarriageAssistance`: tenantId, memberId/familyId, type (enum: proposal_support|financial_assistance|premarital_counselling), amount (optional), status (requested|approved|completed), notes. Paginated CRUD. Nikah registration already exists.
**CMS:** MarriageAssistanceList/Create under `src/features/registrations/`; link marriageable register; premarital counselling entries link out to CounsellingCase creation (button, no coupling). Menu: under existing Registrations group.

### Task B10 — Cemetery (§25)

**API:** `Cemetery`: tenantId, name, location, capacity, notes, status. `GraveRecord`: tenantId, cemeteryId, graveNo, deceasedMemberId (optional), deceasedName, dateOfDeath, burialDate, familyId (optional), rowLabel, notes. Unique index (tenantId, cemeteryId, graveNo). Link from DeathRegistration: optional `graveRecordId`. Paginated CRUD; search by deceasedName/graveNo. Interactive map = future per spec — store `rowLabel`/`graveNo` only.
**CMS:** feature `src/features/cemetery/`: CemeteriesList (cards 2-up: name, capacity, used count), CemeteryDetail (graves table paginated + search), GraveCreate/Edit (deceased picker from death registrations). Menu: "Services → Cemetery".

### Task B11 — Library (§15)

**API:** `LibraryBook`: tenantId, title, title_ml, author, category (enum: quran|hadith|fiqh|history|children|women|youth|general), **resourceType (enum: `physical|digital`, default physical), resourceUrl (required when digital — S3 upload or external link)**, isbn, copies, availableCopies (both n/a for digital), status. Digital resources skip the issue/return flow — always available. `BookIssue`: tenantId, bookId, memberId, issueDate, dueDate, returnDate, status (issued|returned|overdue). Issue decrements availableCopies (reject if 0); return increments. Paginated CRUD; `GET /api/library/issues?status=overdue`.
**CMS:** feature `src/features/library/`: BooksList (category filter, availability badge), BookCreate/Edit, IssuesList (overdue tab), IssueCreate modal (book + member pickers), reading history via member filter on issues. Menu: "Services → Library".
**B11.1 Bulk import (implemented):** `POST /api/library-books/bulk-import` accepts `{ books: [...] }` (max 500 rows); CMS "Import CSV" button on BooksList opens BulkImportBooks modal — CSV parsed client-side (columns: title, author, category, copies, isbn; only title required, unknown category → general), template download included.

### Task B12 — Community development projects (§22)

**API:** `DevelopmentProject`: tenantId, name, name_ml, area (enum: roads|water|sanitation|environment|education|healthcare|public_facility|govt_scheme|infrastructure|other), proposal, estimatedCost, fundingSource, responsibleTeam (string / committeeId optional), startDate, targetDate, progressPercent (0–100), status (`proposed|approved|in_progress|completed|dropped`), completionReport. Expenditure is NOT a manually typed number: add `projectId` (optional ref) to LedgerItem; project expenditure = sum of linked ledger items (aggregate endpoint `GET /api/development-projects/:id/expenditure`), so project spend stays auditable through the existing accounting system. Paginated CRUD.
**CMS:** feature `src/features/development/`: ProjectsList (cards 2-up mobile: name, area badge, progress bar, cost), ProjectDetail (progress update form, expenditure log), ProjectCreate/Edit. Menu: "Community → Development Projects".

**Phase B report additions (§34.2/.3/.5):** `/api/reports/welfare` (beneficiaries, assistance totals, pending), `/api/reports/community` (programs, volunteers, projects) + CMS pages under Reports.

---

## 4. PHASE C — Smart platform (spec Phase 3)

### Task C1 — Annual "State of the Mahallu" report (§31.2)

**API:** `GET /api/reports/annual?year=` — single aggregation endpoint combining: demographics (survey snapshot or live), finance (income/expense totals from ledger), welfare (applications/disbursed), zakat (collected/distributed), education (students/results), employment, programs count, projects. Returns one JSON document.
**CMS:** AnnualReport page: sectioned stat cards (2-up mobile) + Recharts + "Download PDF" via existing jspdf pattern. Menu: Reports → Annual Report.

### Task C2 — Mahallu Development Index (§32)

**API:** `GET /api/development-index` — computes 12 dimension scores (0–100) from existing data with simple transparent formulas (e.g. FamilyData = % families updated in last 12 months; Welfare = % flagged families with a welfare application; Education = enrollment ÷ student-age members; Finance = months with closed day-book ÷ 12). Store formula constants in one config file. Returns `{ dimensions: [{ key, label, score, indicators }], totalScore }`. Optional quarterly `IndexSnapshot` model via cron.
**CMS:** DevelopmentIndex page: radar chart (Recharts) + dimension cards (2-up mobile, score + weakest-indicator hint). Menu: Reports → Development Index.

### Task C3 — Annual gathering / events (§31.1)

Extend Programs: `eventDate`, `registrations: [{ memberId, attended: bool }]`, `competitions: [{ name, winners: string[] }]`, `awards`. Registration + attendance endpoints; CMS event detail with registration list (paginated) and attendance toggle. SKIP separate module — Programs already covers 80%.

### Task C4 — AI assistant (§33)

**API:** `POST /api/assistant/query` → LLM via env config (`AI_PROVIDER`, `AI_MODEL` — e.g. anthropic / claude-sonnet-5; never hard-code the model in code) with tool-use over a whitelisted set of read-only aggregate endpoints (registers summary, finance summary, welfare, education). Enforce: tools execute with the requesting user's role/tenant filters (authorization requirement §33.1); never raw collection access. Log queries to ActivityLog.
**CMS:** chat panel page (mahall + super_admin only), message list + input.
*Prereq: API key config per deployment. Scope = Q&A over aggregates; report generation = call C1 endpoint.*

### Task C5 — Security hardening (§35)

- 2FA: extend existing OTP flow — optional `twoFactorEnabled` on User; login requires OTP verify when enabled.
- Access history page (CMS) over existing ActivityLog filtered by userId.
- Backup & disaster recovery (§35): mongodump cron + S3 upload, AND a documented, tested restore procedure (run one restore drill against a scratch DB — backup without verified restore is not backup). Ops runbook file in repo.
- Encryption: TLS in transit (deployment), MongoDB encryption at rest via hosting provider setting (document it); field-level encryption only if a compliance need appears (YAGNI now).
- Verify sensitive modules (B8 counselling/maslahat/inheritance, welfare, health palliative) all pass their `sensitiveAccess(module)` or role checks — write the denial tests from DoD item 4 for each.

Multi-Mahallu aggregation (§36): tenant architecture already supports it; district/state dashboards = super_admin report over anonymized aggregates — defer until >1 real Mahallu network exists (YAGNI).

---

## 5. EXECUTION ORDER & SIZING

| Order | Task | Size | Notes |
|---|---|---|---|
| 1 | A0 route split + oversize refactor | M | Unblocks everything |
| 2 | A1 classification | S | |
| 3 | A8 committee terms | S | Small + independent — do early |
| 4 | A2 member/family fields | M | Feeds A3, B1, B4, B5, B9 |
| 5 | A3 registers | M | High value, low cost (derived) |
| 6 | A4 survey | M | |
| 7 | A7 clusters | M | Before welfare — welfare can use cluster→family links |
| 8 | A5 welfare | L | |
| 9 | A6 mosque profile | S | |
| 10 | A9 announcements | M | |
| 11 | B1 zakat distribution | M | |
| 12 | B2 qard hasan + relief | L | |
| 13 | B3.1→B3.3 education | XL | 3 shippable slices |
| 14 | B4 employment | M | |
| 15 | B5 volunteers | M | |
| 16 | B6 health | M | |
| 17 | B7 khutbah | S | |
| 18 | B8 counselling/maslahat | L | Needs sensitive-access gate |
| 19 | B9 marriage assistance | S | |
| 20 | B10 cemetery | M | |
| 21 | B11 library | M | |
| 22 | B12 development projects | M | |
| 23 | C1 annual report | M | |
| 24 | C2 development index | M | |
| 25 | C3 events extension | S | |
| 26 | C4 AI assistant | L | |
| 27 | C5 security hardening | M | |

Sizes are RELATIVE effort ranking, not delivery promises — B3, B8, and B2 in particular will run long once tests and permission work are included. Execute one task per run with a verify checkpoint (build + tests + manual check) between tasks; never hand the whole table to an agent as a single autonomous job.

---

## 6. NOTES / DELIBERATE SKIPS

- Women's forum & youth wing: delivered as wing tags + filtered views + committees + program audiences, not standalone modules (spec content is organizational; data model identical).
- Cemetery interactive map, SMS/email channels, government-scheme integration, predictive insights, multi-Mahallu district dashboards: explicitly future in spec — enums/stubs reserved, no build now.
- Social harmony programs (§23): covered by Programs + Announcements categories — no new module.
- Imam/Qadhi salary & service history: existing Employee + SalaryPayment models — only designation values needed (B7).
