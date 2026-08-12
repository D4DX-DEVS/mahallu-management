import ZakatSummary from '@/features/zakat/pages/ZakatSummary';
import BeneficiariesList from '@/features/zakat/pages/BeneficiariesList';
import BeneficiaryCreate from '@/features/zakat/pages/BeneficiaryCreate';
import DistributionsList from '@/features/zakat/pages/DistributionsList';
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
import { route, AppRole } from './routeHelpers';

const mahallOnly: { allowedRoles: AppRole[] } = { allowedRoles: ['super_admin', 'mahall'] };
const educationRoles: { allowedRoles: AppRole[] } = {
  allowedRoles: ['super_admin', 'mahall', 'institute'],
};

/** Phase B modules. */
export const phaseBRoutes = [
  // Zakat beneficiaries & distribution (B1)
  route('/zakat', <ZakatSummary />, mahallOnly),
  route('/zakat/beneficiaries', <BeneficiariesList />, mahallOnly),
  route('/zakat/beneficiaries/create', <BeneficiaryCreate />, mahallOnly),
  route('/zakat/distributions', <DistributionsList />, mahallOnly),

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
  route('/education/scholarships/create', <ScholarshipsList />, mahallOnly),
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
];
