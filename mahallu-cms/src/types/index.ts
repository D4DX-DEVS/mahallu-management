// Common types used across the application

export interface User {
  id: string;
  name: string;
  nameMl?: string;
  phone: string;
  email?: string;
  /** Optional profile photo URL */
  photoUrl?: string;
  role: 'super_admin' | 'mahall' | 'survey' | 'institute' | 'member';
  tenantId?: string;
  memberId?: string;
  instituteId?: string;
  status: 'active' | 'inactive';
  joiningDate: string;
  lastLogin?: string;
  permissions?: Permission;
  isSuperAdmin?: boolean;
  twoFactorEnabled?: boolean;
  tenant?: { id?: string; name: string };
}

export interface Permission {
  view?: boolean;
  add?: boolean;
  edit?: boolean;
  delete?: boolean;
  /** Can reopen a closed financial period */
  financeAdmin?: boolean;
  /** Per-user grants for restricted modules (counselling, maslahat, inheritance, health, welfare) */
  sensitiveModules?: import('@/constants/modules').SensitiveModuleKey[];
  /** Granular flags. Unset = the role default (see PERMISSION_GROUPS in features/users/components/PermissionsSection) */
  canDeleteReceipts?: boolean;
  canCancelReceipts?: boolean;
  canApprovePayments?: boolean;
  canCloseCashDay?: boolean;
  canVerifyCashDay?: boolean;
  canManageCampaigns?: boolean;
  canManagePeriods?: boolean;
}

export interface Family {
  id: string;
  /** Live member count computed by the list API */
  memberCount?: number;
  tenantId?: string;
  mahallId?: string;
  houseName: string;
  houseNameMl?: string;
  familyHead?: string;
  familyHeadMl?: string;
  contactNo?: string;
  wardNumber?: string;
  houseNo?: string;
  area?: string;
  areaMl?: string;
  place?: string;
  placeMl?: string;
  via?: string;
  state: string;
  district: string;
  pinCode?: string;
  postOffice?: string;
  lsgName: string;
  village: string;
  varisangyaGrade?: string;
  /** Welfare / socio-economic profile (optional on older records) */
  economicStatus?: 'stable' | 'struggling' | 'needs_assistance';
  welfareStatus?: 'none' | 'receiving' | 'applied' | 'needs_review';
  specialRequirements?: string;
  housingType?: 'own' | 'rented' | 'shared' | 'none';
  members?: Member[];
  status?: 'approved' | 'unapproved' | 'pending';
  /** Lifecycle flags (archive / head reassignment); optional on older records */
  isArchived?: boolean;
  archivedAt?: string;
  archivedReason?: string;
  needsHeadReassignment?: boolean;
  needsHeadReason?: string;
  createdAt: string;
}

export interface Member {
  id: string;
  tenantId?: string;
  mahallId?: string;
  name: string;
  nameMl?: string;
  familyId: string;
  familyName: string;
  age?: number;
  gender?: 'male' | 'female';
  bloodGroup?: string;
  /** Optional profile photo URL */
  photoUrl?: string;
  healthStatus?: string;
  phone?: string;
  education?: string;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  marriageCount?: number;
  isOrphan?: boolean;
  isDead?: boolean;
  isFamilyHead?: boolean;
  /** Socio-economic profile (optional on older records) */
  occupation?: string;
  occupationSector?: string;
  monthlyIncomeRange?: string;
  skills?: string[];
  volunteerSkills?: string[];
  disabilityDetails?: string;
  isJobSeeker?: boolean;
  isZakatPayer?: boolean;
  isZakatEligible?: boolean;
  isWidow?: boolean;
  hasDisability?: boolean;
  isMarriageable?: boolean;
  isVolunteer?: boolean;
  createdAt: string;
}

export interface Institute {
  id: string;
  tenantId?: string;
  name: string;
  nameMl?: string;
  place: string;
  placeMl?: string;
  joinDate: string;
  type: 'institute' | 'madrasa' | 'orphanage' | 'hospital' | 'other' | 'program' | 'mosque';
  description?: string;
  contactNo?: string;
  email?: string;
  status?: 'active' | 'inactive';
  audience?: 'all' | 'men' | 'women' | 'youth' | 'children' | 'families';
  programType?: 'quran_class' | 'hadith' | 'fiqh' | 'lecture' | 'family' | 'other';
  /** Event fields (Task C3) — present when a program is run as a gathering. */
  eventDate?: string;
  competitions?: { name: string; winners: string[] }[];
  awards?: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  tenantId?: string;
  instituteId: string;
  instituteName?: string;
  instituteType?: string;
  name: string;
  nameMl?: string;
  phone?: string;
  email?: string;
  designation: string;
  designationMl?: string;
  department?: string;
  joinDate: string;
  salary: number;
  status: 'active' | 'inactive' | 'resigned' | 'terminated' | 'on_leave';
  address?: string;
  qualifications?: string;
  bankAccount?: {
    accountNumber: string;
    bankName: string;
    ifscCode: string;
  };
  createdAt: string;
}

export interface SalaryPayment {
  id: string;
  tenantId?: string;
  instituteId: string;
  employeeId: string;
  employeeName?: string;
  employeeDesignation?: string;
  instituteName?: string;
  month: number;
  year: number;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netAmount: number;
  paymentDate: string;
  paymentMethod: 'cash' | 'bank' | 'upi' | 'cheque';
  referenceNo?: string;
  status: 'paid' | 'pending' | 'cancelled';
  remarks?: string;
  createdAt: string;
}

export interface Committee {
  id: string;
  tenantId?: string;
  name: string;
  nameMl?: string;
  description?: string;
  descriptionMl?: string;
  members?: Member[] | string[];
  status?: 'active' | 'inactive';
  termStartDate?: string;
  termEndDate?: string;
  maxTermYears?: number;
  createdAt: string;
}

export interface Meeting {
  id: string;
  tenantId?: string;
  committeeId: string;
  committeeName?: string;
  title: string;
  titleMl?: string;
  meetingDate: string;
  attendance?: Member[] | string[];
  totalMembers?: number;
  attendancePercent: number;
  agenda?: string;
  agendaMl?: string;
  minutes?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  /** Horizontal alignment of header + cells. Use 'right' for numbers and amounts. */
  align?: 'left' | 'right' | 'center';
  /** When false the column cannot be hidden from the column chooser (e.g. actions). */
  hideable?: boolean;
  /** Hidden until the user turns it on in the column chooser. */
  defaultHidden?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: Pagination;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

export interface Asset {
  id: string;
  tenantId?: string;
  name: string;
  nameMl?: string;
  description?: string;
  descriptionMl?: string;
  purchaseDate: string;
  estimatedValue: number;
  category: 'furniture' | 'electronics' | 'vehicle' | 'building' | 'land' | 'equipment' | 'other';
  status: 'active' | 'in_use' | 'under_maintenance' | 'disposed' | 'damaged';
  location?: string;
  locationMl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AssetMaintenance {
  id: string;
  assetId: string;
  tenantId?: string;
  maintenanceDate: string;
  description: string;
  cost?: number;
  performedBy?: string;
  nextMaintenanceDate?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
}

