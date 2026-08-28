import { ROUTES } from '@/constants/routes';
import AreaReport from '@/features/reports/pages/AreaReport';
import BloodBankReport from '@/features/reports/pages/BloodBankReport';
import OrphansReport from '@/features/reports/pages/OrphansReport';
import BannersList from '@/features/social/pages/BannersList';
import CreateBanner from '@/features/social/pages/CreateBanner';
import EditBanner from '@/features/social/pages/EditBanner';
import FeedsList from '@/features/social/pages/FeedsList';
import CreateFeed from '@/features/social/pages/CreateFeed';
import ActivityLogsList from '@/features/social/pages/ActivityLogsList';
import SupportList from '@/features/social/pages/SupportList';
import CreateSupport from '@/features/social/pages/CreateSupport';
import SupportDetail from '@/features/social/pages/SupportDetail';
import NotificationsList from '@/features/notifications/pages/NotificationsList';
import SendNotification from '@/features/notifications/pages/SendNotification';
import { route, AppRole } from './routeHelpers';

const adminOnly: { allowedRoles: AppRole[] } = { allowedRoles: ['super_admin', 'mahall'] };

export const serviceRoutes = [
  route(ROUTES.REPORTS.AREA, <AreaReport />),
  route(ROUTES.REPORTS.BLOOD_BANK, <BloodBankReport />),
  route(ROUTES.REPORTS.ORPHANS, <OrphansReport />),

  route(ROUTES.SOCIAL.CREATE_BANNER, <CreateBanner />),
  route(ROUTES.SOCIAL.EDIT_BANNER, <EditBanner />),
  route(ROUTES.SOCIAL.BANNERS, <BannersList />),
  route(ROUTES.SOCIAL.CREATE_FEED, <CreateFeed />),
  route(ROUTES.SOCIAL.FEEDS, <FeedsList />),
  route(ROUTES.SOCIAL.SUPER_FEEDS, <FeedsList />),
  route(ROUTES.SOCIAL.ACTIVITY_LOGS, <ActivityLogsList />),
  route(ROUTES.SOCIAL.CREATE_SUPPORT, <CreateSupport />),
  route(ROUTES.SOCIAL.SUPPORT_DETAIL(':id'), <SupportDetail />),
  route(ROUTES.SOCIAL.SUPPORT, <SupportList />),

  route(ROUTES.NOTIFICATIONS.INDIVIDUAL, <NotificationsList />),
  route(ROUTES.NOTIFICATIONS.COLLECTION, <NotificationsList />),
  route(ROUTES.NOTIFICATIONS.SEND, <SendNotification />, adminOnly),
];
