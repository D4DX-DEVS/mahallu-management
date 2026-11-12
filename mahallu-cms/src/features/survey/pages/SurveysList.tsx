import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Tabs from '@/components/ui/Tabs';
import Select from '@/components/ui/Select';
import StatusBadge from '@/components/ui/StatusBadge';
import FilterPanel from '@/components/ui/FilterPanel';
import TableToolbar from '@/components/ui/TableToolbar';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/layout/PageHeader';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { surveyFormService, SurveyForm, SurveyScope, SURVEY_TYPE_OPTIONS, surveyTypeLabel } from '@/services/surveyFormService';
import { loadErrorMessage } from '@/utils/errors';
import SurveyTabsNav from '../components/SurveyTabsNav';
import GlobalSurveyBadge from '../components/GlobalSurveyBadge';
import { useSurveyAccess } from '../useSurveyAccess';
import { formatPeriod, surveyBadge } from '../surveyDisplay';

const ADMIN_STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'closed', label: 'Closed' },
];

function Progress({ survey }: { survey: SurveyForm }) {
  const done = survey.counts?.responses ?? 0;
  if (!survey.targetCount) return <span className="tabular-nums">{done}</span>;
  const pct = Math.min(100, Math.round((done / survey.targetCount) * 100));
  return (
    <div className="min-w-[7rem]">
      <div className="flex justify-between text-xs tabular-nums">
        <span>
          {done} / {survey.targetCount}
        </span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-subtle" aria-hidden="true">
        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SurveysList() {
  const navigate = useNavigate();
  const { isAdmin } = useSurveyAccess();
  const [rows, setRows] = useState<SurveyForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [scope, setScope] = useState<SurveyScope | ''>('');
  const [search, setSearch] = useState('');
  const [isFilterVisible, setFilterVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await surveyFormService.list({
        page: currentPage,
        limit: itemsPerPage,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(scope ? { scope } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(loadErrorMessage(err, 'surveys'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(fetchRows, search ? 300 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, type, scope, search, currentPage, itemsPerPage]);

  const columns: TableColumn<SurveyForm>[] = [
    {
      key: 'title',
      label: 'Survey',
      width: '16rem',
      render: (_v, row) => (
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate font-medium text-foreground">{row.title}</p>
            {row.scope === 'global' && <GlobalSurveyBadge />}
          </div>
          <p className="truncate text-xs text-muted-foreground">{surveyTypeLabel(row.type)}</p>
        </div>
      ),
    },
    { key: 'startDate', label: 'Period', width: '13rem', priority: 'secondary', render: (_v, row) => formatPeriod(row.startDate, row.endDate) },
    {
      key: 'fillState',
      label: 'Status',
      width: '9rem',
      render: (_v, row) => {
        const badge = surveyBadge(row.fillState);
        return (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status={badge.status} label={badge.label} />
            {row.canManage && row.hasUnpublishedChanges && <span className="text-xs text-amber-600 dark:text-amber-400">Unpublished edits</span>}
          </div>
        );
      },
    },
    {
      key: 'counts',
      label: isAdmin ? 'Responses' : 'My responses',
      width: '9rem',
      sortable: false,
      render: (_v, row) => <Progress survey={isAdmin ? row : { ...row, targetCount: null }} />,
    },
    ...(isAdmin
      ? [
          {
            key: 'pending',
            label: 'To review',
            align: 'center' as const,
            width: '7rem',
            sortable: false,
            priority: 'secondary' as const,
            render: (_v: unknown, row: SurveyForm) =>
              row.counts?.pending ? <span className="font-semibold text-amber-600 dark:text-amber-400">{row.counts.pending}</span> : '—',
          },
        ]
      : [
          {
            key: 'fill',
            label: '',
            align: 'right' as const,
            width: '8rem',
            sortable: false,
            render: (_v: unknown, row: SurveyForm) =>
              row.fillState === 'open' ? (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/survey/${row.id}/fill`);
                  }}
                >
                  Fill form
                </Button>
              ) : null,
          },
        ]),
  ];

  const isFiltered = Boolean(status || type || scope || search);

  return (
    <>
      <PageHeader
        title="Surveys"
        description={isAdmin ? 'Design survey forms, publish them to survey workers and review the responses.' : 'Surveys you can fill for this Mahallu.'}
        actions={
          isAdmin ? (
            <Link to="/survey/create">
              <Button icon={<FiPlus />} collapseLabel>
                New survey
              </Button>
            </Link>
          ) : undefined
        }
      />
      <SurveyTabsNav />

      <TableCard>
        <TableToolbar
          searchQuery={search}
          onSearchChange={(value) => {
            setSearch(value);
            setCurrentPage(1);
          }}
          searchEntity="surveys"
          tabs={
            isAdmin ? (
              <Tabs
                variant="segmented"
                ariaLabel="Survey status"
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setCurrentPage(1);
                }}
                items={ADMIN_STATUS_TABS}
              />
            ) : undefined
          }
          onFilterClick={() => setFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={(type ? 1 : 0) + (scope ? 1 : 0)}
          onRefresh={fetchRows}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setFilterVisible(false)}>
            <div className="w-full sm:w-64">
              <Select
                label="Survey type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setCurrentPage(1);
                }}
                options={[{ value: '', label: 'All types' }, ...SURVEY_TYPE_OPTIONS]}
              />
            </div>
            <div className="w-full sm:w-64">
              <Select
                label="Available to"
                value={scope}
                onChange={(e) => {
                  const value = e.target.value;
                  setScope(value === 'global' || value === 'mahallu' ? value : '');
                  setCurrentPage(1);
                }}
                options={[
                  { value: '', label: 'All surveys' },
                  { value: 'global', label: 'All Mahallus' },
                  { value: 'mahallu', label: 'One Mahallu only' },
                ]}
              />
            </div>
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="surveys" description={error} action={{ label: 'Try again', onClick: fetchRows }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={rows}
              isLoading={loading}
              entity="surveys"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={isAdmin && !isFiltered ? { label: 'New survey', onClick: () => navigate('/survey/create') } : undefined}
              onRowClick={(row) => navigate(`/survey/${row.id}`)}
            />
            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="surveys"
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(size) => {
                    setItemsPerPage(size);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </TableCard>
    </>
  );
}
