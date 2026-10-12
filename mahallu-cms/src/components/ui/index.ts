// Export all UI components from a single file for easier imports
export { default as Button } from './Button';
export { default as Input } from './Input';
export { default as Select } from './Select';
export { default as Card } from './Card';
export { default as Table } from './Table';
export { default as StatCard } from './StatCard';
export { default as SearchInput } from './SearchInput';
export { default as Checkbox } from './Checkbox';
export { default as Pagination } from './Pagination';
export { default as Modal } from './Modal';
export { default as LoadingSpinner } from './LoadingSpinner';
export { default as EmptyState } from './EmptyState';

export type { ButtonProps } from './Button';
export type { InputProps } from './Input';
export type { SelectProps } from './Select';
export type { CardProps } from './Card';
export type { TableProps } from './Table';
export type { StatCardProps } from './StatCard';
export type { SearchInputProps } from './SearchInput';
export type { CheckboxProps } from './Checkbox';
export type { PaginationProps } from './Pagination';
export type { ModalProps } from './Modal';


// ZAAD redesign building blocks
export { default as Badge } from './Badge';
export { default as StatusBadge, statusTone } from './StatusBadge';
export { default as Segmented } from './Segmented';
export { default as Tabs } from './Tabs';
export { default as PageHeader } from './PageHeader';
export { default as FilterBar } from './FilterBar';
export { default as Skeleton } from './Skeleton';
export { default as Alert } from './Alert';
export type { BadgeProps, BadgeVariant } from './Badge';
export type { StatusBadgeProps } from './StatusBadge';
export type { SegmentedProps, SegmentedOption } from './Segmented';
export type { TabsProps, TabOption } from './Tabs';
export type { PageHeaderProps } from './PageHeader';
export type { FilterBarProps } from './FilterBar';
export type { AlertProps } from './Alert';

// Forms UX
export { default as Stepper } from './Stepper';
export { default as FormSection, ReviewList } from './FormSection';
export { default as StickyActionBar } from './StickyActionBar';
export { default as UnsavedChangesDialog } from './UnsavedChangesDialog';
export { default as PhoneInput } from './PhoneInput';
export { default as AmountInput } from './AmountInput';
export type { StepperProps } from './Stepper';
export type { FormSectionProps } from './FormSection';
export type { StickyActionBarProps } from './StickyActionBar';
export { default as TableColumnMenu } from './TableColumnMenu';
export { default as SavedViews } from './SavedViews';
export { default as AppliedFilters } from './AppliedFilters';
export type { TableColumnMenuProps } from './TableColumnMenu';
export type { SavedViewsProps } from './SavedViews';
export type { AppliedFiltersProps, AppliedFilterConfig } from './AppliedFilters';
export { default as DraftAlert } from './DraftAlert';
export { default as BulkBarButton } from './BulkBarButton';

// Identity & row actions
export { default as IconActionButton, Tooltip } from './IconActionButton';
export { default as RowActions } from './RowActions';
export { default as Avatar, AvatarStack, PersonCell, initialsOf, toneForName } from './Avatar';
export { default as BloodGroupBadge, normalizeBloodGroup } from './BloodGroupBadge';
export { default as GenderChip } from './GenderChip';
export { default as GradeChip } from './GradeChip';
export { default as RoleChip } from './RoleChip';
export type { IconActionButtonProps, IconActionVariant } from './IconActionButton';
export type { RowActionsProps, RowActionExtra } from './RowActions';
export type { AvatarProps, AvatarStackProps, PersonCellProps, AvatarSize, AvatarStatus } from './Avatar';
export type { BloodGroupBadgeProps } from './BloodGroupBadge';
export { default as PhotoUpload } from './PhotoUpload';
export type { PhotoUploadProps } from './PhotoUpload';
export { notify } from '@/utils/notify';
export { getFriendlyError } from '@/utils/apiMessages';

// ZAAD date & time pickers (replace the native browser controls)
export { default as DateInput } from './DateInput';
export { default as DateRangePicker } from './DateRangePicker';
export { default as MonthPicker } from './MonthPicker';
export { default as TimeInput } from './TimeInput';
export { default as DateTimeInput } from './DateTimeInput';
export type { DateInputProps } from './DateInput';
export type { DateRangePickerProps } from './DateRangePicker';
export type { MonthPickerProps } from './MonthPicker';
export type { TimeInputProps } from './TimeInput';
export type { DateTimeInputProps } from './DateTimeInput';
