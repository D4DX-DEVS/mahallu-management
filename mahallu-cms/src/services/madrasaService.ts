import api from './api';

export type ClassType = 'weekend_madrasa' | 'tuition' | 'adult_quran' | 'remedial' | 'other';
export type EnrollmentStatus = 'active' | 'completed' | 'dropped';

export interface MadrasaClass {
  _id: string;
  instituteId?: { _id: string; name: string } | string;
  name: string;
  nameMl?: string;
  academicYear: string;
  classType: ClassType;
  teacherEmployeeId?: { _id: string; name: string; designation?: string } | string;
  subjects: string[];
  schedule?: string;
  status: 'active' | 'inactive';
  studentCount?: number;
  createdAt: string;
}

export interface StudentEnrollment {
  _id: string;
  classId: { _id: string; name: string; academicYear?: string } | string;
  memberId: { _id: string; name: string; nameMl?: string; contactNo?: string } | string;
  rollNo?: string;
  enrollDate: string;
  status: EnrollmentStatus;
  createdAt: string;
}

export interface MadrasaSummary {
  totalClasses: number;
  activeStudents: number;
  completedStudents: number;
  droppedStudents: number;
  byClassType: Record<string, number>;
  byEnrollmentStatus: Record<string, number>;
}

export const CLASS_TYPE_OPTIONS = [
  { value: 'weekend_madrasa', label: 'Weekend Madrasa' },
  { value: 'tuition', label: 'Tuition' },
  { value: 'adult_quran', label: 'Adult Quran' },
  { value: 'remedial', label: 'Remedial' },
  { value: 'other', label: 'Other' },
];

export const ENROLLMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' },
];

export const CLASS_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export const classTypeLabel = (value: string): string =>
  CLASS_TYPE_OPTIONS.find((option) => option.value === value)?.label || value;

export const teacherName = (cls: MadrasaClass): string => {
  if (cls.teacherEmployeeId && typeof cls.teacherEmployeeId === 'object') {
    return cls.teacherEmployeeId.name;
  }
  return 'Not assigned';
};

export const studentName = (enrollment: StudentEnrollment): string => {
  if (enrollment.memberId && typeof enrollment.memberId === 'object') {
    return enrollment.memberId.name;
  }
  return '-';
};

/** Defaults to the academic year the current month falls in (June rollover). */
export const currentAcademicYear = (): string => {
  const now = new Date();
  const startYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
};

export const madrasaService = {
  getClasses: async (params?: Record<string, any>) => {
    const response = await api.get<{ success: boolean; data: MadrasaClass[]; pagination?: any }>(
      '/madrasa/classes',
      { params }
    );
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  getClass: async (id: string) => {
    const response = await api.get<{ success: boolean; data: MadrasaClass }>(
      `/madrasa/classes/${id}`
    );
    return response.data.data;
  },

  createClass: async (payload: Record<string, any>) => {
    const response = await api.post<{ success: boolean; data: MadrasaClass }>(
      '/madrasa/classes',
      payload
    );
    return response.data.data;
  },

  updateClass: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: MadrasaClass }>(
      `/madrasa/classes/${id}`,
      payload
    );
    return response.data.data;
  },

  deleteClass: async (id: string) => {
    await api.delete(`/madrasa/classes/${id}`);
  },

  getClassStudents: async (id: string, params?: Record<string, any>) => {
    const response = await api.get<{
      success: boolean;
      data: StudentEnrollment[];
      pagination?: any;
    }>(`/madrasa/classes/${id}/students`, { params });
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  createEnrollment: async (payload: Record<string, any>) => {
    const response = await api.post<{ success: boolean; data: StudentEnrollment }>(
      '/madrasa/enrollments',
      payload
    );
    return response.data.data;
  },

  updateEnrollment: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: StudentEnrollment }>(
      `/madrasa/enrollments/${id}`,
      payload
    );
    return response.data.data;
  },

  deleteEnrollment: async (id: string) => {
    await api.delete(`/madrasa/enrollments/${id}`);
  },

  getSummary: async () => {
    const response = await api.get<{ success: boolean; data: MadrasaSummary }>('/madrasa/summary');
    return response.data.data;
  },
};
