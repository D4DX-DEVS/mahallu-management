import RegistersOverview from '@/features/registers/pages/RegistersOverview';
import RegisterList from '@/features/registers/pages/RegisterList';
import SurveyList from '@/features/survey/pages/SurveyList';
import SurveyDetail from '@/features/survey/pages/SurveyDetail';
import FacilitiesList from '@/features/survey/pages/FacilitiesList';
import ClustersList from '@/features/clusters/pages/ClustersList';
import ClusterDetail from '@/features/clusters/pages/ClusterDetail';
import SchemesList from '@/features/welfare/pages/SchemesList';
import ApplicationsList from '@/features/welfare/pages/ApplicationsList';
import ApplicationCreate from '@/features/welfare/pages/ApplicationCreate';
import ApplicationDetail from '@/features/welfare/pages/ApplicationDetail';
import MosqueProfilePage from '@/features/mosque/pages/MosqueProfilePage';
import AnnouncementsList from '@/features/communication/pages/AnnouncementsList';
import AnnouncementCreate from '@/features/communication/pages/AnnouncementCreate';
import AnnouncementDetail from '@/features/communication/pages/AnnouncementDetail';
import DemographicsReport from '@/features/reports/pages/DemographicsReport';
import { route, AppRole } from './routeHelpers';

const surveyRoles: { allowedRoles: AppRole[] } = { allowedRoles: ['super_admin', 'mahall', 'survey'] };
const mahallOnly: { allowedRoles: AppRole[] } = { allowedRoles: ['super_admin', 'mahall'] };

/** Phase A modules: registers, survey, clusters, welfare, mosque, announcements. */
export const phaseARoutes = [
  // Community registers (A3)
  route('/registers', <RegistersOverview />, surveyRoles),
  route('/registers/:key', <RegisterList />, surveyRoles),

  // Survey and demographics (A4)
  route('/survey', <SurveyList />, surveyRoles),
  route('/survey/facilities', <FacilitiesList />, surveyRoles),
  route('/survey/:id', <SurveyDetail />, surveyRoles),

  // Clusters (A7)
  route('/clusters', <ClustersList />, surveyRoles),
  route('/clusters/:id', <ClusterDetail />, surveyRoles),

  // Welfare (A5)
  route('/welfare/schemes', <SchemesList />, mahallOnly),
  route('/welfare/applications', <ApplicationsList />, surveyRoles),
  route('/welfare/applications/create', <ApplicationCreate />, surveyRoles),
  route('/welfare/applications/:id', <ApplicationDetail />, surveyRoles),

  // Mosque profile (A6)
  route('/mosque', <MosqueProfilePage />),

  // Demographics report (spec 34.1)
  route('/reports/demographics', <DemographicsReport />, surveyRoles),

  // Announcements (A9)
  route('/announcements', <AnnouncementsList />, mahallOnly),
  route('/announcements/create', <AnnouncementCreate />, mahallOnly),
  route('/announcements/:id', <AnnouncementDetail />, mahallOnly),
];
