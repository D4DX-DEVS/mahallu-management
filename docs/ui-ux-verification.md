# Mahallu UI/UX verification report

Generated: 2026-10-05

This report is generated from the route and page source with `npm run audit:ui`. It verifies the shared page contract after the cross-module alignment pass; it does not claim that live API data is present.

## Coverage

- Registered protected routes: **257**
- Feature page files audited: **245**
- Pages passing the shared contract: **245/245**
- Hand-written tables using the shared table treatment: **34/34**
- Pages needing a source-level follow-up: **0**

The shared contract is: a `PageHeader` or documented custom header, a consistent surface primitive, loading/error treatment for data-backed screens, and the normalized `.data-table` treatment for hand-written tables. Create/edit routes are covered by `FormModalRoute`, so they are explicitly accepted as modal form surfaces.

## Page-by-page results

| Page | Header | Surface | States | Tables | Raw neutral classes | Result |
| --- | --- | --- | --- | --- | ---: | --- |
| `BalanceSheet` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ConsolidatedReport` | PASS | PASS | PASS | PASS | 5 | **PASS** |
| `DayBook` | PASS | PASS | PASS | PASS | 3 | **PASS** |
| `IncomeExpenditure` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `LedgerReport` | PASS | PASS | PASS | PASS | 5 | **PASS** |
| `PettyCashDetail` | PASS | PASS | PASS | PASS | 3 | **PASS** |
| `PettyCashList` | PASS | PASS | PASS | N/A | 6 | **PASS** |
| `TrialBalance` | PASS | PASS | PASS | PASS | 3 | **PASS** |
| `CategoriesList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CategoryDetail` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ChangeRequestsList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `CreateTenant` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `DataQualityPage` | PASS | PASS | PASS | PASS | 4 | **PASS** |
| `EditTenant` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `MahallMain` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `Security` | PASS | PASS | PASS | PASS | 0 | **PASS** |
| `TenantDetails` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `TenantsList` | PASS | PASS | PASS | N/A | 4 | **PASS** |
| `AssetDetail` | PASS | PASS | PASS | N/A | 7 | **PASS** |
| `AssetsList` | PASS | PASS | PASS | N/A | 3 | **PASS** |
| `CreateAsset` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `EditAsset` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `Assistant` | PASS | PASS | PASS | N/A | 11 | **PASS** |
| `Login` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CemeteriesList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `CemeteryDetail` | PASS | PASS | PASS | PASS | 4 | **PASS** |
| `CemeteryForm` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `GraveForm` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CertificatesList` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `VerifyCertificate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ClusterDetail` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `ClustersList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CollectionsOverview` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CreateVarisangya` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CreateZakat` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `LiveDues` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `VarisangyaList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `ZakatList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CommitteeDetail` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `CommitteesList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `CreateCommittee` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `CreateMeeting` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `EditCommittee` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `EditMeeting` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `MeetingDetail` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `MeetingsList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `AnnouncementCreate` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `AnnouncementDetail` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `AnnouncementsList` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `CounsellingCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CounsellingDetail` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CounsellingList` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `DisputesCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `DisputesDetail` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `DisputesList` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `InheritanceCreate` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `InheritanceDetail` | PASS | PASS | PASS | PASS | 1 | **PASS** |
| `InheritanceList` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `Dashboard` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ProjectCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ProjectDetail` | PASS | PASS | PASS | PASS | 3 | **PASS** |
| `ProjectEdit` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ProjectForm` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ProjectsList` | PASS | PASS | PASS | N/A | 6 | **PASS** |
| `AcademicSupportCreate` | PASS | PASS | PASS | N/A | 5 | **PASS** |
| `AcademicSupportDetail` | PASS | PASS | PASS | N/A | 3 | **PASS** |
| `AcademicSupportList` | PASS | PASS | PASS | PASS | 6 | **PASS** |
| `AttendanceSheet` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `AwardCreate` | PASS | PASS | PASS | N/A | 3 | **PASS** |
| `AwardsList` | PASS | PASS | PASS | PASS | 5 | **PASS** |
| `ClassCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ClassDetail` | PASS | PASS | PASS | PASS | 4 | **PASS** |
| `ClassEdit` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ClassesList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `EducationReport` | PASS | PASS | PASS | N/A | 6 | **PASS** |
| `ExamCreate` | PASS | PASS | PASS | N/A | 4 | **PASS** |
| `ExamDetail` | PASS | PASS | PASS | PASS | 4 | **PASS** |
| `ExamsList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ScholarshipCreate` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `ScholarshipsList` | PASS | PASS | PASS | PASS | 5 | **PASS** |
| `CreateEmployee` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `EditEmployee` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `EmployeeDetail` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `EmployeesList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `EmployerCreate` | PASS | PASS | PASS | N/A | 3 | **PASS** |
| `EmployerEdit` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `EmployersList` | PASS | PASS | PASS | PASS | 4 | **PASS** |
| `TrainingCreate` | PASS | PASS | PASS | N/A | 3 | **PASS** |
| `TrainingDetail` | PASS | PASS | PASS | PASS | 7 | **PASS** |
| `TrainingsList` | PASS | PASS | PASS | PASS | 4 | **PASS** |
| `VacanciesList` | PASS | PASS | PASS | PASS | 4 | **PASS** |
| `VacancyCreate` | PASS | PASS | PASS | N/A | 3 | **PASS** |
| `VacancyDetail` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `CreateFamily` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `EditFamily` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `FamiliesList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `FamilyDetail` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `UnapprovedFamiliesList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `BloodDonors` | PASS | PASS | PASS | N/A | 4 | **PASS** |
| `CampsCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CampsList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `DoctorCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `DoctorEdit` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `DoctorsDirectory` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `DonorCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `DonorEdit` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `PalliativeCases` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `PatientSupport` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `RestrictedHealthPage` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CreateInstitute` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `EditInstitute` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `InstituteDetail` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `InstitutesList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `BookForm` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `BooksList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `IssueCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `IssuesList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `LoanCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `LoanDetail` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `LoansList` | PASS | PASS | PASS | N/A | 4 | **PASS** |
| `ReliefCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ReliefDetail` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ReliefList` | PASS | PASS | PASS | N/A | 4 | **PASS** |
| `CreateMahalluAccount` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CreateMahalluCategory` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CreateMahalluLedger` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CreateMahalluLedgerItem` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `EditMahalluAccount` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `EditMahalluCategory` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `EditMahalluLedger` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `MahalluAccountsList` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `MahalluBalanceSheet` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `MahalluCategoriesList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `MahalluCombinedReport` | PASS | PASS | PASS | PASS | 6 | **PASS** |
| `MahalluDayBook` | PASS | PASS | PASS | PASS | 2 | **PASS** |
| `MahalluIncomeExpenditure` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `MahalluLedgerItemsList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `MahalluLedgerReport` | PASS | PASS | PASS | PASS | 2 | **PASS** |
| `MahalluLedgersList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `MahalluTrialBalance` | PASS | PASS | PASS | PASS | 4 | **PASS** |
| `CategoriesList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CreateCategory` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CreateInstituteAccount` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CreateLedger` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CreateLedgerItem` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CreateWallet` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `InstituteAccountsList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `LedgerItemsList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `LedgersList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `WalletsList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `MemberCertificates` | PASS | PASS | PASS | PASS | 0 | **PASS** |
| `MemberDeathRequest` | PASS | PASS | PASS | N/A | 11 | **PASS** |
| `MemberFamily` | PASS | PASS | PASS | N/A | 8 | **PASS** |
| `MemberNOCList` | PASS | PASS | PASS | PASS | 0 | **PASS** |
| `MemberNOCRequest` | PASS | PASS | PASS | N/A | 25 | **PASS** |
| `MemberNikahRequest` | PASS | PASS | PASS | N/A | 16 | **PASS** |
| `MemberOverview` | PASS | PASS | PASS | PASS | 0 | **PASS** |
| `MemberPayments` | PASS | PASS | PASS | PASS | 0 | **PASS** |
| `MemberProfile` | PASS | PASS | PASS | N/A | 7 | **PASS** |
| `MemberRequests` | PASS | PASS | PASS | PASS | 2 | **PASS** |
| `MemberVarisangyaPage` | PASS | PASS | PASS | PASS | 1 | **PASS** |
| `CreateMember` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `EditMember` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `MemberDetail` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `MembersList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `MosqueDetail` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `MosquesList` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `NotificationsList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `SendNotification` | PASS | PASS | PASS | N/A | 4 | **PASS** |
| `CreateProgram` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `EditProgram` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ProgramDetail` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `ProgramsList` | PASS | PASS | PASS | N/A | 12 | **PASS** |
| `RegisterList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `RegistersOverview` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CreateDeathRegistration` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CreateMarriageAssistance` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `CreateNOC` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CreateNikahRegistration` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `DeathRegistrationDetail` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `DeathRegistrationsList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `EditDeathRegistration` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `EditNOC` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `EditNikahRegistration` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `MarriageAssistanceList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `NOCDetail` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `NOCList` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `NikahRegistrationDetail` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `NikahRegistrationsList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `KhateebsList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `KhutbahCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `KhutbahEdit` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `KhutbahSchedule` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `AnnualReport` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `AreaReport` | PASS | PASS | PASS | PASS | 1 | **PASS** |
| `BloodBankReport` | PASS | PASS | PASS | PASS | 1 | **PASS** |
| `CommunityReport` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `DemographicsReport` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `DevelopmentIndex` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `OrphansReport` | PASS | PASS | PASS | PASS | 1 | **PASS** |
| `WelfareReport` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `CreateSalaryPayment` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `SalaryDetail` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `SalaryList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `SalarySummary` | PASS | PASS | PASS | PASS | 3 | **PASS** |
| `ActivityLogsList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `BannersList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `CreateBanner` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `CreateFeed` | PASS | PASS | PASS | N/A | 3 | **PASS** |
| `CreateSupport` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `EditBanner` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `FeedsList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `SupportDetail` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `SupportList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `FacilitiesList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `SurveyDetail` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `SurveyList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `AllUsersList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `CreateInstituteUser` | PASS | PASS | PASS | N/A | 5 | **PASS** |
| `CreateMahallUser` | PASS | PASS | PASS | N/A | 4 | **PASS** |
| `CreateSurveyUser` | PASS | PASS | PASS | N/A | 4 | **PASS** |
| `EditInstituteUser` | PASS | PASS | PASS | N/A | 4 | **PASS** |
| `EditMahallUser` | PASS | PASS | PASS | N/A | 7 | **PASS** |
| `EditSurveyUser` | PASS | PASS | PASS | N/A | 4 | **PASS** |
| `InstituteUsersList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `MahallUsersList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `SelectUserType` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `SurveyUsersList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `UserDetail` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `AssignmentCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `AssignmentsList` | PASS | PASS | PASS | PASS | 4 | **PASS** |
| `VolunteerCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `VolunteerDetail` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `VolunteersList` | PASS | PASS | PASS | N/A | 2 | **PASS** |
| `ApplicationCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ApplicationDetail` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ApplicationEdit` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ApplicationsList` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `SchemesList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `BeneficiariesList` | PASS | PASS | PASS | N/A | 1 | **PASS** |
| `BeneficiaryCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `BeneficiaryEdit` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `DistributionCreate` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `DistributionsList` | PASS | PASS | PASS | N/A | 0 | **PASS** |
| `ZakatSummary` | PASS | PASS | PASS | N/A | 0 | **PASS** |

## Live verification checklist

- [x] Shared Manrope typography and page title scale are owned by the design tokens and `PageHeader`.
- [x] Sidebar rail, right-opening submenu, content offset and profile menu are owned by shared layout components.
- [x] List surfaces use one toolbar/table/pagination rhythm; the table owns the visible frame.
- [x] Sort indicators, filtering, export actions, selection and pagination are available through shared primitives where a page exposes those capabilities.
- [x] Create/edit routes use one white modal with one-column or two-column layout based on field count.
- [x] Loading skeletons, retryable errors and empty/no-results states are represented in the shared UI layer.
- [x] `npm run build` and `git diff --check` are required release checks for this report.
