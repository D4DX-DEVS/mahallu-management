import api from './api';

export type CampaignType = 'fitr' | 'udhiya' | 'ramadan_relief' | 'building_fund' | 'custom';
export type CampaignStatus = 'draft' | 'active' | 'closed';

export const CAMPAIGN_TYPE_OPTIONS: { value: CampaignType; label: string; hint: string }[] = [
  { value: 'fitr', label: 'Zakat al-Fitr', hint: 'A fixed amount per person, collected before Eid al-Fitr prayer.' },
  { value: 'udhiya', label: 'Udhiya / Qurbani', hint: 'Share booking for animals, collected before Eid al-Adha.' },
  { value: 'ramadan_relief', label: 'Ramadan relief', hint: 'Food kits and relief for families during Ramadan.' },
  { value: 'building_fund', label: 'Building fund', hint: 'A target-based fund for a mosque or madrasa project.' },
  { value: 'custom', label: 'Other campaign', hint: 'Any other special collection.' },
];

export const campaignTypeLabel = (t: string) => CAMPAIGN_TYPE_OPTIONS.find((o) => o.value === t)?.label || t;

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online', label: 'Online' },
];

export interface Campaign {
  id: string;
  type: CampaignType;
  name: string;
  nameMl?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  targetAmount?: number;
  perHeadAmount?: number;
  status: CampaignStatus;
  ledgerId?: string;
  raised: number;
  contributionCount: number;
  percent: number | null;
  remaining: number | null;
}

export interface Contribution {
  id: string;
  receiptNo: string;
  donorName?: string;
  anonymous?: boolean;
  familyId?: string;
  amount: number;
  method: string;
  paymentDate: string;
  status: 'approved' | 'cancelled';
  cancelReason?: string;
  collectorId?: string;
  ledgerPosted?: boolean;
  remarks?: string;
}

export interface ContributionInput {
  familyId?: string;
  donorName?: string;
  anonymous?: boolean;
  amount: number;
  method?: string;
  paymentDate?: string;
  collectorId?: string;
  remarks?: string;
}

export interface CampaignProgress {
  raised: number;
  target: number;
  percent: number | null;
  remaining: number | null;
  contributionCount: number;
  byDay: { date: string; amount: number; count: number; cumulative: number }[];
  byMethod: { method: string; amount: number; count: number }[];
  topContributors: { rank: number; name: string; amount: number; count: number }[];
}

export interface FitrRow {
  familyId: string;
  houseName: string;
  familyHead?: string;
  contactNo?: string;
  wardNumber?: string;
  members: number;
  expected: number;
  paid: number;
  balance: number;
  status: 'paid' | 'partial' | 'unpaid';
  receiptNo?: string;
}

export interface FitrChecklist {
  perHeadAmount: number;
  summary: {
    families: number; members: number; expectedTotal: number; paidTotal: number;
    paidFamilies: number; partialFamilies: number; unpaidFamilies: number;
  };
  families: FitrRow[];
}

export interface UdhiyaBooking {
  id: string;
  animal: string;
  shareCount: number;
  perSharePrice: number;
  participants: { id: string; name: string; familyId?: string; shares: number; paid: boolean }[];
  collectionDay?: string;
  note?: string;
  bookedShares: number;
  openShares: number;
  total: number;
}

export interface IslamicSuggestion {
  key: string;
  label: string;
  date: string;
  hijri: string;
  suggestedCampaignType: CampaignType;
}

const unwrap = <T,>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const campaignService = {
  list: (params?: Record<string, any>) => unwrap<Campaign[]>(api.get('/campaigns', { params })),
  get: (id: string) => unwrap<Campaign>(api.get(`/campaigns/${id}`)),
  create: (payload: Partial<Campaign>) => unwrap<Campaign>(api.post('/campaigns', payload)),
  update: (id: string, payload: Partial<Campaign>) => unwrap<Campaign>(api.put(`/campaigns/${id}`, payload)),
  setStatus: (id: string, status: CampaignStatus) => unwrap<Campaign>(api.patch(`/campaigns/${id}/status`, { status })),
  remove: (id: string) => api.delete(`/campaigns/${id}`),
  suggestions: () => unwrap<IslamicSuggestion[]>(api.get('/campaigns/suggestions')),
  progress: (id: string) => unwrap<CampaignProgress>(api.get(`/campaigns/${id}/progress`)),

  contributions: async (id: string, params?: Record<string, any>) => {
    const r = await api.get<{ data: Contribution[]; pagination: any }>(`/campaigns/${id}/contributions`, { params });
    return { data: r.data.data, pagination: r.data.pagination };
  },
  addContribution: (id: string, payload: ContributionInput) => unwrap<Contribution>(api.post(`/campaigns/${id}/contributions`, payload)),
  cancelContribution: (contributionId: string, reason: string) =>
    unwrap<Contribution>(api.post(`/campaigns/contributions/${contributionId}/cancel`, { reason })),

  fitr: (id: string, params?: Record<string, any>) => unwrap<FitrChecklist>(api.get(`/campaigns/${id}/fitr`, { params })),
  fitrMarkPaid: (id: string, familyId: string, payload: { method?: string; amount?: number } = {}) =>
    unwrap<Contribution>(api.post(`/campaigns/${id}/fitr/${familyId}/mark-paid`, payload)),

  udhiya: (id: string) => unwrap<UdhiyaBooking[]>(api.get(`/campaigns/${id}/udhiya`)),
  createUdhiya: (id: string, payload: any) => unwrap<UdhiyaBooking>(api.post(`/campaigns/${id}/udhiya`, payload)),
  deleteUdhiya: (id: string, bookingId: string) => api.delete(`/campaigns/${id}/udhiya/${bookingId}`),
  payUdhiyaParticipant: (id: string, bookingId: string, participantId: string, payload: { method?: string } = {}) =>
    unwrap<any>(api.post(`/campaigns/${id}/udhiya/${bookingId}/participants/${participantId}/pay`, payload)),
};
