import api from './api';

export interface MemberOverviewResponse {
  member: {
    id: string;
    name: string;
    phone?: string;
    familyName?: string;
    mahallId?: string;
    photoUrl?: string;
    bloodGroup?: string;
  };
  family: {
    details: {
      id: string;
      houseName?: string;
      mahallId?: string;
      varisangyaGrade?: string;
      contactNo?: string;
      area?: string;
      place?: string;
      status?: string;
    } | null;
    members: Array<{
      id: string;
      name: string;
      phone?: string;
      gender?: 'male' | 'female';
      photoUrl?: string;
      mahallId?: string;
      status?: string;
    }>;
    financialSummary: {
      varisangyaTotal: number;
      varisangyaCount: number;
      zakatTotal: number;
      zakatCount: number;
    };
  };
  mahalluStatistics: {
    users: number;
    families: number;
    members: number;
  };
  varusankhyaDetails: {
    familyMahallId: string | null;
    memberMahallId: string | null;
    varisangyaGrade: string | null;
    latestVarisangyaReceiptNo: string | null;
    latestZakatReceiptNo: string | null;
    latestVarisangyaPaymentDate: string | null;
    latestZakatPaymentDate: string | null;
  };
  assignedOptions: {
    view: boolean;
    add: boolean;
    edit: boolean;
    delete: boolean;
  };
}

export interface VarisangyaRecord {
  id: string;
  amount: number;
  paymentDate: string;
  receiptNo?: string;
  paymentMethod?: string;
  remarks?: string;
  status: 'paid' | 'pending' | 'rejected';
}

export interface MemberVarisangyaResponse {
  memberVarisangya: VarisangyaRecord[];
  familyVarisangya: VarisangyaRecord[];
  summary: {
    memberTotal: number;
    memberCount: number;
    familyTotal: number;
    familyCount: number;
  };
}

export interface PaymentRecord {
  id: string;
  amount: number;
  paymentDate: string;
  receiptNo?: string;
  paymentMethod?: string;
  remarks?: string;
  payerName?: string;
  category?: string;
  familyId?: string;
  memberId?: string;
  type: 'varisangya' | 'zakat';
  /** Member-submitted requests are 'pending' until an admin approves them. Missing = approved. */
  status?: 'pending' | 'approved' | 'rejected';
  rejectReason?: string;
  createdAt?: string;
}

export interface RegistrationsResponse {
  nikah: any[];
  death: any[];
  noc: any[];
}

export const memberPortalService = {
  getOverview: async () => {
    const response = await api.get<{ success: boolean; data: MemberOverviewResponse }>('/member-user/overview');
    return response.data.data;
  },

  getMemberVarisangya: async (year?: number) => {
    const params = year ? { year } : {};
    const response = await api.get<{ success: boolean; data: MemberVarisangyaResponse }>(
      '/member-user/varisangya',
      { params }
    );
    return response.data.data;
  },

  getOwnPayments: async (type?: 'varisangya' | 'zakat', page = 1, limit = 50) => {
    const params: any = { page, limit };
    if (type) params.type = type;
    const response = await api.get<{ success: boolean; data: PaymentRecord[]; pagination?: any }>(
      '/member-user/payments',
      { params }
    );
    return { data: response.data.data, pagination: (response.data as any).pagination };
  },

  getOwnRegistrations: async (type?: 'nikah' | 'death' | 'noc') => {
    const params = type ? { type } : {};
    const response = await api.get<{ success: boolean; data: RegistrationsResponse }>(
      '/member-user/registrations',
      { params }
    );
    return response.data.data;
  },

  requestNOC: async (data: {
    type: 'common' | 'nikah';
    purposeTitle?: string;
    purposeDescription?: string;
    brideName?: string;
    brideAge?: number;
    nikahDate?: string;
    venue?: string;
    remarks?: string;
  }) => {
    const response = await api.post<{ success: boolean; data: any; message: string }>(
      '/member-user/registrations/noc',
      data
    );
    return response.data;
  },
};
