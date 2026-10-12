import type { BadgeVariant } from '@/components/ui/Badge';

/** Display labels and badge colours for asset and maintenance records. */

export const categoryLabels: Record<string, string> = {
  furniture: 'Furniture',
  electronics: 'Electronics',
  vehicle: 'Vehicle',
  building: 'Building',
  land: 'Land',
  equipment: 'Equipment',
  other: 'Other',
};

export const statusLabels: Record<string, string> = {
  active: 'Active',
  in_use: 'In Use',
  under_maintenance: 'Under Maintenance',
  disposed: 'Disposed',
  damaged: 'Damaged',
};

export const maintenanceStatusLabels: Record<string, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const statusTones: Record<string, BadgeVariant> = {
  active: 'success',
  in_use: 'info',
  under_maintenance: 'warning',
  disposed: 'neutral',
  damaged: 'danger',
};

export const maintenanceStatusTones: Record<string, BadgeVariant> = {
  scheduled: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
};
