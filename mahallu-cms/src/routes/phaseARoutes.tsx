import RegistersOverview from '@/features/registers/pages/RegistersOverview';
import RegisterList from '@/features/registers/pages/RegisterList';
import SurveyList from '@/features/survey/pages/SurveyList';
import SurveyDetail from '@/features/survey/pages/SurveyDetail';
import FacilitiesList from '@/features/survey/pages/FacilitiesList';
import SurveysList from '@/features/survey/pages/SurveysList';
import SurveyFormModal from '@/features/survey/pages/SurveyFormModal';
import SurveyOverview from '@/features/survey/pages/SurveyOverview';
import SurveyBuilder from '@/features/survey/pages/SurveyBuilder';
import SurveyFill from '@/features/survey/pages/SurveyFill';
import SubmissionDetail from '@/features/survey/pages/SubmissionDetail';
import ClustersList from '@/features/clusters/pages/ClustersList';
import ClusterDetail from '@/features/clusters/pages/ClusterDetail';
import SchemesList from '@/features/welfare/pages/SchemesList';
import ApplicationsList from '@/features/welfare/pages/ApplicationsList';
import ApplicationCreate from '@/features/welfare/pages/ApplicationCreate';
import ApplicationDetail from '@/features/welfare/pages/ApplicationDetail';
import MosquesList from '@/features/mosque/pages/MosquesList';
import MosqueDetail from '@/features/mosque/pages/MosqueDetail';
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

  // Surveys (A4): configurable survey forms, plus the demographic snapshots generated from live records
  route('/survey', <SurveysList />, surveyRoles),
  route('/survey/create', <SurveyFormModal />, mahallOnly, { label: 'New Survey' }),
  route('/survey/snapshots', <SurveyList />, surveyRoles, { label: 'Demographic Snapshots' }),
  route('/survey/snapshots/:id', <SurveyDetail />, surveyRoles),
  route('/survey/facilities', <FacilitiesList />, surveyRoles),
  route('/survey/:id', <SurveyOverview />, surveyRoles),
  route('/survey/:id/edit', <SurveyFormModal />, mahallOnly),
  route('/survey/:id/builder', <SurveyBuilder />, mahallOnly),
  route('/survey/:id/fill', <SurveyFill />, surveyRoles),
  route('/survey/:id/fill/:subId', <SurveyFill />, surveyRoles),
  route('/survey/:id/responses/:subId', <SubmissionDetail />, surveyRoles),

  // Clusters (A7)
  route('/clusters', <ClustersList />, surveyRoles),
  route('/clusters/:id', <ClusterDetail />, surveyRoles),

  // Welfare (A5)
  route('/welfare/schemes', <SchemesList />, mahallOnly),
  route('/welfare/applications', <ApplicationsList />, surveyRoles),
  route('/welfare/applications/create', <ApplicationCreate />, surveyRoles, { label: 'New Application' }),
  route('/welfare/applications/:id', <ApplicationDetail />, surveyRoles),

  // Mosque profile (A6)
  route('/mosque', <MosquesList />),
  route('/mosque/:id', <MosqueDetail />),

  // Demographics report (spec 34.1)
  route('/reports/demographics', <DemographicsReport />, surveyRoles),

  // Announcements (A9)
  route('/announcements', <AnnouncementsList />, mahallOnly),
  route('/announcements/create', <AnnouncementCreate />, mahallOnly, { label: 'New Announcement' }),
  route('/announcements/:id', <AnnouncementDetail />, mahallOnly),
];
