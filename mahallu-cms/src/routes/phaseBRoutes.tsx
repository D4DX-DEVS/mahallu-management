import ZakatSummary from '@/features/zakat/pages/ZakatSummary';
import BeneficiariesList from '@/features/zakat/pages/BeneficiariesList';
import BeneficiaryCreate from '@/features/zakat/pages/BeneficiaryCreate';
import BeneficiaryEdit from '@/features/zakat/pages/BeneficiaryEdit';
import DistributionsList from '@/features/zakat/pages/DistributionsList';
import DistributionCreate from '@/features/zakat/pages/DistributionCreate';
import LoansList from '@/features/loans/pages/LoansList';
import LoanCreate from '@/features/loans/pages/LoanCreate';
import LoanDetail from '@/features/loans/pages/LoanDetail';
import ReliefList from '@/features/loans/pages/ReliefList';
import ReliefCreate from '@/features/loans/pages/ReliefCreate';
import ReliefDetail from '@/features/loans/pages/ReliefDetail';
import ClassesList from '@/features/education/pages/ClassesList';
import ClassCreate from '@/features/education/pages/ClassCreate';
import ClassEdit from '@/features/education/pages/ClassEdit';
import ClassDetail from '@/features/education/pages/ClassDetail';
import AttendanceSheet from '@/features/education/pages/AttendanceSheet';
import ExamsList from '@/features/education/pages/ExamsList';
import ExamCreate from '@/features/education/pages/ExamCreate';
import ExamDetail from '@/features/education/pages/ExamDetail';
import ScholarshipsList from '@/features/education/pages/ScholarshipsList';
import ScholarshipCreate from '@/features/education/pages/ScholarshipCreate';
import AwardsList from '@/features/education/pages/AwardsList';
import AwardCreate from '@/features/education/pages/AwardCreate';
import AcademicSupportList from '@/features/education/pages/AcademicSupportList';
import AcademicSupportCreate from '@/features/education/pages/AcademicSupportCreate';
import AcademicSupportDetail from '@/features/education/pages/AcademicSupportDetail';
import EducationReport from '@/features/education/pages/EducationReport';
import EmployersList from '@/features/employment/pages/EmployersList';
import EmployerCreate from '@/features/employment/pages/EmployerCreate';
import EmployerEdit from '@/features/employment/pages/EmployerEdit';
import VacanciesList from '@/features/employment/pages/VacanciesList';
import VacancyCreate from '@/features/employment/pages/VacancyCreate';
import VacancyDetail from '@/features/employment/pages/VacancyDetail';
import TrainingsList from '@/features/employment/pages/TrainingsList';
import TrainingCreate from '@/features/employment/pages/TrainingCreate';
import TrainingDetail from '@/features/employment/pages/TrainingDetail';
import VolunteersList from '@/features/volunteers/pages/VolunteersList';
import VolunteerCreate from '@/features/volunteers/pages/VolunteerCreate';
import VolunteerDetail from '@/features/volunteers/pages/VolunteerDetail';
import AssignmentsList from '@/features/volunteers/pages/AssignmentsList';
import AssignmentCreate from '@/features/volunteers/pages/AssignmentCreate';
import DoctorsDirectory from '@/features/health/pages/DoctorsDirectory';
import DoctorCreate from '@/features/health/pages/DoctorCreate';
import DoctorEdit from '@/features/health/pages/DoctorEdit';
import BloodDonors from '@/features/health/pages/BloodDonors';
import DonorCreate from '@/features/health/pages/DonorCreate';
import DonorEdit from '@/features/health/pages/DonorEdit';
import CampsList from '@/features/health/pages/CampsList';
import CampsCreate from '@/features/health/pages/CampsCreate';
import PalliativeCases from '@/features/health/pages/PalliativeCases';
import PatientSupport from '@/features/health/pages/PatientSupport';
import KhutbahSchedule from '@/features/religious/pages/KhutbahSchedule';
import KhutbahCreate from '@/features/religious/pages/KhutbahCreate';
import KhutbahEdit from '@/features/religious/pages/KhutbahEdit';
import KhateebsList from '@/features/religious/pages/KhateebsList';
import CounsellingList from '@/features/counselling/pages/CounsellingList';
import CounsellingDetail from '@/features/counselling/pages/CounsellingDetail';
import CounsellingCreate from '@/features/counselling/pages/CounsellingCreate';
import DisputesList from '@/features/counselling/pages/DisputesList';
import DisputesCreate from '@/features/counselling/pages/DisputesCreate';
import DisputesDetail from '@/features/counselling/pages/DisputesDetail';
import InheritanceList from '@/features/counselling/pages/InheritanceList';
import InheritanceCreate from '@/features/counselling/pages/InheritanceCreate';
import InheritanceDetail from '@/features/counselling/pages/InheritanceDetail';
import MarriageAssistanceList from '@/features/registrations/pages/MarriageAssistanceList';
import CreateMarriageAssistance from '@/features/registrations/pages/CreateMarriageAssistance';
import { CemeteriesList } from '@/features/cemetery/pages/CemeteriesList';
import { CemeteryForm } from '@/features/cemetery/pages/CemeteryForm';
import { CemeteryDetail } from '@/features/cemetery/pages/CemeteryDetail';
import { GraveForm } from '@/features/cemetery/pages/GraveForm';
import BooksList from '@/features/library/pages/BooksList';
import BookForm from '@/features/library/pages/BookForm';
import IssuesList from '@/features/library/pages/IssuesList';
import IssueCreate from '@/features/library/pages/IssueCreate';
import ProjectsList from '@/features/development/pages/ProjectsList';
import ProjectCreate from '@/features/development/pages/ProjectCreate';
import ProjectEdit from '@/features/development/pages/ProjectEdit';
import ProjectDetail from '@/features/development/pages/ProjectDetail';
import WelfareReport from '@/features/reports/pages/WelfareReport';
import CommunityReport from '@/features/reports/pages/CommunityReport';
import AnnualReport from '@/features/reports/pages/AnnualReport';
import DevelopmentIndex from '@/features/reports/pages/DevelopmentIndex';
import Assistant from '@/features/assistant/pages/Assistant';
import Security from '@/features/admin/pages/Security';
import { route, AppRole } from './routeHelpers';

const mahallOnly: { allowedRoles: AppRole[] } = { allowedRoles: ['super_admin', 'mahall'] };
const educationRoles: { allowedRoles: AppRole[] } = {
  allowedRoles: ['super_admin', 'mahall', 'institute'],
};

const staffRoles: { allowedRoles: AppRole[] } = {
  allowedRoles: ['super_admin', 'mahall', 'survey', 'institute'],
};

/** Phase B modules. */
export const phaseBRoutes = [
  // Zakat beneficiaries & distribution (B1)
  route('/zakat', <ZakatSummary />, mahallOnly),
  route('/zakat/beneficiaries', <BeneficiariesList />, mahallOnly),
  route('/zakat/beneficiaries/create', <BeneficiaryCreate />, mahallOnly),
  route('/zakat/beneficiaries/:id', <BeneficiaryEdit />, mahallOnly),
  route('/zakat/distributions', <DistributionsList />, mahallOnly),
  route('/zakat/distributions/create', <DistributionCreate />, mahallOnly),

  // Qard Hasan loans & emergency relief (B2)
  route('/loans', <LoansList />, mahallOnly),
  route('/loans/create', <LoanCreate />, mahallOnly),
  route('/loans/:id', <LoanDetail />, mahallOnly),
  route('/relief', <ReliefList />, mahallOnly),
  route('/relief/create', <ReliefCreate />, mahallOnly),
  route('/relief/:id', <ReliefDetail />, mahallOnly),

  // Madrasa classes & students (B3.1) - institute staff run their own classes
  route('/education', <ClassesList />, educationRoles),
  route('/education/classes/create', <ClassCreate />, educationRoles),
  route('/education/classes/:id', <ClassDetail />, educationRoles),
  route('/education/classes/:id/edit', <ClassEdit />, educationRoles),

  // Attendance & exams (B3.2)
  route('/education/classes/:classId/attendance', <AttendanceSheet />, educationRoles),
  route('/education/classes/:classId/exams', <ExamsList />, educationRoles),
  route('/education/exams/create', <ExamCreate />, educationRoles),
  route('/education/exams/:id', <ExamDetail />, educationRoles),

  // Scholarships & academic support (B3.3)
  route('/education/scholarships', <ScholarshipsList />, mahallOnly),
  route('/education/scholarships/create', <ScholarshipCreate />, mahallOnly),
  route('/education/scholarships/:scholarshipId', <AwardsList />, mahallOnly),
  route('/education/scholarships/:scholarshipId/awards', <AwardsList />, mahallOnly),
  route('/education/scholarships/:scholarshipId/awards/create', <AwardCreate />, mahallOnly),
  route('/education/support', <AcademicSupportList />, mahallOnly),
  route('/education/support/create', <AcademicSupportCreate />, mahallOnly),
  route('/education/support/:id', <AcademicSupportDetail />, mahallOnly),
  route('/education/report', <EducationReport />, educationRoles),

  // Employment & economy (B4)
  route('/employment/employers', <EmployersList />, mahallOnly),
  route('/employment/employers/create', <EmployerCreate />, mahallOnly),
  route('/employment/employers/:id', <EmployerEdit />, mahallOnly),
  route('/employment/vacancies', <VacanciesList />, mahallOnly),
  route('/employment/vacancies/create', <VacancyCreate />, mahallOnly),
  route('/employment/vacancies/:id', <VacancyDetail />, mahallOnly),
  route('/employment/trainings', <TrainingsList />, mahallOnly),
  route('/employment/trainings/create', <TrainingCreate />, mahallOnly),
  route('/employment/trainings/:id', <TrainingDetail />, mahallOnly),

  // Volunteer wing (B5)
  route('/volunteers', <VolunteersList />, mahallOnly),
  route('/volunteers/create', <VolunteerCreate />, mahallOnly),
  route('/volunteers/:id', <VolunteerDetail />, mahallOnly),
  route('/volunteers/:id/edit', <VolunteerDetail />, mahallOnly),
  route('/volunteers/assignments', <AssignmentsList />, mahallOnly),
  route('/volunteers/assignments/create', <AssignmentCreate />, mahallOnly),
  route('/volunteers/assignments/:id/edit', <AssignmentCreate />, mahallOnly),

  // Health & Medical (B6)
  route('/health/doctors', <DoctorsDirectory />, mahallOnly),
  route('/health/doctors/create', <DoctorCreate />, mahallOnly),
  route('/health/doctors/:id/edit', <DoctorEdit />, mahallOnly),
  route('/health/donors', <BloodDonors />, mahallOnly),
  route('/health/donors/create', <DonorCreate />, mahallOnly),
  route('/health/donors/:id/edit', <DonorEdit />, mahallOnly),
  route('/health/camps', <CampsList />, mahallOnly),
  route('/health/camps/create', <CampsCreate />, mahallOnly),
  route('/health/palliative', <PalliativeCases />, mahallOnly),
  route('/health/patient-support', <PatientSupport />, mahallOnly),

  // Khutbah & Imam management (B7)
  route('/religious/khutbahs', <KhutbahSchedule />, mahallOnly),
  route('/religious/khutbahs/create', <KhutbahCreate />, mahallOnly),
  route('/religious/khutbahs/:id/edit', <KhutbahEdit />, mahallOnly),
  route('/religious/khateebs', <KhateebsList />, mahallOnly),

  // Counselling & Maslahat (B8) - Restricted access
  route('/counselling', <CounsellingList />, mahallOnly),
  route('/counselling/create', <CounsellingCreate />, mahallOnly),
  route('/counselling/:id', <CounsellingDetail />, mahallOnly),
  route('/counselling/:id/edit', <CounsellingDetail />, mahallOnly),
  route('/maslahat', <DisputesList />, mahallOnly),
  route('/maslahat/create', <DisputesCreate />, mahallOnly),
  route('/maslahat/:id', <DisputesDetail />, mahallOnly),
  route('/inheritance', <InheritanceList />, mahallOnly),
  route('/inheritance/create', <InheritanceCreate />, mahallOnly),
  route('/inheritance/:id', <InheritanceDetail />, mahallOnly),

  // Marriage services (B9)
  route('/registrations/marriage-assistance', <MarriageAssistanceList />, mahallOnly),
  route('/registrations/marriage-assistance/create', <CreateMarriageAssistance />, mahallOnly),

  // Cemetery (B10)
  route('/cemetery', <CemeteriesList />, mahallOnly),
  route('/cemetery/create', <CemeteryForm />, mahallOnly),
  route('/cemetery/:id', <CemeteryDetail />, mahallOnly),
  route('/cemetery/:id/edit', <CemeteryForm />, mahallOnly),
  route('/cemetery/:cemeteryId/grave/create', <GraveForm />, mahallOnly),
  route('/cemetery/:cemeteryId/grave/:graveId/edit', <GraveForm />, mahallOnly),

  // Library (B11)
  route('/library/books', <BooksList />, mahallOnly),
  route('/library/books/create', <BookForm />, mahallOnly),
  route('/library/books/:id/edit', <BookForm isEdit />, mahallOnly),
  route('/library/issues', <IssuesList />, mahallOnly),
  route('/library/issues/create', <IssueCreate />, mahallOnly),

  // Development Projects (B12)
  route('/development', <ProjectsList />, mahallOnly),
  route('/development/create', <ProjectCreate />, mahallOnly),
  route('/development/:id', <ProjectDetail />, mahallOnly),
  route('/development/:id/edit', <ProjectEdit />, mahallOnly),

  // Phase B Reports
  route('/reports/welfare', <WelfareReport />, mahallOnly),
  route('/reports/community', <CommunityReport />, mahallOnly),

  // Phase C Reports
  route('/reports/annual', <AnnualReport />, mahallOnly),
  route('/reports/development-index', <DevelopmentIndex />, mahallOnly),

  // AI assistant (C4)
  route('/assistant', <Assistant />, mahallOnly),

  // Security: 2FA + own access history (C5) — every staff role manages its own account
  route('/settings/security', <Security />, staffRoles),
];
