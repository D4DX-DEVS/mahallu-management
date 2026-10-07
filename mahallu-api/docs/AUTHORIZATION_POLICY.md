# Authorization policy (as implemented) and open product decisions

This file states what the server enforces today, what it deliberately does not, and which product
decisions are still needed. It is factual: where a policy is not defined by the documentation, the
behaviour was left unchanged and the decision is listed in section 7.

The CMS menu hides screens by role, but hiding is not authorization. Every rule below is enforced (or
not) by the API itself.

## 1. Roles and role groups

Roles: `super_admin`, `mahall` (Mahallu admin), `survey` (survey worker), `institute` (institute
admin), `member` (resident; works only through `/api/member-user/*` and a short allow-list).

`ROLE_GROUPS` in `src/middleware/authMiddleware.ts`:

| Group | Roles | Meant for |
| --- | --- | --- |
| ADMIN | super_admin, mahall | Mahallu-wide data and administration |
| INSTITUTE_STAFF | ADMIN + institute | Institute data, finance, salary, madrasa, education report |
| FIELD_STAFF | ADMIN + survey | Field registers and survey data |
| ALL_STAFF | every non-member role | Reference data, dashboard widgets, own notifications |

`allowRoles(list)` always lets a Super Admin through and carries its list as `.allowedRoles`, so the
policy of a router can be read by tests (`src/tests/routeAuthorization.test.ts`).

## 2. Router policy summary

Pinned by the sweep in `src/tests/routeAuthorization.test.ts` (every router file must be classified; no
endpoint may be reachable by a role wider than its router's ceiling; routers with an ADMIN,
INSTITUTE_STAFF or FIELD_STAFF ceiling have no unguarded endpoint).

- ADMIN: academic support, announcements, assets, assistant, cemetery, collectibles (varisangya, zakat,
  wallet), committees, counselling, development, employment, exports, health, khutbah, library,
  marriage assistance, meetings, programs, qard, registrations, scholarships, skill training, uploads,
  users, volunteers, zakat distribution. Welfare, community, annual, data-quality and duplicates reports.
- INSTITUTE_STAFF: accounting reports, attendance, employees, exams, institutes, madrasa, master
  accounts, petty cash, salary, and `GET /reports/education`. Within these, an institute account is
  bound to its own institute by the controllers (see `src/utils/scope.ts`); Mahallu-level records
  (institute null) and sibling institutes are not theirs. Mahallu bank accounts and wallets are ADMIN.
- FIELD_STAFF: clusters, cluster visits, locality facilities, registers, surveys, relief (survey may
  log a case), welfare (also needs the `welfare` sensitive module), and the area, blood-bank, orphans
  and demographics reports.
- ALL_STAFF: auth, category `/by-key`, certificates (reading), change requests (raising), dashboard
  widgets, documents (own uploads), families, members, mosque (reading), notifications (own), reports
  router (each report pins its own audience), social (reading, raising a ticket), tenants (own Mahallu).
- No staff role: `memberUserRoutes` (member self-service).

## 3. Sensitive-module grants (`permissions.sensitiveModules`) - ENFORCED

`User.permissions.sensitiveModules` is an array drawn from `counselling`, `maslahat`, `inheritance`,
`health`, `welfare`.

Enforced on the server by `src/middleware/sensitiveAccess.ts` (Super Admin passes; everyone else needs
the module in their own grant):

- `counsellingRoutes`: `counselling`, `maslahat`, `inheritance` (one gate per sub-router)
- `healthRoutes`: `GET /health-resources/sensitive` needs `health`; the health controller applies the
  same rule to read/update/delete of palliative and patient-support records and to the counts
- `welfareRoutes`: the whole router needs `welfare`

Also read by the CMS (`Sidebar.tsx`, `CommandPalette.tsx`) to show or hide menu entries; that is only
a convenience.

The grant is written by `POST /users` and `PUT /users/:id` (ADMIN only) from the request body.
`userValidation.ts` validates `permissions`: it must be an object, the four flags must be booleans, and
`sensitiveModules` must be a list of at most 5 unique names from the five above (400 otherwise).
The update is field-wise: only the permission fields present in the request are changed, so a PUT that
does not mention `sensitiveModules` (for example from the survey-user or institute-user edit form, which
send only the four flags) keeps the existing grants, and an explicit empty list revokes them. Before this
was fixed, saving either of those forms replaced the whole `permissions` object and erased the grants.
No document says who may grant or receive a module, so none of that is enforced: a Mahallu admin can
grant any sensitive module to any user of their Mahallu, including themselves, and `POST /users` accepts
grants for any role (see decision D6).

Impersonation sessions get all five modules (`IMPERSONATION_PERMISSIONS`).

## 4. `permissions.view / add / edit / delete` - NOT ENFORCED (decision needed)

Status: **defined and stored, shown in the CMS, never used to allow or deny anything on the server.**

Where defined:
- `src/models/User.ts` (`permissions.view|add|edit|delete`, Boolean, default `false`) and the `IUser` type.
- `src/validations/userValidation.ts` (`permissions.view|add|edit|delete` must be boolean when sent).
- Created with `false` for every flag when `POST /users` is called without `permissions`
  (`userController.ts`), with `view: true` and the rest `false` for member accounts
  (`userController.ts`, `memberController.ts`, `otpController.ts`), and with all `true` for the test
  accounts, seed scripts and the Super Admin (`otpController.ts`, `utils/createSuperAdmin.ts`,
  `scripts/*`).
- Impersonation sessions get all four `true`.

Where set: the CMS user forms (`CreateMahallUser`, `CreateSurveyUser`, `CreateInstituteUser`,
`EditMahallUser`, `EditSurveyUser`, `EditInstituteUser`). All four create forms default every flag to
`false`.

Where consumed:
- Backend: only echoed back to a member as `assignedOptions` in `memberUserController.ts`. No
  middleware or controller reads `permissions.add|edit|delete` to authorize a request.
- CMS: only displayed on `UserDetail.tsx`. No screen hides an Add/Edit/Delete button because of them
  (the only gating on `permissions.*` is `sensitiveModules`).

Documentation: `API_DOCUMENTATION.md` and `ROLE_ASSIGNMENT_FLOW.md` show the object in sample payloads
only; `FR_AND_WORKFLOW_DOCUMENTATION.md` says users are given "appropriate permissions" and that members
cannot do admin things, but nowhere says a staff user without `delete` cannot delete. The documentation
does not state that these flags are authoritative, so no enforcement was added.

Why it was not simply enforced: the schema default and every CMS create form produce accounts with
`add=edit=delete=false`, and that is what most existing staff accounts will carry. Enforcing the flags
now would stop those accounts from creating, editing or deleting anything. "A missing flag keeps
today's behaviour" cannot be honoured because there is no missing flag: `false` is stored.

What enforcement would look like once decided: a `requirePermission('add' | 'edit' | 'delete')` guard,
tagged like `allowRoles` for router introspection, mounted per method (POST -> add, PUT/PATCH -> edit,
DELETE -> delete) after the role guard; Super Admin and impersonation sessions pass; member accounts are
unaffected (they never reach staff routers). It needs a rollout plan: a one-off migration that sets the
flags for existing accounts (for example all `true` for current admins), and changing the form defaults.

## 5. Family and member access (decision needed, behaviour unchanged)

`familyRoutes` and `memberRoutes` use `allowRoles(ALL_STAFF)`, so an institute admin can list, read,
create, update, delete and bulk-read families and members of the whole Mahallu. The controllers apply
tenant scoping only (`tenantFilterFor`); there is no institute scoping anywhere in `familyController.ts`
or `memberController.ts`, and `Member` / `Family` carry no institute link except the optional
`Member.educationInstitutionId`. Bulk import is already ADMIN-only.

The existing sources do not agree, and the institute screens use the member list:
- CMS menu: Families and Members are listed for `SURVEY_ROLES` only (`menuItems.ts`); the CMS routes
  for `/families` and `/members` carry no `allowedRoles` at all (`communityRoutes.tsx`).
- Swagger comments on both routers: "Mahall/Institute/Survey (own tenant)" for the list and read endpoints.
- `INSTITUTE_ADMIN_ENDPOINTS.md` lists `GET/POST/PUT/DELETE /families` and `/members` as Institute Admin
  endpoints.
- `FR_AND_WORKFLOW_DOCUMENTATION.md` describes the Institute user as "view institute-related data
  only" and the Survey user as "view and manage family and member information".
- Institute-role screens read members: `EnrollStudentModal` (enrolling a madrasa student, on the
  institute-role `/education/classes/:id` page) calls `GET /members` for its member picker; the dashboard
  (allowed for institute) shows family and member totals and recent families. The other member pickers
  (scholarship awards, academic support, zakat, loans) sit on Mahallu-admin-only screens.

See decision D2.

## 6. Education report (`GET /reports/education`) - SCOPED for institute accounts

Allowed: super_admin, mahall, institute.

- Mahallu admin / Super Admin: unchanged, Mahallu-wide.
- Institute account: the institute comes from the session (`getCallerScope`), never the query. An
  institute account with no institute is refused with 403.
  - Scoped to the institute's classes: `studentsCount` (active enrollments, through `classId`),
    `activeClassesCount` (`MadrasaClass.instituteId`), `attendancePercentThisMonth` (attendance
    sheets, through `classId`), `examsCount` (through `classId`).
  - Withheld: `scholarships` and `supportCases` are returned as `null`, plus a `scopeNote`. `Scholarship`,
    `ScholarshipAward` and `AcademicSupportCase` have no institute or class, so they cannot be
    attributed to an institute with the current data model; zeros would look like data, so null is
    returned. The CMS page shows "Not available for institute accounts".
  - To scope the withheld sections the data model would need an optional `instituteId` (ObjectId, ref
    Institute, indexed) on `Scholarship` (awards then inherit it through `scholarshipId`) and on
    `AcademicSupportCase`, plus a decision on whether existing Mahallu-level programmes stay null
    (Mahallu-level) or are assigned. It is backward compatible (optional), and needs no migration unless
    existing rows are to be assigned an institute.
- Related: `madrasaController`, `examController` and `attendanceController` are now scoped to the
  institute's own classes for an institute account (see section 8). New classes created by an institute
  account carry its `instituteId`, so they count in this report. Classes created earlier without an
  `instituteId` do not count for any institute until an administrator assigns them.

Tests: `src/tests/educationReportScope.test.ts`.

## 8. Institute scoping of education modules - ENFORCED

For an institute account the institute comes only from the session (`scope.ts`); query, body, the
`x-institute-id` header and a body `tenantId` are ignored. Helpers are in `src/utils/educationScope.ts`.

- Classes: list and summary are limited to the institute's own classes; get, update, delete and class
  students answer 403 for a sibling institute's class or a class with no institute (404 for another
  Mahallu or an unknown id); creating a class forces the caller's own institute; a teacher must be an
  employee of that institute; the institute of a class cannot be changed by an institute account.
- Enrollments, attendance sheets and exams are reached through their class: list endpoints are limited to
  the institute's own classes, by-id and write endpoints check the parent class first, and a class named
  in a body must be in scope (400 otherwise). Moving an exam to another class needs that class in scope.
- Super Admin and Mahallu admin keep Mahallu-wide access, including classes with no institute. An optional
  `?instituteId=` is only a filter and must be an institute of the same Mahallu (400 otherwise).
- Old classes with no `instituteId` are treated as Mahallu level: they are never visible to an institute
  account and nothing was backfilled. The class form lets Super Admin / Mahallu admin choose an institute.
- Tests: `madrasaInstituteScope.test.ts`, `examAttendanceInstituteScope.test.ts`.

## 7. Open product decisions

- D1 `permissions.add/edit/delete`: are they authoritative? If yes: approve the migration (set the flags
  for existing accounts), the new form defaults, and the `requirePermission` guard in section 4. If no:
  remove them from the forms and the API, or document them as informational.
- D2 Families and members for institute admins: keep as is (full read and write on the whole Mahallu),
  or one of: (a) read-only member lookup for institute accounts limited to named fields (for example
  name, mahallId, phone, family house name) so the enrollment picker works; (b) scope institute accounts
  to their own students and employees (enrollments, `Member.educationInstitutionId`, employees); (c)
  remove institute access and give the education screens their own lookup endpoint. In every option,
  decide separately whether an institute account may create, update or delete families and members (it
  currently can, including creating a member's login account).
- D3 CMS `/families` and `/members` routes have no role guard (any signed-in role can open the screens).
  Align them with whatever D2 decides.
- D4 (implemented, confirm) Madrasa classes, enrollments, exams and attendance are now limited to the
  institute's own classes for an institute account (section 8). Decide what happens to classes that were
  created without an institute: they are treated as Mahallu level and stay visible only to Super Admin
  and Mahallu admin; an administrator must assign them to an institute (edit the class) for that
  institute to see them. The `Classes and students` menu is still hidden by decision.
- D5 Education report: should institute accounts see Mahallu-level scholarships and support cases? If
  yes, no change is needed beyond lifting the null; if they should see only their own, add `instituteId`
  to those models (section 6).
- D6 Who may grant sensitive modules (counselling, maslahat, inheritance, health, welfare)? Options:
  (a) Super Admin only; (b) a Mahallu admin may grant to other users of their Mahallu but not to
  themselves; (c) as today, any Mahallu admin may grant any module to anyone in their Mahallu, including
  themselves. Also decide whether survey, institute and member accounts may receive grants (today
  `POST /users` accepts them for any role). Why code cannot decide: no document states the rule. If (a) or
  (b) is chosen it is a small change in `userController.updateUser` and `createUser`; compare the new
  grant with the stored one so that re-sending an unchanged grant is not blocked.
- D7 Member phone change: approving a member's `phone` change request updates `Member.phone` only; the
  linked member login user keeps its old `User.phone` and its `tokenVersion`. OTP sign-in therefore works
  with the old number (through `User.phone`) and with the new number (through the Member-phone fallback),
  and a recycled old number keeps access. Admin edits of a member's phone behave the same way. Decide
  whether an approved phone change must also update the linked user's phone and revoke its sessions. The
  new number was already proven by an OTP when the request was made.
- D8 Re-issuing a certificate after revocation: revoking clears the registration's active-certificate key,
  so any admin can issue a NEW certificate with a NEW number for the same registration; the revoked one
  stays revoked and its PDF is kept. Decide whether re-issue should be allowed, restricted to Super
  Admin, or require a reason.
- D9 Scholarships, awards and academic-support cases have no institute, and their routers are
  admin-only. Institute accounts therefore see `null` for them in the education report. To scope them,
  decide how existing records are assigned to institutes, then add an optional `instituteId`.
- D10 Member API surface: members may now call `GET /api/certificates` and
  `GET /api/certificates/:id/download` (own certificates only). Confirm this widening is intended.
