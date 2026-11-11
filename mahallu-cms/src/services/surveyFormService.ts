import api, { asList } from './api';
import type { Pagination } from '@/types';
import type { Answers, FileAnswer, RespondentType, SurveyFormContent } from '@/features/survey/formEngine';

export type SurveyType = 'household' | 'demographic' | 'welfare' | 'education' | 'health' | 'employment' | 'feedback' | 'other';
export type SurveyStatus = 'draft' | 'published' | 'closed';
export type FillState = 'draft' | 'scheduled' | 'open' | 'ended' | 'closed';
export type SubmissionStatus = 'draft' | 'pending' | 'accepted' | 'rejected';

export const SURVEY_TYPE_OPTIONS: { value: SurveyType; label: string }[] = [
  { value: 'household', label: 'Household survey' },
  { value: 'demographic', label: 'Demographic / census' },
  { value: 'welfare', label: 'Welfare needs assessment' },
  { value: 'education', label: 'Education' },
  { value: 'health', label: 'Health' },
  { value: 'employment', label: 'Employment and skills' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'other', label: 'Other' },
];

export const surveyTypeLabel = (type?: string) => SURVEY_TYPE_OPTIONS.find((o) => o.value === type)?.label || 'Other';

export const RESPONDENT_OPTIONS: { value: RespondentType; label: string; description: string }[] = [
  { value: 'none', label: 'General', description: 'Not tied to a record' },
  { value: 'family', label: 'A family', description: 'Each response picks a household' },
  { value: 'member', label: 'A member', description: 'Each response picks a person' },
];

export const FILL_STATE_LABELS: Record<FillState, string> = {
  draft: 'Not published',
  scheduled: 'Not started yet',
  open: 'Open',
  ended: 'Period ended',
  closed: 'Closed',
};

export interface SurveyCounts {
  draft: number;
  pending: number;
  accepted: number;
  rejected: number;
  responses: number;
}

export interface SurveyForm {
  id: string;
  title: string;
  type: SurveyType;
  description?: string;
  startDate: string;
  endDate?: string | null;
  targetCount?: number | null;
  respondentType: RespondentType;
  status: SurveyStatus;
  fillState: FillState;
  publishedVersion: number;
  publishedAt?: string | null;
  hasUnpublishedChanges: boolean;
  revision: number;
  nextFieldId: number;
  nextPageId: number;
  counts?: SurveyCounts;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyBuilderData extends SurveyForm {
  draft: SurveyFormContent;
}

export interface SurveyDetailsPayload {
  title: string;
  type: SurveyType;
  description?: string;
  startDate: string;
  endDate?: string | null;
  targetCount?: number | null;
  respondentType: RespondentType;
}

export interface FormVersion {
  id: string;
  version: number;
  content: SurveyFormContent;
  publishedAt: string;
}

export interface SubmissionHistory {
  status: SubmissionStatus;
  note?: string;
  byName?: string;
  at: string;
}

export interface SurveySubmission {
  id: string;
  surveyId: string;
  versionId: string;
  version: number;
  status: SubmissionStatus;
  answers?: Answers;
  familyId?: string | { id: string; houseName?: string; familyHead?: string; [key: string]: unknown } | null;
  memberId?: string | { id: string; name?: string; familyName?: string; [key: string]: unknown } | null;
  respondentName?: string;
  submittedBy: string;
  submittedByName?: string;
  submittedAt?: string | null;
  currentPage: number;
  reviewedByName?: string;
  reviewedAt?: string | null;
  reviewNote?: string;
  history?: SubmissionHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionListMeta {
  statusCounts: Record<'all' | 'pending' | 'accepted' | 'rejected', number>;
  surveyors: { id: string; name: string; count: number }[];
}

export interface SubmissionFilters {
  page?: number;
  limit?: number;
  status?: string;
  from?: string;
  to?: string;
  submittedBy?: string;
  search?: string;
  sort?: string;
  /** JSON of { field_<id>: optionValue[] } */
  answers?: string;
}

export interface SubmissionPayload {
  answers: Answers;
  familyId?: string;
  memberId?: string;
  submit: boolean;
  currentPage?: number;
}

const base = '/survey-forms';

export const surveyFormService = {
  list: async (params?: { page?: number; limit?: number; status?: string; type?: string; search?: string }) => {
    const response = await api.get<{ success: boolean; data: SurveyForm[]; pagination?: Pagination }>(base, { params });
    return { data: asList(response.data.data), pagination: response.data.pagination || null };
  },

  get: async (id: string) => (await api.get<{ data: SurveyForm }>(`${base}/${id}`)).data.data,

  create: async (payload: SurveyDetailsPayload) => (await api.post<{ data: SurveyForm }>(base, payload)).data.data,

  update: async (id: string, payload: Partial<SurveyDetailsPayload>) =>
    (await api.put<{ data: SurveyForm }>(`${base}/${id}`, payload)).data.data,

  remove: async (id: string) => (await api.delete(`${base}/${id}`)).data,

  setStatus: async (id: string, status: 'published' | 'closed') =>
    (await api.post<{ data: SurveyForm }>(`${base}/${id}/status`, { status })).data.data,

  getBuilder: async (id: string) => (await api.get<{ data: SurveyBuilderData }>(`${base}/${id}/builder`)).data.data,

  saveBuilder: async (
    id: string,
    payload: { draft: SurveyFormContent; revision: number; nextFieldId: number; nextPageId: number }
  ) => (await api.put<{ data: SurveyBuilderData }>(`${base}/${id}/builder`, payload)).data.data,

  publish: async (id: string, revision: number) =>
    (await api.post<{ data: SurveyBuilderData; message?: string }>(`${base}/${id}/publish`, { revision })).data,

  getForm: async (id: string) =>
    (await api.get<{ data: { survey: SurveyForm; version: FormVersion } }>(`${base}/${id}/form`)).data.data,

  createSubmission: async (surveyId: string, payload: SubmissionPayload) =>
    (await api.post<{ data: SurveySubmission }>(`${base}/${surveyId}/submissions`, payload)).data.data,

  updateSubmission: async (submissionId: string, payload: SubmissionPayload) =>
    (await api.put<{ data: SurveySubmission }>(`${base}/submissions/${submissionId}`, payload)).data.data,

  removeSubmission: async (submissionId: string) => (await api.delete(`${base}/submissions/${submissionId}`)).data,

  listSubmissions: async (surveyId: string, params: SubmissionFilters) => {
    const response = await api.get<{ data: SurveySubmission[]; pagination?: Pagination; meta?: SubmissionListMeta }>(
      `${base}/${surveyId}/submissions`,
      { params }
    );
    return {
      data: asList(response.data.data),
      pagination: response.data.pagination || null,
      meta: response.data.meta || null,
    };
  },

  exportSubmissions: async (surveyId: string, params: SubmissionFilters) => {
    const response = await api.get<Blob>(`${base}/${surveyId}/submissions/export`, { params, responseType: 'blob' });
    return response.data;
  },

  listMine: async (surveyId: string, params?: { page?: number; limit?: number; status?: string }) => {
    const response = await api.get<{ data: SurveySubmission[]; pagination?: Pagination }>(`${base}/${surveyId}/my-submissions`, {
      params,
    });
    return { data: asList(response.data.data), pagination: response.data.pagination || null };
  },

  getSubmission: async (submissionId: string) =>
    (
      await api.get<{ data: { submission: SurveySubmission; survey: SurveyForm | null; version: FormVersion | null } }>(
        `${base}/submissions/${submissionId}`
      )
    ).data.data,

  review: async (submissionId: string, decision: 'accepted' | 'rejected', note: string) =>
    (await api.post<{ data: SurveySubmission }>(`${base}/submissions/${submissionId}/review`, { decision, note })).data.data,

  fileUrl: async (submissionId: string, documentId: string) =>
    (await api.get<{ data: { url: string } }>(`${base}/submissions/${submissionId}/files/${documentId}`)).data.data.url,

  /** Uploads a file for a file or photo question. Stored privately; the answer keeps only its id and name. */
  uploadFile: async (file: File, kind: 'file' | 'photo', onProgress?: (percent: number) => void): Promise<FileAnswer> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', kind === 'photo' ? 'photo' : 'other');
    formData.append('ownerType', 'survey');
    if (kind === 'photo') formData.append('purpose', 'person_photo');
    const response = await api.post<{ data: { id?: string; _id?: string; fileName: string; mimeType: string; size: number } }>(
      '/documents/upload',
      formData,
      {
        onUploadProgress: (event) => {
          if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
        },
      }
    );
    const doc = response.data.data;
    return { documentId: String(doc.id || doc._id), fileName: doc.fileName, mimeType: doc.mimeType, size: doc.size };
  },
};
