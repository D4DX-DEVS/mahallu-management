import { ROUTES } from '@/constants/routes';
import MemberOverview from '@/features/member-portal/pages/MemberOverview';
import MemberPortalVarisangyaPage from '@/features/member-portal/pages/MemberVarisangyaPage';
import MemberNOCRequest from '@/features/member-portal/pages/MemberNOCRequest';
import MemberNOCList from '@/features/member-portal/pages/MemberNOCList';
import MemberPayments from '@/features/member-portal/pages/MemberPayments';
import MemberNikahRequest from '@/features/member-portal/pages/MemberNikahRequest';
import MemberDeathRequest from '@/features/member-portal/pages/MemberDeathRequest';
import MemberRequests from '@/features/member-portal/pages/MemberRequests';
import MemberCertificates from '@/features/member-portal/pages/MemberCertificates';
import MemberProfile from '@/features/member-portal/pages/MemberProfile';
import MemberFamily from '@/features/member-portal/pages/MemberFamily';
import { route, AppRole } from './routeHelpers';

const memberOnly: { allowedRoles: AppRole[] } = { allowedRoles: ['member'] };

export const memberRoutes = [
  route(ROUTES.MEMBER.OVERVIEW, <MemberOverview />, memberOnly),
  route(ROUTES.MEMBER.VARISANGYA, <MemberPortalVarisangyaPage />, memberOnly),
  route(ROUTES.MEMBER.NOC_REQUEST, <MemberNOCRequest />, memberOnly),
  route(ROUTES.MEMBER.NOC_LIST, <MemberNOCList />, memberOnly),
  route(ROUTES.MEMBER.PAYMENTS, <MemberPayments />, memberOnly),
  route(ROUTES.MEMBER.NIKAH_REQUEST, <MemberNikahRequest />, memberOnly),
  route(ROUTES.MEMBER.DEATH_REQUEST, <MemberDeathRequest />, memberOnly),
  route(ROUTES.MEMBER.REQUESTS, <MemberRequests />, memberOnly),
  route(ROUTES.MEMBER.CERTIFICATES, <MemberCertificates />, memberOnly),
  route(ROUTES.MEMBER.PROFILE, <MemberProfile />, memberOnly),
  route(ROUTES.MEMBER.FAMILY, <MemberFamily />, memberOnly),
];
