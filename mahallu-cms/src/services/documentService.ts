import api from './api';

export interface UploadedDocument {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export const documentService = {
  /**
   * Upload a person photo (private storage). The server checks the bytes and the size again; the id it
   * returns is what a record stores. `onProgress` receives 0-100.
   */
  uploadPersonPhoto: async (file: File, ownerType: 'nikah', onProgress?: (percent: number) => void): Promise<UploadedDocument> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', 'photo');
    formData.append('ownerType', ownerType);
    formData.append('purpose', 'person_photo');
    // No manual Content-Type: the browser must set the multipart boundary itself.
    const response = await api.post<{ success: boolean; data: { id?: string; _id?: string } & Omit<UploadedDocument, 'id'> }>(
      '/documents/upload',
      formData,
      {
        onUploadProgress: (event) => {
          if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
        },
      }
    );
    const doc = response.data.data;
    return { id: (doc.id || doc._id) as string, fileName: doc.fileName, mimeType: doc.mimeType, size: doc.size };
  },

  /** A short-lived signed link for a private document (valid for about five minutes). */
  getUrl: async (id: string): Promise<string> => {
    const response = await api.get<{ success: boolean; data: { url: string } }>(`/documents/${id}/url`);
    return response.data.data.url;
  },

  /** Remove an upload that was never attached to a record. Best effort for clean-up: never throws. */
  discard: async (id: string): Promise<void> => {
    try {
      await api.delete(`/documents/${id}`);
    } catch {
      /* an unattached upload that could not be removed is reported by the server; nothing to show here */
    }
  },
};
