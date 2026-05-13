import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from './store/themeStore';
import { applyTheme } from './utils/theme';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/ui/ProtectedRoute';
import Login from './features/auth/pages/Login';
import Dashboard from './features/dashboard/pages/Dashboard';
import MahallUsersList from './features/users/pages/MahallUsersList';
import CreateMahallUser from './features/users/pages/CreateMahallUser';
import EditMahallUser from './features/users/pages/EditMahallUser';
import UserDetail from './features/users/pages/UserDetail';
import FamiliesList from './features/families/pages/FamiliesList';
import CreateFamily from './features/families/pages/CreateFamily';
import EditFamily from './features/families/pages/EditFamily';
import FamilyDetail from './features/families/pages/FamilyDetail';
import MembersList from './features/members/pages/MembersList';
import CreateMember from './features/members/pages/CreateMember';
import EditMember from './features/members/pages/EditMember';
import MemberDetail from './features/members/pages/MemberDetail';
import InstitutesList from './features/institutes/pages/InstitutesList';
import CreateInstitute from './features/institutes/pages/CreateInstitute';
import EditInstitute from './features/institutes/pages/EditInstitute';
import ProgramsList from './features/programs/pages/ProgramsList';
import CreateProgram from './features/programs/pages/CreateProgram';
import EditProgram from './features/programs/pages/EditProgram';
import ProgramDetail from './features/programs/pages/ProgramDetail';
import EmployeesList from './features/employees/pages/EmployeesList';
import CreateEmployee from './features/employees/pages/CreateEmployee';
import EmployeeDetail from './features/employees/pages/EmployeeDetail';
import EditEmployee from './features/employees/pages/EditEmployee';
import SalaryList from './features/salary/pages/SalaryList';
import CreateSalaryPayment from './features/salary/pages/CreateSalaryPayment';
import SalaryDetail from './features/salary/pages/SalaryDetail';
import SalarySummary from './features/salary/pages/SalarySummary';
import DayBook from './features/accounting/pages/DayBook';
import TrialBalance from './features/accounting/pages/TrialBalance';
import BalanceSheet from './features/accounting/pages/BalanceSheet';
import LedgerReport from './features/accounting/pages/LedgerReport';
import IncomeExpenditure from './features/accounting/pages/IncomeExpenditure';
import ConsolidatedReport from './features/accounting/pages/ConsolidatedReport';
import PettyCashList from './features/accounting/pages/PettyCashList';
import PettyCashDetail from './features/accounting/pages/PettyCashDetail';
import CommitteesList from './features/committees/pages/CommitteesList';
import CreateCommittee from './features/committees/pages/CreateCommittee';
import CommitteeDetail from './features/committees/pages/CommitteeDetail';
import EditCommittee from './features/committees/pages/EditCommittee';
import MeetingsList from './features/committees/pages/MeetingsList';
import CreateMeeting from './features/committees/pages/CreateMeeting';
import MeetingDetail from './features/committees/pages/MeetingDetail';
import NikahRegistrationsList from './features/registrations/pages/NikahRegistrationsList';
import NikahRegistrationDetail from './features/registrations/pages/NikahRegistrationDetail';
import CreateNikahRegistration from './features/registrations/pages/CreateNikahRegistration';
import DeathRegistrationsList from './features/registrations/pages/DeathRegistrationsList';
import DeathRegistrationDetail from './features/registrations/pages/DeathRegistrationDetail';
import CreateDeathRegistration from './features/registrations/pages/CreateDeathRegistration';
import NOCList from './features/registrations/pages/NOCList';
import NOCDetail from './features/registrations/pages/NOCDetail';
import CreateNOC from './features/registrations/pages/CreateNOC';
import EditNOC from './features/registrations/pages/EditNOC';
import EditNikahRegistration from './features/registrations/pages/EditNikahRegistration';
import EditDeathRegistration from './features/registrations/pages/EditDeathRegistration';
import CollectionsOverview from './features/collectibles/pages/CollectionsOverview';
import VarisangyaList from './features/collectibles/pages/VarisangyaList';
import CreateVarisangya from './features/collectibles/pages/CreateVarisangya';
import FamilyVarisangyaPage from './features/collectibles/familyVarisangya/FamilyVarisangyaPage';
import MemberVarisangyaPage from './features/collectibles/memberVarisangya/MemberVarisangyaPage';
import ZakatList from './features/collectibles/pages/ZakatList';
import CreateZakat from './features/collectibles/pages/CreateZakat';
import AreaReport from './features/reports/pages/AreaReport';
import BloodBankReport from './features/reports/pages/BloodBankReport';
import OrphansReport from './features/reports/pages/OrphansReport';
import BannersList from './features/social/pages/BannersList';
import CreateBanner from './features/social/pages/CreateBanner';
import EditBanner from './features/social/pages/EditBanner';
import FeedsList from './features/social/pages/FeedsList';
import ActivityLogsList from './features/social/pages/ActivityLogsList';
import SupportList from './features/social/pages/SupportList';
import InstituteAccountsList from './features/master-accounts/pages/InstituteAccountsList';
import CreateInstituteAccount from './features/master-accounts/pages/CreateInstituteAccount';
import CategoriesList from './features/master-accounts/pages/CategoriesList';
import CreateCategory from './features/master-accounts/pages/CreateCategory';
import WalletsList from './features/master-accounts/pages/WalletsList';
import CreateWallet from './features/master-accounts/pages/CreateWallet';
import LedgersList from './features/master-accounts/pages/LedgersList';
import CreateLedger from './features/master-accounts/pages/CreateLedger';
import LedgerItemsList from './features/master-accounts/pages/LedgerItemsList';
import CreateLedgerItem from './features/master-accounts/pages/CreateLedgerItem';
import SurveyUsersList from './features/users/pages/SurveyUsersList';
import CreateSurveyUser from './features/users/pages/CreateSurveyUser';
import EditSurveyUser from './features/users/pages/EditSurveyUser';
import InstituteUsersList from './features/users/pages/InstituteUsersList';
import CreateInstituteUser from './features/users/pages/CreateInstituteUser';
import EditInstituteUser from './features/users/pages/EditInstituteUser';
import AllUsersList from './features/users/pages/AllUsersList';
import SelectUserType from './features/users/pages/SelectUserType';
import UnapprovedFamiliesList from './features/families/pages/UnapprovedFamiliesList';
import InstituteDetail from './features/institutes/pages/InstituteDetail';
import NotificationsList from './features/notifications/pages/NotificationsList';
import SendNotification from './features/notifications/pages/SendNotification';
import TenantsList from './features/admin/pages/TenantsList';
import CreateTenant from './features/admin/pages/CreateTenant';
import TenantDetails from './features/admin/pages/TenantDetails';
import EditTenant from './features/admin/pages/EditTenant';
import MahallMain from './features/admin/pages/MahallMain';
import AssetsList from './features/assets/pages/AssetsList';
import CreateAsset from './features/assets/pages/CreateAsset';
import EditAsset from './features/assets/pages/EditAsset';
import AssetDetail from './features/assets/pages/AssetDetail';
import { ROUTES } from './constants/routes';
import MemberOverview from './features/member-portal/pages/MemberOverview';
import MemberPortalVarisangyaPage from './features/member-portal/pages/MemberVarisangyaPage';
import MemberNOCRequest from './features/member-portal/pages/MemberNOCRequest';
import MemberNOCList from './features/member-portal/pages/MemberNOCList';
import MemberPayments from './features/member-portal/pages/MemberPayments';
import { useAuthStore } from './store/authStore';

function App() {
  const { theme } = useThemeStore();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    applyTheme();
  }, [theme]);

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Navigate to={user?.role === 'member' ? ROUTES.MEMBER.OVERVIEW : ROUTES.DASHBOARD} replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'mahall', 'survey', 'institute']}>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MEMBER.OVERVIEW}
          element={
            <ProtectedRoute allowedRoles={['member']}>
              <MainLayout>
                <MemberOverview />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MEMBER.VARISANGYA}
          element={
            <ProtectedRoute allowedRoles={['member']}>
              <MainLayout>
                <MemberPortalVarisangyaPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MEMBER.NOC_REQUEST}
          element={
            <ProtectedRoute allowedRoles={['member']}>
              <MainLayout>
                <MemberNOCRequest />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MEMBER.NOC_LIST}
          element={
            <ProtectedRoute allowedRoles={['member']}>
              <MainLayout>
                <MemberNOCList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MEMBER.PAYMENTS}
          element={
            <ProtectedRoute allowedRoles={['member']}>
              <MainLayout>
                <MemberPayments />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Admin Routes (Super Admin Only) */}
        <Route
          path="/admin/tenants"
          element={
            <ProtectedRoute superAdminOnly>
              <MainLayout>
                <TenantsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tenants/create"
          element={
            <ProtectedRoute superAdminOnly>
              <MainLayout>
                <CreateTenant />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tenants/:id"
          element={
            <ProtectedRoute superAdminOnly>
              <MainLayout>
                <TenantDetails />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tenants/:id/edit"
          element={
            <ProtectedRoute superAdminOnly>
              <MainLayout>
                <EditTenant />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tenants/:id"
          element={
            <ProtectedRoute superAdminOnly>
              <MainLayout>
                <TenantDetails />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tenants/:id/edit"
          element={
            <ProtectedRoute superAdminOnly>
              <MainLayout>
                <EditTenant />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Mahall Main Route */}
        <Route
          path={ROUTES.MAHALL_MAIN}
          element={
            <ProtectedRoute>
              <MainLayout>
                <MahallMain />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Users Routes */}
        <Route
          path={ROUTES.USERS.MAHALL}
          element={
            <ProtectedRoute>
              <MainLayout>
                <MahallUsersList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.USERS.CREATE_MAHALL}
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateMahallUser />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/mahall/:id/edit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <EditMahallUser />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/mahall/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <UserDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Families Routes */}
        <Route
          path={ROUTES.FAMILIES.LIST}
          element={
            <ProtectedRoute>
              <MainLayout>
                <FamiliesList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.FAMILIES.CREATE}
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateFamily />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/families/:id/edit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <EditFamily />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.FAMILIES.DETAIL(':id')}
          element={
            <ProtectedRoute>
              <MainLayout>
                <FamilyDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Members Routes */}
        <Route
          path={ROUTES.MEMBERS.LIST}
          element={
            <ProtectedRoute>
              <MainLayout>
                <MembersList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MEMBERS.CREATE}
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateMember />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/members/:id/edit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <EditMember />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MEMBERS.DETAIL(':id')}
          element={
            <ProtectedRoute>
              <MainLayout>
                <MemberDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Institutes Routes */}
        <Route
          path={ROUTES.INSTITUTES.LIST}
          element={
            <ProtectedRoute>
              <MainLayout>
                <InstitutesList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.INSTITUTES.CREATE}
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateInstitute />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.INSTITUTES.DETAIL(':id')}
          element={
            <ProtectedRoute>
              <MainLayout>
                <InstituteDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/institutes/:id/edit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <EditInstitute />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Programs Routes */}
        <Route
          path={ROUTES.PROGRAMS.LIST}
          element={
            <ProtectedRoute>
              <MainLayout>
                <ProgramsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PROGRAMS.CREATE}
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateProgram />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PROGRAMS.DETAIL(':id')}
          element={
            <ProtectedRoute>
              <MainLayout>
                <ProgramDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/programs/:id/edit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <EditProgram />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Employee Routes */}
        <Route
          path={ROUTES.EMPLOYEES.LIST}
          element={
            <ProtectedRoute>
              <MainLayout>
                <EmployeesList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.EMPLOYEES.CREATE}
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateEmployee />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.EMPLOYEES.DETAIL(':id')}
          element={
            <ProtectedRoute>
              <MainLayout>
                <EmployeeDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.EMPLOYEES.EDIT(':id')}
          element={
            <ProtectedRoute>
              <MainLayout>
                <EditEmployee />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Salary Routes */}
        <Route
          path={ROUTES.SALARY.LIST}
          element={
            <ProtectedRoute>
              <MainLayout>
                <SalaryList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SALARY.CREATE}
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateSalaryPayment />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SALARY.SUMMARY}
          element={
            <ProtectedRoute>
              <MainLayout>
                <SalarySummary />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SALARY.DETAIL(':id')}
          element={
            <ProtectedRoute>
              <MainLayout>
                <SalaryDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Accounting Report Routes */}
        <Route
          path={ROUTES.ACCOUNTING.DAY_BOOK}
          element={
            <ProtectedRoute>
              <MainLayout>
                <DayBook />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ACCOUNTING.TRIAL_BALANCE}
          element={
            <ProtectedRoute>
              <MainLayout>
                <TrialBalance />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ACCOUNTING.BALANCE_SHEET}
          element={
            <ProtectedRoute>
              <MainLayout>
                <BalanceSheet />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ACCOUNTING.LEDGER_REPORT}
          element={
            <ProtectedRoute>
              <MainLayout>
                <LedgerReport />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ACCOUNTING.INCOME_EXPENDITURE}
          element={
            <ProtectedRoute>
              <MainLayout>
                <IncomeExpenditure />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ACCOUNTING.CONSOLIDATED}
          element={
            <ProtectedRoute>
              <MainLayout>
                <ConsolidatedReport />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ACCOUNTING.PETTY_CASH}
          element={
            <ProtectedRoute>
              <MainLayout>
                <PettyCashList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/petty-cash/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <PettyCashDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Committees Routes */}
        <Route
          path={ROUTES.COMMITTEES.LIST}
          element={
            <ProtectedRoute>
              <MainLayout>
                <CommitteesList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/committees/create"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateCommittee />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.COMMITTEES.DETAIL(':id')}
          element={
            <ProtectedRoute>
              <MainLayout>
                <CommitteeDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/committees/:id/edit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <EditCommittee />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/committees/meetings"
          element={
            <ProtectedRoute>
              <MainLayout>
                <MeetingsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/committees/meetings/create"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateMeeting />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/committees/meetings/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <MeetingDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/committees/:id/meetings"
          element={
            <ProtectedRoute>
              <MainLayout>
                <MeetingsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.COMMITTEES.MEETINGS}
          element={
            <ProtectedRoute>
              <MainLayout>
                <MeetingsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Registrations Routes */}
        {/* Asset Management Routes */}
        <Route
          path={ROUTES.ASSETS.LIST}
          element={
            <ProtectedRoute>
              <MainLayout>
                <AssetsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ASSETS.CREATE}
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateAsset />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ASSETS.DETAIL(':id')}
          element={
            <ProtectedRoute>
              <MainLayout>
                <AssetDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ASSETS.EDIT(':id')}
          element={
            <ProtectedRoute>
              <MainLayout>
                <EditAsset />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Registration Routes */}
        <Route
          path={ROUTES.REGISTRATIONS.NIKAH}
          element={
            <ProtectedRoute>
              <MainLayout>
                <NikahRegistrationsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/registrations/nikah/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <NikahRegistrationDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/registrations/nikah/create"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateNikahRegistration />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/registrations/nikah/:id/edit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <EditNikahRegistration />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.REGISTRATIONS.DEATH}
          element={
            <ProtectedRoute>
              <MainLayout>
                <DeathRegistrationsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/registrations/death/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <DeathRegistrationDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/registrations/death/create"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateDeathRegistration />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/registrations/death/:id/edit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <EditDeathRegistration />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.REGISTRATIONS.NOC.COMMON}
          element={
            <ProtectedRoute>
              <MainLayout>
                <NOCList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.REGISTRATIONS.NOC.NIKAH}
          element={
            <ProtectedRoute>
              <MainLayout>
                <NOCList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/registrations/noc/create"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateNOC />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/registrations/noc/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <NOCDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/registrations/noc/:id/edit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <EditNOC />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Collectibles Routes */}
        <Route
          path="/collections"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CollectionsOverview />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.COLLECTIBLES.VARISANGYA}
          element={
            <ProtectedRoute>
              <MainLayout>
                <VarisangyaList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/collectibles/varisangya/create"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateVarisangya />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.COLLECTIBLES.ZAKAT}
          element={
            <ProtectedRoute>
              <MainLayout>
                <ZakatList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/collectibles/zakat/create"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateZakat />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.COLLECTIBLES.FAMILY_VARISANGYA.BASE}
          element={
            <ProtectedRoute>
              <MainLayout>
                <FamilyVarisangyaPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.COLLECTIBLES.MEMBER_VARISANGYA.BASE}
          element={
            <ProtectedRoute>
              <MainLayout>
                <MemberVarisangyaPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Reports Routes */}
        <Route
          path={ROUTES.REPORTS.AREA}
          element={
            <ProtectedRoute>
              <MainLayout>
                <AreaReport />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.REPORTS.BLOOD_BANK}
          element={
            <ProtectedRoute>
              <MainLayout>
                <BloodBankReport />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.REPORTS.ORPHANS}
          element={
            <ProtectedRoute>
              <MainLayout>
                <OrphansReport />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Social Routes */}
        <Route
          path={ROUTES.SOCIAL.CREATE_BANNER}
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateBanner />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SOCIAL.EDIT_BANNER}
          element={
            <ProtectedRoute>
              <MainLayout>
                <EditBanner />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SOCIAL.BANNERS}
          element={
            <ProtectedRoute>
              <MainLayout>
                <BannersList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SOCIAL.FEEDS}
          element={
            <ProtectedRoute>
              <MainLayout>
                <FeedsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SOCIAL.SUPER_FEEDS}
          element={
            <ProtectedRoute>
              <MainLayout>
                <FeedsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SOCIAL.ACTIVITY_LOGS}
          element={
            <ProtectedRoute>
              <MainLayout>
                <ActivityLogsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SOCIAL.SUPPORT}
          element={
            <ProtectedRoute>
              <MainLayout>
                <SupportList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Master Accounts Routes */}
        <Route
          path={ROUTES.MASTER_ACCOUNTS.INSTITUTE_ACCOUNTS}
          element={
            <ProtectedRoute>
              <MainLayout>
                <InstituteAccountsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/master-accounts/institute/create"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateInstituteAccount />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MASTER_ACCOUNTS.CATEGORIES}
          element={
            <ProtectedRoute>
              <MainLayout>
                <CategoriesList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/master-accounts/categories/create"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateCategory />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MASTER_ACCOUNTS.WALLETS}
          element={
            <ProtectedRoute>
              <MainLayout>
                <WalletsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/master-accounts/wallets/create"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateWallet />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MASTER_ACCOUNTS.LEDGERS}
          element={
            <ProtectedRoute>
              <MainLayout>
                <LedgersList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/master-accounts/ledgers/create"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateLedger />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MASTER_ACCOUNTS.LEDGER_ITEMS}
          element={
            <ProtectedRoute>
              <MainLayout>
                <LedgerItemsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/master-accounts/ledger-items/create"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateLedgerItem />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Additional User Routes */}
        <Route
          path={ROUTES.USERS.SURVEY}
          element={
            <ProtectedRoute>
              <MainLayout>
                <SurveyUsersList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/survey/create"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateSurveyUser />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/survey/:id/edit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <EditSurveyUser />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/survey/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <UserDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.USERS.INSTITUTE}
          element={
            <ProtectedRoute>
              <MainLayout>
                <InstituteUsersList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/institute/create"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateInstituteUser />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/institute/:id/edit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <EditInstituteUser />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/institute/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <UserDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute superAdminOnly>
              <MainLayout>
                <AllUsersList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users/create"
          element={
            <ProtectedRoute superAdminOnly>
              <MainLayout>
                <SelectUserType />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users/:id"
          element={
            <ProtectedRoute superAdminOnly>
              <MainLayout>
                <UserDetail />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users/:id/edit"
          element={
            <ProtectedRoute superAdminOnly>
              <MainLayout>
                <EditMahallUser />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Additional Family Routes */}
        <Route
          path={ROUTES.FAMILIES.UNAPPROVED}
          element={
            <ProtectedRoute>
              <MainLayout>
                <UnapprovedFamiliesList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* Notifications Routes */}
        <Route
          path={ROUTES.NOTIFICATIONS.INDIVIDUAL}
          element={
            <ProtectedRoute>
              <MainLayout>
                <NotificationsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.NOTIFICATIONS.COLLECTION}
          element={
            <ProtectedRoute>
              <MainLayout>
                <NotificationsList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.NOTIFICATIONS.SEND}
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'mahall']}>
              <MainLayout>
                <SendNotification />
              </MainLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
