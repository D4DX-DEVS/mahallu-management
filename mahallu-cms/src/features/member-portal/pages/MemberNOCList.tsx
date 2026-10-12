import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { memberPortalService } from '@/services/memberPortalService';
import { downloadNocPdf } from '@/utils/nocPdf';
import { ROUTES } from '@/constants/routes';
import { FiRefreshCw, FiDownload } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Alert from '@/components/ui/Alert';
import { TableColumn } from '@/types';
import RowActions from '@/components/ui/RowActions';
import { getFriendlyError } from '@/utils/apiMessages';

export default function MemberNOCList() {
  const [nocs, setNocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const result = await memberPortalService.getOwnRegistrations('noc');
      setNocs(result.noc || []);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load NOC records. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  // Silently refresh when the tab regains focus so newly created NOCs appear
  useEffect(() => {
    const onFocus = () => load(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleDownload = async (noc: any) => {
    setDownloading(noc.id);
    try {
      const mahalluName =
        noc.tenantId && typeof noc.tenantId === 'object'
          ? noc.tenantId.name
          : undefined;
      await downloadNocPdf(
        {
          id: noc.id,
          applicantName: noc.applicantName,
          applicantPhone: noc.applicantPhone,
          type: noc.type,
          purposeTitle: noc.purposeTitle,
          purposeDescription: noc.purposeDescription,
          purpose: noc.purpose,
          status: noc.status,
          issuedDate: noc.issuedDate,
          createdAt: noc.createdAt,
          nikahRegistrationId: noc.nikahRegistrationId,
          remarks: noc.remarks,
          mahalluName,
          approvedBy: noc.approvedBy,
        } as any,
        `noc-${noc.type}-${noc.id}`
      );
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-140px)]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6">
        <Alert tone="danger">{error}</Alert>
      </div>
    );
  }

  const columns: TableColumn<any>[] = [
    {
      key: 'type',
      label: 'Type',
      render: (v) => <StatusBadge status={v} label={v === 'nikah' ? 'Nikah' : 'Common'} tone={v === 'nikah' ? 'info' : 'neutral'} dot={false} />,
    },
    {
      key: 'purposeTitle',
      label: 'Purpose / Title',
      render: (_, noc) => (
        <span className="block max-w-xs truncate">
          {noc.purposeTitle ||
            (noc.nikahRegistrationId?.brideName
              ? `Nikah with ${noc.nikahRegistrationId.brideName}`
              : '—')}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Applied On',
      render: (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v || 'pending'} />,
    },
    {
      key: 'actions',
      hideable: false,
      label: 'Actions',
      render: (_, noc) =>
        <RowActions
          extra={[
            {
              label: 'Download certificate',
              icon: <FiDownload />,
              onClick: () => handleDownload(noc),
              disabledReason:
                noc.status === 'approved'
                  ? downloading === noc.id ? 'Generating…' : undefined
                  : noc.status === 'pending' ? 'Awaiting approval' : 'Not available: this request was rejected',
            },
          ]}
        />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="My NOCs"
        description="Track your no-objection certificate requests"
        actions={
          <>
            <Button variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>
              <FiRefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Link to={ROUTES.MEMBER.NOC_REQUEST}>
              <Button>+ Request NOC</Button>
            </Link>
          </>
        }
      />

      {nocs.length === 0 ? (
        <Card>
          <EmptyState
            title="No NOC requests found"
            description="Submit your first NOC request to get started."
            action={undefined}
          />
          <div className="pb-6 text-center">
            <Link
              to={ROUTES.MEMBER.NOC_REQUEST}
              className="text-[13px] font-semibold text-primary-600 hover:underline dark:text-brand-lime"
            >
              Submit your first NOC request →
            </Link>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="p-3.5">
            <Table columns={columns} data={nocs} showExport={false} getRowId={(row, i) => String(row.id ?? i)} />
          </div>
        </Card>
      )}
    </div>
  );
}
