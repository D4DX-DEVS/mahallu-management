import { ROUTES } from '@/constants/routes';
import Dashboard from '@/features/dashboard/pages/Dashboard';
import FamiliesList from '@/features/families/pages/FamiliesList';
import CreateFamily from '@/features/families/pages/CreateFamily';
import EditFamily from '@/features/families/pages/EditFamily';
import FamilyDetail from '@/features/families/pages/FamilyDetail';
import UnapprovedFamiliesList from '@/features/families/pages/UnapprovedFamiliesList';
import MembersList from '@/features/members/pages/MembersList';
import CreateMember from '@/features/members/pages/CreateMember';
import EditMember from '@/features/members/pages/EditMember';
import MemberDetail from '@/features/members/pages/MemberDetail';
import InstitutesList from '@/features/institutes/pages/InstitutesList';
import CreateInstitute from '@/features/institutes/pages/CreateInstitute';
import EditInstitute from '@/features/institutes/pages/EditInstitute';
import InstituteDetail from '@/features/institutes/pages/InstituteDetail';
import ProgramsList from '@/features/programs/pages/ProgramsList';
import CreateProgram from '@/features/programs/pages/CreateProgram';
import EditProgram from '@/features/programs/pages/EditProgram';
import ProgramDetail from '@/features/programs/pages/ProgramDetail';
import EmployeesList from '@/features/employees/pages/EmployeesList';
import CreateEmployee from '@/features/employees/pages/CreateEmployee';
import EmployeeDetail from '@/features/employees/pages/EmployeeDetail';
import EditEmployee from '@/features/employees/pages/EditEmployee';
import CommitteesList from '@/features/committees/pages/CommitteesList';
import CreateCommittee from '@/features/committees/pages/CreateCommittee';
import CommitteeDetail from '@/features/committees/pages/CommitteeDetail';
import EditCommittee from '@/features/committees/pages/EditCommittee';
import MeetingsList from '@/features/committees/pages/MeetingsList';
import CreateMeeting from '@/features/committees/pages/CreateMeeting';
import MeetingDetail from '@/features/committees/pages/MeetingDetail';
import AssetsList from '@/features/assets/pages/AssetsList';
import CreateAsset from '@/features/assets/pages/CreateAsset';
import EditAsset from '@/features/assets/pages/EditAsset';
import AssetDetail from '@/features/assets/pages/AssetDetail';
import NikahRegistrationsList from '@/features/registrations/pages/NikahRegistrationsList';
import NikahRegistrationDetail from '@/features/registrations/pages/NikahRegistrationDetail';
import CreateNikahRegistration from '@/features/registrations/pages/CreateNikahRegistration';
import EditNikahRegistration from '@/features/registrations/pages/EditNikahRegistration';
import DeathRegistrationsList from '@/features/registrations/pages/DeathRegistrationsList';
import DeathRegistrationDetail from '@/features/registrations/pages/DeathRegistrationDetail';
import CreateDeathRegistration from '@/features/registrations/pages/CreateDeathRegistration';
import EditDeathRegistration from '@/features/registrations/pages/EditDeathRegistration';
import NOCList from '@/features/registrations/pages/NOCList';
import NOCDetail from '@/features/registrations/pages/NOCDetail';
import CreateNOC from '@/features/registrations/pages/CreateNOC';
import EditNOC from '@/features/registrations/pages/EditNOC';
import { route } from './routeHelpers';

export const communityRoutes = [
  route(ROUTES.DASHBOARD, <Dashboard />, {
    allowedRoles: ['super_admin', 'mahall', 'survey', 'institute'],
  }),

  // Families
  route(ROUTES.FAMILIES.LIST, <FamiliesList />),
  route(ROUTES.FAMILIES.CREATE, <CreateFamily />),
  route(ROUTES.FAMILIES.UNAPPROVED, <UnapprovedFamiliesList />),
  route('/families/:id/edit', <EditFamily />),
  route(ROUTES.FAMILIES.DETAIL(':id'), <FamilyDetail />),

  // Members
  route(ROUTES.MEMBERS.LIST, <MembersList />),
  route(ROUTES.MEMBERS.CREATE, <CreateMember />),
  route('/members/:id/edit', <EditMember />),
  route(ROUTES.MEMBERS.DETAIL(':id'), <MemberDetail />),

  // Institutes
  route(ROUTES.INSTITUTES.LIST, <InstitutesList />),
  route(ROUTES.INSTITUTES.CREATE, <CreateInstitute />),
  route(ROUTES.INSTITUTES.DETAIL(':id'), <InstituteDetail />),
  route('/institutes/:id/edit', <EditInstitute />),

  // Programs
  route(ROUTES.PROGRAMS.LIST, <ProgramsList />),
  route(ROUTES.PROGRAMS.CREATE, <CreateProgram />),
  route(ROUTES.PROGRAMS.DETAIL(':id'), <ProgramDetail />),
  route('/programs/:id/edit', <EditProgram />),

  // Employees
  route(ROUTES.EMPLOYEES.LIST, <EmployeesList />),
  route(ROUTES.EMPLOYEES.CREATE, <CreateEmployee />),
  route(ROUTES.EMPLOYEES.DETAIL(':id'), <EmployeeDetail />),
  route(ROUTES.EMPLOYEES.EDIT(':id'), <EditEmployee />),

  // Committees & meetings
  route(ROUTES.COMMITTEES.LIST, <CommitteesList />),
  route('/committees/create', <CreateCommittee />),
  route(ROUTES.COMMITTEES.MEETINGS, <MeetingsList />),
  route('/committees/meetings/create', <CreateMeeting />),
  route('/committees/meetings/:id', <MeetingDetail />),
  route(ROUTES.COMMITTEES.DETAIL(':id'), <CommitteeDetail />),
  route('/committees/:id/edit', <EditCommittee />),
  route('/committees/:id/meetings', <MeetingsList />),

  // Assets
  route(ROUTES.ASSETS.LIST, <AssetsList />),
  route(ROUTES.ASSETS.CREATE, <CreateAsset />),
  route(ROUTES.ASSETS.DETAIL(':id'), <AssetDetail />),
  route(ROUTES.ASSETS.EDIT(':id'), <EditAsset />),

  // Registrations - Nikah
  route(ROUTES.REGISTRATIONS.NIKAH, <NikahRegistrationsList />),
  route('/registrations/nikah/create', <CreateNikahRegistration />),
  route('/registrations/nikah/:id', <NikahRegistrationDetail />),
  route('/registrations/nikah/:id/edit', <EditNikahRegistration />),

  // Registrations - Death
  route(ROUTES.REGISTRATIONS.DEATH, <DeathRegistrationsList />),
  route('/registrations/death/create', <CreateDeathRegistration />),
  route('/registrations/death/:id', <DeathRegistrationDetail />),
  route('/registrations/death/:id/edit', <EditDeathRegistration />),

  // Registrations - NOC
  route(ROUTES.REGISTRATIONS.NOC.COMMON, <NOCList />),
  route(ROUTES.REGISTRATIONS.NOC.NIKAH, <NOCList />),
  route('/registrations/noc/create', <CreateNOC />),
  route('/registrations/noc/:id', <NOCDetail />),
  route('/registrations/noc/:id/edit', <EditNOC />),
];
