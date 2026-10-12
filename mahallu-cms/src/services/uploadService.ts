import api from './api';

/** Upload a person's profile photo (<= 2 MB image) and get back its public URL. */
export const uploadService = {
  uploadProfilePhoto: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post<{ success: boolean; url: string }>('/upload/profile-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.url;
  },
};
