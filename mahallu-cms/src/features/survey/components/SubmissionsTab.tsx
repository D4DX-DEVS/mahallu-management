import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDownload } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Table from '@/components/ui/Table';
import Tabs from '@/components/ui/Tabs';
import Select from '@/components/ui/Select';
import MultiSelect from '@/components/ui/MultiSelect';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import FilterPanel from '@/components/ui/FilterPanel';
import TableToolbar from '@/components/ui/TableToolbar';
import DateRangePicker from '@/components/ui/DateRangePicker';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType, TableColumn } from '@/types';
import {
  surveyFormService,
  SurveyForm,
  SurveySubmission,
  SubmissionFilters,
  SubmissionListMeta,
} from '@/services/surveyFormService';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { downloadBlob } from '@/utils/exportUtils';
import { FIELD_TYPES, SurveyField, SurveyFormContent, allFields, answerKey } from '../formEngine';
import { SUBMISSION_STATUS_LABELS, formatDateTime } from '../surveyDisplay';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'respondent', label: 'Respondent A–Z' },
];

/** Every submitted response of one survey, for the Mahallu admin to review. */
export default function SubmissionsTab({ survey }: { survey: SurveyForm }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SurveySubmission[]>([]);
  const [meta, setMeta] = useState<SubmissionListMeta | null>(null);
  const [form, setForm] = useState<SurveyFormContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [surveyor, setSurveyor] = useState('');
  const [sort, setSort] = useState('newest');
  const [answerFilters, setAnswerFilters] = useState<Record<string, string[]>>({});
  const [isFilterVisible, setFilterVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  useEffect(() => {
    if (!survey.publishedVersion) return;
    surveyFormService
      .getForm(survey.id)
      .then((data) => setForm(data.version.content))
      .catch(() => setForm(null));
  }, [survey.id, survey.publishedVersion]);

  const filterableFields: SurveyField[] = useMemo(
    () => (form ? allFields(form).filter((f) => FIELD_TYPES[f.type].filterable && f.enabled !== false) : []),
    [form]
  );

  const params = (): SubmissionFilters => {
    const answers = Object.fromEntries(Object.entries(answerFilters).filter(([, v]) => v.length > 0));
    return {
      ...(status ? { status } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(surveyor ? { submittedBy: surveyor } : {}),
      ...(Object.keys(answers).length ? { answers: JSON.stringify(answers) } : {}),
      sort,
    };
  };

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await surveyFormService.listSubmissions(survey.id, { ...params(), page: currentPage, limit: itemsPerPage });
      setRows(result.data);
      setPagination(result.pagination);
      setMeta(result.meta);
    } catch (err) {
      setError(loadErrorMessage(err, 'responses'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(fetchRows, search ? 300 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey.id, status, search, from, to, surveyor, sort, answerFilters, currentPage, itemsPerPage]);

  const resetPage = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setCurrentPage(1);
  };

  const exportCsv = async () => {
    try {
      setExporting(true);
      const blob = await surveyFormService.exportSubmissions(survey.id, params());
      const name = survey.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'survey';
      downloadBlob(blob, `${name}-responses.csv`);
    } catch (err) {
      toast.error(errorMessage(err, { action: 'export the responses' }));
    } finally {
      setExporting(false);
    }
  };

  const activeFilterCount =
    (from || to ? 1 : 0) + (surveyor ? 1 : 0) + Object.values(answerFilters).filter((v) => v.length > 0).length;
  const isFiltered = activeFilterCount > 0 || Boolean(search);
  const counts = meta?.statusCounts;

  const columns: TableColumn<SurveySubmission>[] = [
    { key: 'submittedAt', label: 'Submitted', width: '11rem', render: (v) => formatDateTime(v) },
    {
      key: 'respondentName',
      label: survey.respondentType === 'member' ? 'Member' : survey.respondentType === 'family' ? 'Family' : 'Respondent',
      width: '14rem',
      render: (v) => (v ? <span className="font-medium text-foreground">{v}</span> : <span className="text-muted-foreground">—</span>),
    },
    { key: 'submittedByName', label: 'Surveyor', width: '10rem', priority: 'secondary', render: (v) => v || '—' },
    { key: 'version', label: 'Form', width: '5rem', align: 'center', priority: 'tertiary', render: (v) => `v${v}` },
    {
      key: 'status',
      label: 'Status',
      width: '9rem',
      render: (v) => <StatusBadge status={v} label={SUBMISSION_STATUS_LABELS[v]} />,
    },
  ];

  const clearFilters = () => {
    setFrom('');
    setTo('');
    setSurveyor('');
    setAnswerFilters({});
    setCurrentPage(1);
  };

  return (
    <TableCard>
      <TableToolbar
        searchQuery={search}
        onSearchChange={resetPage(setSearch)}
        searchEntity="respondents or surveyors"
        tabs={
          <Tabs
            variant="segmented"
            ariaLabel="Response status"
            value={status}
            onChange={resetPage(setStatus)}
            items={[
              { value: 'pending', label: 'Pending', count: counts?.pending },
              { value: 'accepted', label: 'Accepted', count: counts?.accepted },
              { value: 'rejected', label: 'Rejected', count: counts?.rejected },
              { value: '', label: 'All', count: counts?.all },
            ]}
          />
        }
        sortOptions={SORT_OPTIONS}
        sortValue={sort}
        onSortChange={resetPage(setSort)}
        onFilterClick={() => setFilterVisible((open) => !open)}
        isFilterVisible={isFilterVisible}
        hasFilters
        activeFilterCount={activeFilterCount}
        onRefresh={fetchRows}
        actionButtons={
          <Button variant="outline" icon={<FiDownload />} collapseLabel onClick={exportCsv} isLoading={exporting} loadingText="Exporting">
            Export CSV
          </Button>
        }
      />

      {isFilterVisible && (
        <FilterPanel onClose={() => setFilterVisible(false)}>
          <div className="w-full sm:w-72">
            <DateRangePicker
              label="Submitted between"
              from={from}
              to={to}
              clearable
              onChange={(f, t) => {
                setFrom(f);
                setTo(t);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="w-full sm:w-56">
            <Select
              label="Surveyor"
              value={surveyor}
              onChange={(e) => resetPage(setSurveyor)(e.target.value)}
              options={[{ value: '', label: 'All surveyors' }, ...(meta?.surveyors || []).map((s) => ({ value: s.id, label: `${s.name} (${s.count})` }))]}
            />
          </div>
          {filterableFields.map((field) => {
            const key = answerKey(field.id);
            const value = answerFilters[key] || [];
            const set = (next: string[]) => {
              setAnswerFilters((prev) => ({ ...prev, [key]: next }));
              setCurrentPage(1);
            };
            if (field.type === 'checkbox') {
              return (
                <div key={key} className="w-full sm:w-56">
                  <Select
                    label={field.label}
                    value={value[0] || ''}
                    onChange={(e) => set(e.target.value ? [e.target.value] : [])}
                    options={[
                      { value: '', label: 'Any' },
                      { value: 'true', label: 'Yes' },
                      { value: 'false', label: 'No' },
                    ]}
                  />
                </div>
              );
            }
            return (
              <div key={key} className="w-full sm:w-64">
                <MultiSelect
                  label={field.label}
                  placeholder="Any answer"
                  value={value}
                  onChange={set}
                  options={(field.options || []).map((o) => ({ value: o.value, label: o.label }))}
                />
              </div>
            );
          })}
          {activeFilterCount > 0 && (
            <Button variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </FilterPanel>
      )}

      {error ? (
        <EmptyState variant="error" entity="responses" description={error} action={{ label: 'Try again', onClick: fetchRows }} />
      ) : (
        <>
          <Table
            fixedLayout
            serverSorted
            columns={columns}
            data={rows}
            isLoading={loading}
            entity="responses"
            emptyVariant={isFiltered ? 'no-results' : 'empty'}
            onRowClick={(row) => navigate(`/survey/${survey.id}/responses/${row.id}`)}
          />
          {pagination && (
            <div className="mt-4">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                itemsPerPage={pagination.limit}
                entity="responses"
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
  );
}
