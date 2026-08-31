import api from './api';

export interface MemberOverviewResponse {
  member: {
    id: string;
    name: string;
    phone?: string;
    familyName?: string;
    mahallId?: string;
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
  _id: string;
  amount: number;
  paymentDate: string;
  receiptNo?: string;
  paymentMethod?: string;
  remarks?: string;
  status: 'paid';
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
  createdAt?: string;
}

export interface RegistrationsResponse {
  nikah: any[];
  death: any[];
  noc: any[];
}

export interface PopulatedDocument {
  id: string;
  fileName: string;
  documentType: string;
  status: 'pending' | 'verified' | 'rejected';
}

export interface NikahRegistration {
  id: string;
  mahallMemberType: 'groom' | 'bride';
  subjectMemberId?: string;
  groomName: string;
  groomAge?: number;
  brideName: string;
  brideAge?: number;
  nikahDate: string;
  venue: string;
  waliName: string;
  witness1: string;
  witness2: string;
  mahrAmount: number;
  mahrDescription: string;
  documents: PopulatedDocument[];
  status: 'pending' | 'correction_required' | 'approved' | 'rejected';
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeathRegistration {
  id: string;
  deceasedMemberId?: string;
  deceasedName: string;
  deathDate: string;
  placeOfDeath: string;
  causeOfDeath: string;
  informantName?: string;
  informantRelation?: string;
  informantPhone?: string;
  documents: PopulatedDocument[];
  status: 'pending' | 'correction_required' | 'approved' | 'rejected';
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NOCRecord {
  id: string;
  applicantName: string;
  applicantPhone?: string;
  type: 'common' | 'nikah';
  purposeTitle?: string;
  purposeDescription?: string;
  purpose?: string;
  nikahRegistrationId?: NikahRegistration | string;
  documents: PopulatedDocument[];
  status: 'pending' | 'correction_required' | 'approved' | 'rejected';
  remarks?: string;
  issuedDate?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  gender?: 'male' | 'female';
  relationship?: string;
  age?: number;
  maritalStatus?: string;
  education?: string;
  occupation?: string;
  bloodGroup?: string;
  mahallId?: string;
  status?: string;
}

export interface DocumentRecord {
  _id: string;
  id?: string; // normalized alias of _id
  fileName: string;
  documentType: 'id_proof' | 'age_proof' | 'photo' | 'address_proof' | 'divorce_doc' | 'death_proof' | 'other';
  status: 'pending' | 'uploaded' | 'verified' | 'rejected';
  ownerType?: string;
  createdAt: string;
}

export interface Certificate {
  id: string;
  certificateNo: string;
  type: string;
  issueDate: string;
  status: string;
}

export interface ChangeRequest {
  id: string;
  targetType: 'member' | 'family';
  targetId: string;
  changes: Array<{ field: string; oldValue?: string; newValue: string }>;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  remarks?: string;
  createdAt: string;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
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
    const data = response.data.data as unknown;
    // With a type filter the backend returns a paginated ARRAY — normalize to the keyed shape
    if (type && Array.isArray(data)) {
      return { [type]: data } as unknown as RegistrationsResponse;
    }
    return data as RegistrationsResponse;
  },

  getRegistrations: async (type: 'nikah' | 'death' | 'noc', page = 1, limit = 10) => {
    const response = await api.get<PaginationResponse<NikahRegistration | DeathRegistration | NOCRecord>>(
      `/member-user/registrations?type=${type}&page=${page}&limit=${limit}`
    );
    return response.data;
  },

  getFamilyMembers: async (page = 1, limit = 10) => {
    const response = await api.get<PaginationResponse<FamilyMember>>(
      `/member-user/family-members?page=${page}&limit=${limit}`
    );
    return response.data;
  },

  updateProfile: async (data: { phone?: string; email?: string }) => {
    const response = await api.put<{ success: boolean; data: any }>(
      '/member-user/profile',
      data
    );
    return response.data.data;
  },

  createNikahRegistration: async (data: {
    mahallMemberType: 'groom' | 'bride';
    subjectMemberId?: string;
    groomName: string;
    groomAge?: number;
    brideName: string;
    brideAge?: number;
    nikahDate: string;
    venue: string;
    waliName: string;
    witness1: string;
    witness2: string;
    mahrAmount: number;
    mahrDescription: string;
    documents: string[];
  }) => {
    const response = await api.post<{ success: boolean; data: NikahRegistration }>(
      '/member-user/registrations/nikah',
      data
    );
    return response.data.data;
  },

  createDeathRegistration: async (data: {
    deceasedMemberId?: string;
    deathDate: string;
    placeOfDeath: string;
    causeOfDeath: string;
    informantName?: string;
    informantRelation?: string;
    informantPhone?: string;
    documents: string[];
  }) => {
    const response = await api.post<{ success: boolean; data: DeathRegistration }>(
      '/member-user/registrations/death',
      data
    );
    return response.data.data;
  },

  updateRegistration: async (type: 'nikah' | 'death' | 'noc', id: string, data: any) => {
    const response = await api.put<{ success: boolean; data: any }>(
      `/member-user/registrations/${type}/${id}`,
      data
    );
    return response.data.data;
  },

  deleteRegistration: async (type: 'nikah' | 'death' | 'noc', id: string) => {
    await api.delete(`/member-user/registrations/${type}/${id}`);
  },

  uploadDocument: async (file: File, documentType: string, ownerType?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    if (ownerType) formData.append('ownerType', ownerType);

    // No manual Content-Type: axios/browser must set the multipart boundary themselves
    const response = await api.post<{ success: boolean; data: DocumentRecord & { _id?: string } }>(
      '/documents/upload',
      formData
    );
    const doc = response.data.data;
    // POST responses keep Mongo's _id — pages rely on `id`
    return { ...doc, id: doc.id || doc._id };
  },

  getDocuments: async (page = 1, limit = 10) => {
    const response = await api.get<PaginationResponse<DocumentRecord>>(
      `/documents?page=${page}&limit=${limit}`
    );
    return response.data;
  },

  getDocumentUrl: async (docId: string) => {
    const response = await api.get<{ success: boolean; data: { url: string; fileName: string } }>(
      `/documents/${docId}/url`
    );
    return response.data.data;
  },

  getCertificates: async (page = 1, limit = 10) => {
    const response = await api.get<PaginationResponse<Certificate>>(
      `/certificates?page=${page}&limit=${limit}`
    );
    return response.data;
  },

  getCertificateUrl: async (certId: string) => {
    const response = await api.get<{ success: boolean; data: { url: string; fileName: string } }>(
      `/certificates/${certId}/download`
    );
    return response.data.data;
  },

  createChangeRequest: async (data: {
    targetType: 'member' | 'family';
    targetId: string;
    changes: Array<{ field: string; newValue: string }>;
  }) => {
    const response = await api.post<{ success: boolean; data: ChangeRequest }>(
      '/change-requests',
      data
    );
    return response.data.data;
  },

  updateChangeRequest: async (id: string, data: { field: string; newValue: string }) => {
    const response = await api.put<{ success: boolean; data: ChangeRequest }>(
      `/change-requests/${id}`,
      data
    );
    return response.data.data;
  },

  deleteChangeRequest: async (id: string) => {
    await api.delete(`/change-requests/${id}`);
  },

  getChangeRequests: async (page = 1, limit = 10) => {
    const response = await api.get<PaginationResponse<ChangeRequest>>(
      `/change-requests?page=${page}&limit=${limit}`
    );
    return response.data;
  },

  requestNOC: async (data: {
    type: 'common' | 'nikah';
    purposeTitle?: string;
    purposeDescription?: string;
    subjectMemberId?: string;
    mahallMemberType?: 'groom' | 'bride';
    groomName?: string;
    groomAge?: number;
    brideName?: string;
    brideAge?: number;
    nikahDate?: string;
    venue?: string;
    waliName?: string;
    witness1?: string;
    witness2?: string;
    mahrAmount?: number;
    mahrDescription?: string;
    documents?: string[];
    remarks?: string;
  }) => {
    const response = await api.post<{ success: boolean; data: any; message: string }>(
      '/member-user/registrations/noc',
      data
    );
    return response.data;
  },
};
