import api from './api';

export type LoanStatus =
  | 'applied'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'repaying'
  | 'closed'
  | 'defaulted';

export type InstallmentStatus = 'due' | 'partial' | 'paid' | 'overdue';

export type ReliefStatus = 'reported' | 'verified' | 'approved' | 'assisted' | 'closed';
export type ReliefUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface Installment {
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: InstallmentStatus;
}

export interface QardRepayment {
  id: string;
  loanId: string;
  amount: number;
  paymentDate: string;
  receiptNo?: string;
  remarks?: string;
}

export interface QardLoan {
  id: string;
  applicantMemberId?: { id: string; name: string; contactNo?: string } | string;
  familyId?: { id: string; houseName: string; mahallId?: string } | string;
  applicantName?: string;
  amount: number;
  purpose: string;
  purposeDetails?: string;
  appliedDate: string;
  status: LoanStatus;
  approvedAmount?: number;
  disbursedDate?: string;
  repaymentMonths: number;
  monthlyInstallment?: number;
  outstandingBalance: number;
  repaymentSchedule: Installment[];
  repayments?: QardRepayment[];
  notes?: string;
  createdAt: string;
}

export interface QardSummary {
  totalDisbursed: number;
  totalOutstanding: number;
  totalRepaid: number;
  activeLoans: number;
  pendingApplications: number;
  defaultedLoans: number;
  closedLoans: number;
  byStatus: Record<string, number>;
}

export interface ReliefCase {
  id: string;
  familyId?: { id: string; houseName: string } | string;
  memberId?: { id: string; name: string; contactNo?: string } | string;
  title: string;
  titleMl?: string;
  description?: string;
  urgency: ReliefUrgency;
  status: ReliefStatus;
  assistanceGiven?: string;
  amount?: number;
  followUpDate?: string;
  notes?: string;
  createdAt: string;
}

export interface ReliefSummary {
  openCases: number;
  criticalCases: number;
  assistedCases: number;
  totalAssistance: number;
  byStatus: Record<string, number>;
  byUrgency: Record<string, number>;
}

export const LOAN_PURPOSE_OPTIONS = [
  { value: 'medical', label: 'Medical' },
  { value: 'education', label: 'Education' },
  { value: 'housing', label: 'Housing' },
  { value: 'business', label: 'Business' },
  { value: 'marriage', label: 'Marriage' },
  { value: 'other', label: 'Other' },
];

export const LOAN_STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'applied', label: 'Applied' },
  { value: 'under_review', label: 'Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'disbursed', label: 'Disbursed' },
  { value: 'repaying', label: 'Repaying' },
  { value: 'closed', label: 'Closed' },
];

/** Mirrors QARD_TRANSITIONS on the API so the UI only offers legal moves. */
export const LOAN_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  applied: ['under_review', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['disbursed', 'rejected'],
  disbursed: ['repaying', 'closed', 'defaulted'],
  repaying: ['closed', 'defaulted'],
  defaulted: ['closed'],
  rejected: [],
  closed: [],
};

export const RELIEF_URGENCY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const RELIEF_STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'reported', label: 'Reported' },
  { value: 'verified', label: 'Verified' },
  { value: 'approved', label: 'Approved' },
  { value: 'assisted', label: 'Assisted' },
  { value: 'closed', label: 'Closed' },
];

/** Mirrors RELIEF_TRANSITIONS on the API. */
export const RELIEF_TRANSITIONS: Record<ReliefStatus, ReliefStatus[]> = {
  reported: ['verified', 'closed'],
  verified: ['approved', 'closed'],
  approved: ['assisted', 'closed'],
  assisted: ['closed'],
  closed: [],
};

export const loanApplicantName = (loan: QardLoan): string => {
  if (loan.applicantMemberId && typeof loan.applicantMemberId === 'object') {
    return loan.applicantMemberId.name;
  }
  return loan.applicantName || '-';
};

export const qardService = {
  getLoans: async (params?: Record<string, any>) => {
    const response = await api.get<{ success: boolean; data: QardLoan[]; pagination?: any }>(
      '/qard/loans',
      { params }
    );
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  getLoan: async (id: string) => {
    const response = await api.get<{ success: boolean; data: QardLoan }>(`/qard/loans/${id}`);
    return response.data.data;
  },

  createLoan: async (payload: Record<string, any>) => {
    const response = await api.post<{ success: boolean; data: QardLoan }>('/qard/loans', payload);
    return response.data.data;
  },

  updateLoan: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: QardLoan }>(
      `/qard/loans/${id}`,
      payload
    );
    return response.data.data;
  },

  updateLoanStatus: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: QardLoan }>(
      `/qard/loans/${id}/status`,
      payload
    );
    return response.data.data;
  },

  deleteLoan: async (id: string) => {
    await api.delete(`/qard/loans/${id}`);
  },

  createRepayment: async (payload: Record<string, any>) => {
    const response = await api.post<{
      success: boolean;
      data: { repayment: QardRepayment; outstandingBalance: number; status: LoanStatus };
    }>('/qard/repayments', payload);
    return response.data.data;
  },

  getSummary: async () => {
    const response = await api.get<{ success: boolean; data: QardSummary }>('/qard/summary');
    return response.data.data;
  },
};

export const reliefService = {
  getCases: async (params?: Record<string, any>) => {
    const response = await api.get<{ success: boolean; data: ReliefCase[]; pagination?: any }>(
      '/relief/cases',
      { params }
    );
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  getCase: async (id: string) => {
    const response = await api.get<{ success: boolean; data: ReliefCase }>(`/relief/cases/${id}`);
    return response.data.data;
  },

  createCase: async (payload: Record<string, any>) => {
    const response = await api.post<{ success: boolean; data: ReliefCase }>(
      '/relief/cases',
      payload
    );
    return response.data.data;
  },

  updateCase: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: ReliefCase }>(
      `/relief/cases/${id}`,
      payload
    );
    return response.data.data;
  },

  updateCaseStatus: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: ReliefCase }>(
      `/relief/cases/${id}/status`,
      payload
    );
    return response.data.data;
  },

  deleteCase: async (id: string) => {
    await api.delete(`/relief/cases/${id}`);
  },

  getSummary: async () => {
    const response = await api.get<{ success: boolean; data: ReliefSummary }>('/relief/summary');
    return response.data.data;
  },
};
