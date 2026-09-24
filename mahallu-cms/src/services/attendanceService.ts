import api, { asList } from './api';

export type ExamStatus = 'scheduled' | 'completed' | 'cancelled';

export interface AttendanceRecord {
  id: string;
  classId: string | { id: string; name: string };
  date: string;
  records: Array<{
    enrollmentId: string | { id: string; rollNo?: string; memberId?: string };
    present: boolean;
  }>;
  markedBy?: string;
  createdAt: string;
}

export interface Exam {
  id: string;
  classId: string | { id: string; name: string };
  name: string;
  examDate: string;
  maxMarks: number;
  results: Array<{
    enrollmentId: string | { id: string; rollNo?: string };
    marks: number;
    grade?: string;
    studentName?: string;
  }>;
  status?: ExamStatus;
  createdAt: string;
}

export interface ClassProgress {
  classId: string;
  totalStudents: number;
  students: Array<{
    enrollmentId: string;
    studentName: string;
    rollNo?: string;
    attendance: number;
    attendanceCount: string;
    examAverage: number | null;
    examCount: number;
  }>;
}

export const attendanceService = {
  async upsertAttendance(
    classId: string,
    date: string,
    records: Array<{ enrollmentId: string; present: boolean }>
  ) {
    const response = await api.post<{ success: boolean; data: AttendanceRecord }>('/class-attendance', {
      classId,
      date,
      records,
    });
    return response.data;
  },

  async listAttendance(params: Record<string, any>) {
    const response = await api.get<{ success: boolean; data: AttendanceRecord[]; pagination: any }>(
      '/class-attendance',
      { params }
    );
    return {
      data: asList(response.data.data),
      pagination: response.data.pagination,
    };
  },

  async getAttendance(id: string) {
    const response = await api.get<{ success: boolean; data: AttendanceRecord }>(`/class-attendance/${id}`);
    return response.data.data;
  },

  async getClassProgress(classId: string) {
    const response = await api.get<{ success: boolean; data: ClassProgress }>(
      `/madrasa/classes/${classId}/progress`
    );
    return response.data.data;
  },
};

export const examService = {
  async listExams(params: Record<string, any>) {
    const response = await api.get<{ success: boolean; data: Exam[]; pagination: any }>('/exams', { params });
    return {
      data: asList(response.data.data),
      pagination: response.data.pagination,
    };
  },

  async getExam(id: string) {
    const response = await api.get<{ success: boolean; data: Exam }>(`/exams/${id}`);
    return response.data.data;
  },

  async createExam(data: {
    classId: string;
    name: string;
    examDate: string;
    maxMarks: number;
    status?: ExamStatus;
  }) {
    const response = await api.post<{ success: boolean; data: Exam }>('/exams', data);
    return response.data.data;
  },

  async updateExam(id: string, data: Partial<Exam>) {
    const response = await api.put<{ success: boolean; data: Exam }>(`/exams/${id}`, data);
    return response.data.data;
  },

  async deleteExam(id: string) {
    await api.delete(`/exams/${id}`);
  },

  async updateExamResults(
    id: string,
    results: Array<{
      enrollmentId: string;
      marks: number;
      grade?: string;
    }>
  ) {
    const response = await api.put<{ success: boolean; data: Exam }>(`/exams/${id}/results`, { results });
    return response.data.data;
  },
};
