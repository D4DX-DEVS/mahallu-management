// Common types used across the application

export interface User {
  id: string;
  name: string;
  nameMl?: string;
  phone: string;
  email?: string;
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
  /** Per-user grants for restricted modules (counselling, maslahat, inheritance, health, welfare) */
  sensitiveModules?: import('@/constants/modules').SensitiveModuleKey[];
}

export interface Family {
  id: string;
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
  members?: Member[];
  status?: 'approved' | 'unapproved' | 'pending';
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
  /** ISO date string. When set, `age` is derived from it. */
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  bloodGroup?: string;
  healthStatus?: string;
  /** Free-text illness/condition details, captured when healthStatus is not 'healthy'. */
  healthNotes?: string;
  /** @deprecated Retired socio-economic field; new text goes to healthNotes. Read-only for old records. */
  disabilityDetails?: string;
  phone?: string;
  education?: string;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  marriageCount?: number;
  isOrphan?: boolean;
  isDead?: boolean;
  isFamilyHead?: boolean;
  relationship?: 'head' | 'spouse' | 'son' | 'daughter' | 'father' | 'mother' | 'other';
  /** Free-text relationship, captured when relationship is 'other'. */
  relationshipOther?: string;
  educationInstitutionId?: string;
  localityFacilityId?: string;
  /** Free-text external school/college, for one not in the locality registry. */
  externalInstitution?: string;
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
  address?: {
    state?: string;
    district?: string;
    pinCode?: string;
    postOffice?: string;
  };
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
  instituteId: string | { id: string; name?: string; type?: string };
  employeeId: string | { id: string; name?: string; designation?: string; salary?: number };
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
  /** Renders a real sort button in the header. Requires Table's `sort`/`onSort`. */
  sortable?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  /**
   * Column priority, honoured by Table at every breakpoint.
   * `primary`   always visible, including on phones (default)
   * `secondary` hidden below md
   * `tertiary`  hidden below lg
   */
  priority?: 'primary' | 'secondary' | 'tertiary';
  /** Right-align numeric columns so digits line up. */
  align?: 'left' | 'right' | 'center';
  /**
   * Alignment for the heading alone; defaults to `align`.
   *
   * A centred heading carries slack on both sides, which reads as a wider gap
   * than its neighbours have. Left-aligning the heading while the cells stay
   * centred keeps the header row's spacing even.
   */
  headerAlign?: 'left' | 'right' | 'center';
  /** Minimum width, e.g. '12rem'. Keeps columns readable when the table scrolls. */
  width?: string;
}

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
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
  mosqueId?: string | { id: string; name: string };
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
