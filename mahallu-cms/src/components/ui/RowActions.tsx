/**
 * RowActions - the one consistent set of icon buttons at the end of a table row.
 *
 * Order is fixed: View, Edit, extras, then the danger action last.
 * 3 actions or fewer render inline; with 4 or more the extras move into the
 * existing ActionsMenu kebab (view and edit stay inline, danger stays last).
 *
 * Usage
 *   <RowActions
 *     onView={() => detail.open(id)}                 // Quick view
 *     onEdit={() => navigate(ROUTES.MEMBERS.EDIT(id))}
 *     onDelete={() => setArchiveTarget(row)} deleteLabel="Archive"
 *     extra={[{ label: 'Reprint receipt', icon: <FiPrinter />, onClick: reprint }]}
 *     show={{ edit: canEdit, delete: canDelete }}     // hidden (not faded) when the role may not
 *     disabledReason={{ delete: 'Already archived' }} // faded + tooltip says why
 *   />
 *
 * Props
 *   onView/onEdit/onDelete  handlers; an action without a handler is not rendered
 *   viewLabel='Quick view', editLabel='Edit', deleteLabel='Delete'
 *                           exact verb; "Archive*" picks the archive icon, "Cancel*" the x-circle
 *   deleteIcon              override the danger icon
 *   extra                   [{label, icon, onClick, show?, disabledReason?, variant?: 'default'|'danger'}]
 *   show                    {view?, edit?, delete?} booleans, default true (role gate)
 *   disabledReason          {view?, edit?, delete?} string: action shown disabled with that reason
 *   ariaLabels              optional full accessible names per action, e.g. {edit: 'Edit family'}
 * The wrapper stops click propagation so the row's onRowClick does not fire.
 */
import { ReactNode } from 'react';
import { FiArchive, FiEdit2, FiEye, FiTrash2, FiXCircle, FiMoreVertical } from 'react-icons/fi';
import ActionsMenu, { ActionMenuItem } from './ActionsMenu';
import IconActionButton from './IconActionButton';
import { cn } from '@/utils/cn';

export interface RowActionExtra {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  show?: boolean;
  disabledReason?: string;
  variant?: 'default' | 'danger';
}

export interface RowActionsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  viewLabel?: string;
  editLabel?: string;
  deleteLabel?: string;
  deleteIcon?: ReactNode;
  extra?: RowActionExtra[];
  show?: { view?: boolean; edit?: boolean; delete?: boolean };
  disabledReason?: { view?: string; edit?: string; delete?: string };
  ariaLabels?: { view?: string; edit?: string; delete?: string };
  className?: string;
}

function dangerIcon(label: string) {
  if (/^archive/i.test(label)) return <FiArchive />;
  if (/^cancel/i.test(label)) return <FiXCircle />;
  return <FiTrash2 />;
}

export default function RowActions({
  onView,
  onEdit,
  onDelete,
  viewLabel = 'Quick view',
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  deleteIcon,
  extra = [],
  show = {},
  disabledReason = {},
  ariaLabels = {},
  className,
}: RowActionsProps) {
  const showView = !!onView && show.view !== false;
  const showEdit = !!onEdit && show.edit !== false;
  const showDelete = !!onDelete && show.delete !== false;
  const extras = extra.filter((x) => x.show !== false);

  const total = (showView ? 1 : 0) + (showEdit ? 1 : 0) + extras.length + (showDelete ? 1 : 0);
  const collapse = total > 3 && extras.length > 0;

  const menuItems: ActionMenuItem[] = extras
    .filter((x) => !x.disabledReason)
    .map((x) => ({ label: x.label, icon: x.icon, onClick: x.onClick, variant: x.variant === 'danger' ? 'danger' : 'default' }));

  if (total === 0) return null;

  return (
    <div className={cn('flex items-center gap-2 sm:gap-1.5', className)} onClick={(e) => e.stopPropagation()}>
      {showView && (
        <IconActionButton
          variant="view"
          label={ariaLabels.view ?? viewLabel}
          icon={<FiEye />}
          onClick={onView}
          disabled={!!disabledReason.view}
          disabledReason={disabledReason.view}
        />
      )}
      {showEdit && (
        <IconActionButton
          variant="edit"
          label={ariaLabels.edit ?? editLabel}
          icon={<FiEdit2 />}
          onClick={onEdit}
          disabled={!!disabledReason.edit}
          disabledReason={disabledReason.edit}
        />
      )}
      {collapse ? (
        menuItems.length > 0 && <ActionsMenu items={menuItems} />
      ) : (
        extras.map((x, i) => (
          <IconActionButton
            key={`${x.label}-${i}`}
            variant={x.variant === 'danger' ? 'danger' : 'ghost'}
            label={x.label}
            icon={x.icon ?? <FiMoreVertical />}
            onClick={x.onClick}
            disabled={!!x.disabledReason}
            disabledReason={x.disabledReason}
          />
        ))
      )}
      {showDelete && (
        <IconActionButton
          variant="danger"
          label={ariaLabels.delete ?? deleteLabel}
          icon={deleteIcon ?? dangerIcon(deleteLabel)}
          onClick={onDelete}
          disabled={!!disabledReason.delete}
          disabledReason={disabledReason.delete}
        />
      )}
    </div>
  );
}
