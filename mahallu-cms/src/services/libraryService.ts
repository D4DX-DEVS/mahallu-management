import api from './api';

export interface LibraryBook {
  _id: string;
  tenantId: string;
  title: string;
  titleMl?: string;
  author: string;
  category: 'quran' | 'hadith' | 'fiqh' | 'history' | 'children' | 'women' | 'youth' | 'general';
  resourceType: 'physical' | 'digital';
  resourceUrl?: string;
  isbn?: string;
  copies?: number;
  availableCopies?: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface BookIssue {
  _id: string;
  tenantId: string;
  bookId: LibraryBook | string;
  memberId: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'issued' | 'returned' | 'overdue';
  createdAt: string;
  updatedAt: string;
}

export const libraryService = {
  // Books endpoints
  getBooks: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    resourceType?: string;
    status?: string;
  }) => {
    const response = await api.get<{
      success: boolean;
      data: LibraryBook[];
      pagination?: any;
    }>('/library-books', { params });
    return {
      data: response.data.data,
      pagination: response.data.pagination,
    };
  },

  getBookById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: LibraryBook }>(
      `/library-books/${id}`
    );
    return response.data.data;
  },

  createBook: async (bookData: Partial<LibraryBook>) => {
    const response = await api.post<{ success: boolean; data: LibraryBook }>(
      '/library-books',
      bookData
    );
    return response.data.data;
  },

  updateBook: async (id: string, bookData: Partial<LibraryBook>) => {
    const response = await api.put<{ success: boolean; data: LibraryBook }>(
      `/library-books/${id}`,
      bookData
    );
    return response.data.data;
  },

  deleteBook: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/library-books/${id}`
    );
    return response.data;
  },

  bulkImportBooks: async (books: Array<Partial<LibraryBook>>) => {
    const response = await api.post<{ success: boolean; data: { imported: number } }>(
      '/library-books/bulk-import',
      { books }
    );
    return response.data.data;
  },

  getBooksSummary: async () => {
    const response = await api.get<{
      success: boolean;
      data: {
        totalBooks: number;
        issuedCount: number;
        overdueCount: number;
        categoryBreakdown: Array<{ category: string; count: number }>;
      };
    }>('/library-books/summary');
    return response.data.data;
  },

  // Issues endpoints
  getIssues: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    memberId?: string;
    bookId?: string;
  }) => {
    const response = await api.get<{
      success: boolean;
      data: BookIssue[];
      pagination?: any;
    }>('/book-issues', { params });
    return {
      data: response.data.data,
      pagination: response.data.pagination,
    };
  },

  getIssueById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: BookIssue }>(
      `/book-issues/${id}`
    );
    return response.data.data;
  },

  createIssue: async (issueData: {
    bookId: string;
    memberId: string;
    dueDate: string;
  }) => {
    const response = await api.post<{ success: boolean; data: BookIssue }>(
      '/book-issues',
      issueData
    );
    return response.data.data;
  },

  returnIssue: async (id: string) => {
    const response = await api.post<{ success: boolean; data: BookIssue }>(
      `/book-issues/${id}/return`,
      {}
    );
    return response.data.data;
  },
};
