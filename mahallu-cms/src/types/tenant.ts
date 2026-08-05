export interface Tenant {
  id: string;
  name: string;
  nameMl?: string;
  code: string;
  type: 'standard' | 'premium' | 'enterprise';
  since: string;
  location: string;
  locationMl?: string;
  address: {
    state?: string;
    district?: string;
    pinCode?: string;
    postOffice?: string;
    lsgName?: string;
    village?: string;
  };
  logo?: string;
  status: 'active' | 'suspended' | 'inactive';
  subscription: {
    plan?: string;
    startDate?: string;
    endDate?: string;
    isActive?: boolean;
  };
  settings: {
    varisangyaAmount?: number;
    varisangyaGrades?: Array<{
      name: string;
      amount: number;
    }>;
    educationOptions?: string[];
    areaOptions?: string[];
    features?: Record<string, boolean>;
  };
  createdAt: string;
  updatedAt: string;
  userCount?: number;
}

export interface TenantStats {
  users: number;
  families: number;
  members: number;
}

