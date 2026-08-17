# Family Portal — Build Plan

**Date:** 2026-08-17
**Basis:** Code-verified gap analysis (`FRD_VERIFICATION_AND_GAP_ANALYSIS.md`) + fresh code checks this session.
**Question answered:** "Member is each member, not family head — so are we making 2 setups?"

---

## 0. Decision: ONE portal, NOT two setups

GPT recommends a separate Family Head account/role and a separate Family Head portal. **Recommendation: don't.** Simpler and more user-friendly:

- **Family Head is not a new role or new account.** It is the *same* Member login with extra capabilities when the logged-in member is the family's head.
- One app, one login, one portal. The head sees an extra **"My Family"** management section; ordinary members don't. No second app to build, no person maintaining two accounts, no confusion about "which login do I use."
- Backend check is one line per request: `member._id equals family.headMemberId` → family-scope allowed.

Why GPT's two-portal model is worse:
1. Same person = two accounts → duplicate identity, sync problems, double OTP flows.
2. Two frontends to maintain forever.
3. The permission difference is small (a handful of family-scope endpoints) — a role hierarchy is over-engineering for it.

GPT's own data model actually agrees (head is still a Member record); only its "separate portal/account" packaging is wrong. Keep: **User → memberId → Member → familyId → Family**, which already exists in code (`User.ts:10` has `memberId`).

---

## 1. NEW gaps found this pass (not in the previous report)

These were found by direct code inspection today:

| # | Gap | Evidence | Why it matters |
|---|-----|----------|----------------|
| N1 | **`Family.familyHead` is a free-text NAME string** (`Family.ts:9`, plus `familyHeadMl`), not a Member reference | No `headMemberId` anywhere | The entire Family Head feature has nothing to anchor on. "Is this logged-in member the head?" is currently **unanswerable**. This is the prerequisite for everything else. |
| N2 | **Member has no `relationship` field** (relation to head: spouse/son/daughter/parent…) | grep of `Member.ts` — no relation/guardian field | Needed for: head applying on behalf of a member, wali/guardian in nikah, orphan identification, inheritance later. |
| N3 | **All uploads are `ACL: 'public-read'`** (`uploadService.ts:62`) | DigitalOcean Spaces objects publicly reachable by URL | Fine for banners. **Unacceptable for ID proofs / certificates.** Document subsystem must use private objects + short-lived signed download URLs. |
| N4 | Good news: **`remarks` already exists on all 3 registration models** (`Registration.ts:23,43,64`) | — | The "correction required" flow is cheaper than expected — add one status value, remarks field is already there. |

---

## 2. What we need to build (concrete, in order)

### Phase A — Foundation fixes (small, do first)

**A1. Link the family head properly.**
- Add `headMemberId?: ObjectId` (ref Member) to Family. Keep `familyHead` string for display/backward-compat; backfill where a member of the family name-matches, leave rest for admin to set.
- Admin UI: family edit page gets a "Select head" dropdown of that family's members.
- JWT/`GET /member-user/overview` returns `isFamilyHead: true/false`.

**A2. Add `relationship` to Member.**
- Enum: `head | spouse | son | daughter | father | mother | other`. Optional, admin-editable, surveyable.

**A3. Registrations: applicant vs subject.**
- Add `applicantMemberId` (who submitted) and `subjectMemberId` (who it's about) to Nikah/Death/NOC.
- Rule: ordinary member → subject must be self (current behavior unchanged). Family head → subject may be any active member of own family. Fixes: head applies for son's nikah; bride-side family can now apply too (bride as subject).
- Backfill: existing records get both = current memberId.

### Phase B — Documents (the blocker)

**B1. One `Document` model:**
```
tenantId, ownerType ('member'|'family'|'registration'), ownerId,
documentType (id_proof|age_proof|photo|address_proof|divorce_doc|death_proof|other),
fileKey, fileName, mimeType, size,
uploadedBy, status ('pending'|'verified'|'rejected'), verifiedBy, verifiedAt, rejectionReason
```
Skip versioning and expiry for now — re-upload replaces, add versions only if a real need appears.

**B2. Upload endpoints (reuse existing Spaces service):**
- `POST /upload/document` — **private ACL**, pdf/jpeg/png/webp, 10MB.
- `GET /documents/:id/url` — returns short-lived signed URL; authorize: owner member/family-head or admin. Never store/expose a public URL.

**B3. Attach to registrations:** `documents: ObjectId[]` on all 3 registration models. Admin review screen lists attached docs with verify/reject per doc.

**B4. Required-documents config:** hardcode a per-type checklist first (nikah: id + age + photo; death: id + death proof). Per-tenant configurable only if a tenant actually asks.

### Phase C — Certificates

**C1. One `Certificate` model (shared by all types):**
```
tenantId, certificateNo ('NK'|'DT'|'NOC' + year + seq), type, registrationId,
issuedBy, issueDate, pdfKey, status ('valid'|'revoked'), revokedReason
```
**C2. Generation:** on admin "Approve & Issue", render PDF (pdfkit — no browser dependency), store private, certificate row created. Regenerate = new certificate, old one `revoked` (never delete — audit).
**C3. QR + public verify:** QR on the PDF = link to `GET /verify/:certificateNo` — **public, unauthenticated**, returns only: valid/revoked, type, certificate no, mahallu name, issue date. No names of parties, no family data.
**C4. Member portal: "My Certificates"** list + download (signed URL).

### Phase D — Frontend pages (backend mostly done already)

1. **Nikah application form** (`/member/nikah`) — subject picker (family head sees family list; member sees self), bride/groom details, document upload, submit → status list.
2. **Death report form** (`/member/death`) — same pattern.
3. **My Family page** (family head only) — members list, per-member "request change".
4. **Profile page + edit** — expose existing `PUT /member-user/profile` (phone/email) that has no UI today.
5. **Applications list** — unify nikah/death/NOC statuses in one "My Requests" page (NOC pages exist; extend, don't rebuild).

### Phase E — Workflow hardening

**E1. `correction_required` status** on all 3 registration types (+ member can edit & resubmit → back to `pending`). `remarks` field already exists (N4) — admin writes what to fix. This kills the "rejected = dead end" problem and is the single biggest UX win.
- Full status set: `pending | correction_required | approved | rejected` — **not** GPT's 11-status list. Draft/UnderReview/Verified/Issued/Completed/Cancelled add states nobody asked for; issuance is visible via the Certificate record.

**E2. Payment verification.** Member-submitted Varisangya/Zakat get `status: 'pending'`; admin verifies → balance/ledger updated then. Admin-entered payments stay immediate. (Today member submissions hit financial records instantly — real risk.)

**E3. Change requests (member data edits):** one generic model:
```
ChangeRequest: tenantId, targetType ('member'|'family'), targetId,
requestedBy, changes: [{field, oldValue, newValue}],
status ('pending'|'approved'|'rejected'), reviewedBy, remarks
```
- Member → own record; family head → own family + its members.
- Requestable fields whitelist: address, occupation, education, marital status, contact. Never: economicStatus, welfareStatus, varisangya grade, isDead (admin-only).
- Admin approval queue page; approve = apply changes to master record (audited).
- Phone change = account access change → require OTP on the NEW number before the request enters the queue (this doubles as the account-recovery path via admin).

### Phase F — Data quality & linking (after the above ships)

1. **Student ↔ institution link:** optional `institutionId` / `localityFacilityId` on member education info → unlocks "our students in Madrasa A", "children not enrolled".
2. **CSV export** for families/members/payments/registrations (one generic endpoint + column map per entity; import already exists).
3. **Duplicate detection:** nightly/on-demand phone + (name+DOB) match report page. No fuzzy-matching engine until simple matching proves insufficient.
4. **Data-quality widget** on admin dashboard: unapproved families, members missing DOB/phone, families with no head set (N1 backfill tracker), suspected duplicates.

---

## 3. Deliberately NOT building (and why)

| GPT suggestion | Verdict |
|---|---|
| Separate Family Head portal/account/role | **No** — capability flag on member login (Section 0) |
| Generic Application/Workflow Engine | **Not now** — 3 working workflows + shared Document/Certificate/ChangeRequest services cover it; generalize only when a 4th+ member-facing application type actually lands |
| 11-status application lifecycle | **No** — 4 statuses incl. `correction_required` |
| Document versioning/expiry reminders | **Later** — re-upload replaces; add if a real expiring-document type appears |
| Family lifecycle (merge/split/transfer between mahallus), relationship graph beyond `relationship` field | **Later** — real need, but nothing user-facing depends on it yet |
| Offline survey app, multilingual, Hijri dates, localization | **Later / product decision** — note: `houseNameMl`/`familyHeadMl` show Malayalam duality already exists ad-hoc; decide a policy before spreading `*Ml` fields further |
| Wallet KYC/gateway questions | **N/A** — current wallet is an internal contribution balance, not real money custody; keep it that way, just label it "Contribution Balance" in member UI |
| Support-ticket SLA workflow, notification scheduling/acknowledgement | **Later** — current basic versions work |
| Data retention/backup policy docs | **Do as ops doc**, not code, when deploying to production |

---

## 4. Answers to the direct questions

**"Member is each member, not family head — 2 setups?"**
Each member = own login (already built, keep). Family head = the *same* login, recognized via new `Family.headMemberId`, unlocking family-scope actions in the same portal. One setup, one extra section. Do not build a second portal or a new role.

**"Is this the best, most user-friendly method?"**
Yes, for these reasons: users get one app and one login; the head manages family without switching accounts; ordinary members keep privacy (head requests changes through admin approval, doesn't silently edit spouses' data); `correction_required` + remarks means applications get fixed instead of dead-ending; and the public QR verify page shows validity without leaking family data.

**"Any more gaps?"**
Yes — three new ones found today: family head is only a name string (N1 — must fix first), no member relationship field (N2), and uploads are public-read which is a security problem for documents (N3). Plus one cost-saver: `remarks` already exists on registrations (N4).

---

## 5. Build order summary

```
A1 headMemberId → A2 relationship → A3 applicant/subject
        ↓
B  Document model + private upload + attach to registrations
        ↓
C  Certificate model + PDF + QR + public verify
        ↓
D  Frontend: nikah form, death form, my-family, profile, requests
        ↓
E  correction_required · payment verification · ChangeRequest
        ↓
F  student↔institution · export · duplicates · data-quality widget
```

Phases A–D deliver the complete stated goal: family head logs in, manages family via requests, applies for nikah/death with documents, admin verifies, certificate PDF with QR comes out.
