import { ROUTES } from '@/constants/routes';
import TenantsList from '@/features/admin/pages/TenantsList';
import CreateTenant from '@/features/admin/pages/CreateTenant';
import TenantDetails from '@/features/admin/pages/TenantDetails';
import EditTenant from '@/features/admin/pages/EditTenant';
import MahallMain from '@/features/admin/pages/MahallMain';
import MahallUsersList from '@/features/users/pages/MahallUsersList';
import CreateMahallUser from '@/features/users/pages/CreateMahallUser';
import EditMahallUser from '@/features/users/pages/EditMahallUser';
import UserDetail from '@/features/users/pages/UserDetail';
import SurveyUsersList from '@/features/users/pages/SurveyUsersList';
import CreateSurveyUser from '@/features/users/pages/CreateSurveyUser';
import EditSurveyUser from '@/features/users/pages/EditSurveyUser';
import InstituteUsersList from '@/features/users/pages/InstituteUsersList';
import CreateInstituteUser from '@/features/users/pages/CreateInstituteUser';
import EditInstituteUser from '@/features/users/pages/EditInstituteUser';
import AllUsersList from '@/features/users/pages/AllUsersList';
import SelectUserType from '@/features/users/pages/SelectUserType';
import { route, superAdminRoute } from './routeHelpers';

export const adminRoutes = [
  // Tenants (super admin only)
  superAdminRoute('/admin/tenants', <TenantsList />),
  superAdminRoute('/admin/tenants/create', <CreateTenant />),
  superAdminRoute('/admin/tenants/:id', <TenantDetails />),
  superAdminRoute('/admin/tenants/:id/edit', <EditTenant />),

  // Mahall main
  route(ROUTES.MAHALL_MAIN, <MahallMain />),

  // Mahall users
  route(ROUTES.USERS.MAHALL, <MahallUsersList />),
  route(ROUTES.USERS.CREATE_MAHALL, <CreateMahallUser />),
  route('/users/mahall/:id/edit', <EditMahallUser />),
  route('/users/mahall/:id', <UserDetail />),

  // Survey users
  route(ROUTES.USERS.SURVEY, <SurveyUsersList />),
  route('/users/survey/create', <CreateSurveyUser />),
  route('/users/survey/:id/edit', <EditSurveyUser />),
  route('/users/survey/:id', <UserDetail />),

  // Institute users
  route(ROUTES.USERS.INSTITUTE, <InstituteUsersList />),
  route('/users/institute/create', <CreateInstituteUser />),
  route('/users/institute/:id/edit', <EditInstituteUser />),
  route('/users/institute/:id', <UserDetail />),

  // All users (super admin only)
  superAdminRoute('/admin/users', <AllUsersList />),
  superAdminRoute('/admin/users/create', <SelectUserType />),
  superAdminRoute('/admin/users/:id', <UserDetail />),
  superAdminRoute('/admin/users/:id/edit', <EditMahallUser />),
];
