import { useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import StatCard from '@/components/ui/StatCard';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { TableColumn } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  qardService,
  QardLoan,
  QardRepayment,
  Installment,
  LOAN_PURPOSE_OPTIONS,
  LOAN_TRANSITIONS,
  loanApplicantName,
} from '@/services/qardService';
import LoanStatusBadge, { InstallmentBadge } from '../components/LoanStatusBadge';
import RepaymentModal from '../components/RepaymentModal';
import LoanStatusModal from '../components/LoanStatusModal';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const Field = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{value ?? '-'}</p>
  </div>
);

export default function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<QardLoan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repayOpen, setRepayOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    if (id) fetchLoan(id);
  }, [id]);

  const fetchLoan = async (loanId: string) => {
    try {
      setLoading(true);
      setError(null);
      setLoan(await qardService.getLoan(loanId));
    } catch (err: any) {
      setError(loadErrorMessage(err, 'the loan'));
    } finally {
      setLoading(false);
    }
  };

  const scheduleColumns: TableColumn<Installment>[] = [
    { key: 'dueDate', label: 'Due', render: (v) => formatDate(v) },
    { key: 'amount', label: 'Amount', render: (v) => formatCurrency(v) },
    { key: 'paidAmount', label: 'Paid', render: (v) => formatCurrency(v) },
    {
      key: 'balance',
      label: 'Balance',
      render: (_v, row) => formatCurrency(Math.max(0, row.amount - row.paidAmount)),
    },
    { key: 'status', label: 'Status', render: (v) => <InstallmentBadge status={v} /> },
  ];

  const repaymentColumns: TableColumn<QardRepayment>[] = [
    { key: 'paymentDate', label: 'Paid on', render: (v) => formatDate(v) },
    { key: 'amount', label: 'Amount', render: (v) => formatCurrency(v) },
    { key: 'receiptNo', label: 'Receipt', render: (v) => v || '-' },
    { key: 'remarks', label: 'Remarks', render: (v) => v || '-' },
  ];

  if (loading) return <PageSkeleton />;

  if (error || !loan) {
    return (
      <div>
        <PageHeader title="Qard Hasan" breadcrumbs={[{ label: 'Services' }]} />
        <Card>
          <p className="text-sm text-red-600 dark:text-red-400">{error || 'Loan not found'}</p>
          <Button className="mt-3" variant="secondary" onClick={() => navigate('/loans')}>
            Back to loans
          </Button>
        </Card>
      </div>
    );
  }

  const canRepay = ['disbursed', 'repaying'].includes(loan.status) && loan.outstandingBalance > 0;
  const canMove = (LOAN_TRANSITIONS[loan.status] || []).length > 0;
  const purpose = LOAN_PURPOSE_OPTIONS.find((o) => o.value === loan.purpose)?.label || loan.purpose;
  const principal = loan.approvedAmount ?? loan.amount;
  const repaid = Math.max(0, principal - loan.outstandingBalance);

  return (
    <div>
      <PageHeader
        title="loanApplicantName(loan)"
        breadcrumbs={[{ label: 'Services' }, { label: 'Qard Hasan', path: '/loans' }]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <LoanStatusBadge status={loan.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {canMove && (
            <Button variant="secondary" onClick={() => setStatusOpen(true)}>
              Change status
            </Button>
          )}
          {canRepay && <Button onClick={() => setRepayOpen(true)}>Add repayment</Button>}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Requested" value={formatCurrency(loan.amount)} />
        <StatCard title="Approved" value={loan.approvedAmount ? formatCurrency(loan.approvedAmount) : '-'} />
        <StatCard title="Repaid" value={formatCurrency(repaid)} />
        <StatCard title="Outstanding" value={formatCurrency(loan.outstandingBalance)} />
      </div>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Application</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Purpose" value={purpose} />
          <Field label="Details" value={loan.purposeDetails || '-'} />
          <Field label="Applied" value={formatDate(loan.appliedDate)} />
          <Field label="Disbursed" value={loan.disbursedDate ? formatDate(loan.disbursedDate) : '-'} />
          <Field label="Term" value={`${loan.repaymentMonths} months`} />
          <Field
            label="Monthly"
            value={loan.monthlyInstallment ? formatCurrency(loan.monthlyInstallment) : '-'}
          />
          <Field
            label="Family"
            value={loan.familyId && typeof loan.familyId === 'object' ? loan.familyId.houseName : '-'}
          />
          <Field label="Notes" value={loan.notes || '-'} />
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Repayment schedule</h2>
        <Table
          columns={scheduleColumns}
          data={loan.repaymentSchedule || []}
          emptyMessage="The schedule is generated when the loan is disbursed"
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Repayment history</h2>
        <Table
          columns={repaymentColumns}
          data={loan.repayments || []}
          emptyMessage="No repayments recorded yet"
        />
      </Card>

      <RepaymentModal
        isOpen={repayOpen}
        onClose={() => setRepayOpen(false)}
        loanId={loan.id}
        outstandingBalance={loan.outstandingBalance}
        onRecorded={() => id && fetchLoan(id)}
      />

      <LoanStatusModal
        isOpen={statusOpen}
        onClose={() => setStatusOpen(false)}
        loan={loan}
        onUpdated={() => id && fetchLoan(id)}
      />
    </div>
  );
}
