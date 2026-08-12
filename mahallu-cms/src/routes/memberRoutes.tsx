import { ROUTES } from '@/constants/routes';
import MemberOverview from '@/features/member-portal/pages/MemberOverview';
import MemberPortalVarisangyaPage from '@/features/member-portal/pages/MemberVarisangyaPage';
import MemberNOCRequest from '@/features/member-portal/pages/MemberNOCRequest';
import MemberNOCList from '@/features/member-portal/pages/MemberNOCList';
import MemberPayments from '@/features/member-portal/pages/MemberPayments';
import { route, AppRole } from './routeHelpers';

const memberOnly: { allowedRoles: AppRole[] } = { allowedRoles: ['member'] };

export const memberRoutes = [
  route(ROUTES.MEMBER.OVERVIEW, <MemberOverview />, memberOnly),
  route(ROUTES.MEMBER.VARISANGYA, <MemberPortalVarisangyaPage />, memberOnly),
  route(ROUTES.MEMBER.NOC_REQUEST, <MemberNOCRequest />, memberOnly),
  route(ROUTES.MEMBER.NOC_LIST, <MemberNOCList />, memberOnly),
  route(ROUTES.MEMBER.PAYMENTS, <MemberPayments />, memberOnly),
];
