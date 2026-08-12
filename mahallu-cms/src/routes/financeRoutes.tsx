import { ROUTES } from '@/constants/routes';
import SalaryList from '@/features/salary/pages/SalaryList';
import CreateSalaryPayment from '@/features/salary/pages/CreateSalaryPayment';
import SalaryDetail from '@/features/salary/pages/SalaryDetail';
import SalarySummary from '@/features/salary/pages/SalarySummary';
import DayBook from '@/features/accounting/pages/DayBook';
import TrialBalance from '@/features/accounting/pages/TrialBalance';
import BalanceSheet from '@/features/accounting/pages/BalanceSheet';
import LedgerReport from '@/features/accounting/pages/LedgerReport';
import IncomeExpenditure from '@/features/accounting/pages/IncomeExpenditure';
import ConsolidatedReport from '@/features/accounting/pages/ConsolidatedReport';
import PettyCashList from '@/features/accounting/pages/PettyCashList';
import PettyCashDetail from '@/features/accounting/pages/PettyCashDetail';
import CollectionsOverview from '@/features/collectibles/pages/CollectionsOverview';
import VarisangyaList from '@/features/collectibles/pages/VarisangyaList';
import CreateVarisangya from '@/features/collectibles/pages/CreateVarisangya';
import FamilyVarisangyaPage from '@/features/collectibles/familyVarisangya/FamilyVarisangyaPage';
import MemberVarisangyaPage from '@/features/collectibles/memberVarisangya/MemberVarisangyaPage';
import ZakatList from '@/features/collectibles/pages/ZakatList';
import CreateZakat from '@/features/collectibles/pages/CreateZakat';
import LiveDues from '@/features/collectibles/pages/LiveDues';
import InstituteAccountsList from '@/features/master-accounts/pages/InstituteAccountsList';
import CreateInstituteAccount from '@/features/master-accounts/pages/CreateInstituteAccount';
import CategoriesList from '@/features/master-accounts/pages/CategoriesList';
import CreateCategory from '@/features/master-accounts/pages/CreateCategory';
import WalletsList from '@/features/master-accounts/pages/WalletsList';
import CreateWallet from '@/features/master-accounts/pages/CreateWallet';
import LedgersList from '@/features/master-accounts/pages/LedgersList';
import CreateLedger from '@/features/master-accounts/pages/CreateLedger';
import LedgerItemsList from '@/features/master-accounts/pages/LedgerItemsList';
import CreateLedgerItem from '@/features/master-accounts/pages/CreateLedgerItem';
import MahalluAccountsList from '@/features/mahallu-finance/pages/MahalluAccountsList';
import CreateMahalluAccount from '@/features/mahallu-finance/pages/CreateMahalluAccount';
import EditMahalluAccount from '@/features/mahallu-finance/pages/EditMahalluAccount';
import MahalluLedgersList from '@/features/mahallu-finance/pages/MahalluLedgersList';
import CreateMahalluLedger from '@/features/mahallu-finance/pages/CreateMahalluLedger';
import EditMahalluLedger from '@/features/mahallu-finance/pages/EditMahalluLedger';
import MahalluCategoriesList from '@/features/mahallu-finance/pages/MahalluCategoriesList';
import CreateMahalluCategory from '@/features/mahallu-finance/pages/CreateMahalluCategory';
import EditMahalluCategory from '@/features/mahallu-finance/pages/EditMahalluCategory';
import MahalluLedgerItemsList from '@/features/mahallu-finance/pages/MahalluLedgerItemsList';
import CreateMahalluLedgerItem from '@/features/mahallu-finance/pages/CreateMahalluLedgerItem';
import MahalluDayBook from '@/features/mahallu-finance/pages/MahalluDayBook';
import MahalluTrialBalance from '@/features/mahallu-finance/pages/MahalluTrialBalance';
import MahalluBalanceSheet from '@/features/mahallu-finance/pages/MahalluBalanceSheet';
import MahalluLedgerReport from '@/features/mahallu-finance/pages/MahalluLedgerReport';
import MahalluIncomeExpenditure from '@/features/mahallu-finance/pages/MahalluIncomeExpenditure';
import MahalluCombinedReport from '@/features/mahallu-finance/pages/MahalluCombinedReport';
import { route, AppRole } from './routeHelpers';

const mf: { allowedRoles: AppRole[] } = { allowedRoles: ['super_admin', 'mahall'] };

export const financeRoutes = [
  route(ROUTES.SALARY.LIST, <SalaryList />),
  route(ROUTES.SALARY.CREATE, <CreateSalaryPayment />),
  route(ROUTES.SALARY.SUMMARY, <SalarySummary />),
  route(ROUTES.SALARY.DETAIL(':id'), <SalaryDetail />),

  route(ROUTES.ACCOUNTING.DAY_BOOK, <DayBook />),
  route(ROUTES.ACCOUNTING.TRIAL_BALANCE, <TrialBalance />),
  route(ROUTES.ACCOUNTING.BALANCE_SHEET, <BalanceSheet />),
  route(ROUTES.ACCOUNTING.LEDGER_REPORT, <LedgerReport />),
  route(ROUTES.ACCOUNTING.INCOME_EXPENDITURE, <IncomeExpenditure />),
  route(ROUTES.ACCOUNTING.CONSOLIDATED, <ConsolidatedReport />),
  route(ROUTES.ACCOUNTING.PETTY_CASH, <PettyCashList />),
  route('/petty-cash/:id', <PettyCashDetail />),

  route(ROUTES.COLLECTIBLES.OVERVIEW, <CollectionsOverview />),
  route(ROUTES.COLLECTIBLES.VARISANGYA, <VarisangyaList />),
  route('/collectibles/varisangya/create', <CreateVarisangya />),
  route(ROUTES.COLLECTIBLES.DUES, <LiveDues />),
  route(ROUTES.COLLECTIBLES.ZAKAT, <ZakatList />),
  route('/collectibles/zakat/create', <CreateZakat />),
  route(ROUTES.COLLECTIBLES.FAMILY_VARISANGYA.BASE, <FamilyVarisangyaPage />),
  route(ROUTES.COLLECTIBLES.MEMBER_VARISANGYA.BASE, <MemberVarisangyaPage />),

  route(ROUTES.MASTER_ACCOUNTS.INSTITUTE_ACCOUNTS, <InstituteAccountsList />),
  route('/master-accounts/institute/create', <CreateInstituteAccount />),
  route(ROUTES.MASTER_ACCOUNTS.CATEGORIES, <CategoriesList />),
  route('/master-accounts/categories/create', <CreateCategory />),
  route(ROUTES.MASTER_ACCOUNTS.WALLETS, <WalletsList />),
  route('/master-accounts/wallets/create', <CreateWallet />),
  route(ROUTES.MASTER_ACCOUNTS.LEDGERS, <LedgersList />),
  route('/master-accounts/ledgers/create', <CreateLedger />),
  route(ROUTES.MASTER_ACCOUNTS.LEDGER_ITEMS, <LedgerItemsList />),
  route('/master-accounts/ledger-items/create', <CreateLedgerItem />),

  route(ROUTES.MAHALLU_FINANCE.ACCOUNTS, <MahalluAccountsList />, mf),
  route(ROUTES.MAHALLU_FINANCE.ACCOUNTS_CREATE, <CreateMahalluAccount />, mf),
  route('/mahallu-finance/accounts/:id/edit', <EditMahalluAccount />, mf),
  route(ROUTES.MAHALLU_FINANCE.LEDGERS, <MahalluLedgersList />, mf),
  route(ROUTES.MAHALLU_FINANCE.LEDGERS_CREATE, <CreateMahalluLedger />, mf),
  route('/mahallu-finance/ledgers/:id/edit', <EditMahalluLedger />, mf),
  route(ROUTES.MAHALLU_FINANCE.CATEGORIES, <MahalluCategoriesList />, mf),
  route(ROUTES.MAHALLU_FINANCE.CATEGORIES_CREATE, <CreateMahalluCategory />, mf),
  route('/mahallu-finance/categories/:id/edit', <EditMahalluCategory />, mf),
  route(ROUTES.MAHALLU_FINANCE.LEDGER_ITEMS, <MahalluLedgerItemsList />, mf),
  route(ROUTES.MAHALLU_FINANCE.LEDGER_ITEMS_CREATE, <CreateMahalluLedgerItem />, mf),
  route(ROUTES.MAHALLU_FINANCE.DAY_BOOK, <MahalluDayBook />, mf),
  route(ROUTES.MAHALLU_FINANCE.TRIAL_BALANCE, <MahalluTrialBalance />, mf),
  route(ROUTES.MAHALLU_FINANCE.BALANCE_SHEET, <MahalluBalanceSheet />, mf),
  route(ROUTES.MAHALLU_FINANCE.LEDGER_REPORT, <MahalluLedgerReport />, mf),
  route(ROUTES.MAHALLU_FINANCE.INCOME_EXPENDITURE, <MahalluIncomeExpenditure />, mf),
  route(ROUTES.MAHALLU_FINANCE.COMBINED, <MahalluCombinedReport />, mf),
];
