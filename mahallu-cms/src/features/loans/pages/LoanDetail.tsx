import { useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import StatCard from '@/components/ui/StatCard';
import Avatar from '@/components/ui/Avatar';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
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
import { pct } from '@/utils/statSeries';
import StatusBadge from '@/components/ui/StatusBadge';
import { getFriendlyError } from '@/utils/apiMessages';

const Field = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <p className="text-[12px] font-bold uppercase tracking-wider text-[#7B8983] dark:text-surface-muted">{label}</p>
    <p className="text-[13px] font-semibold text-[#18231E] dark:text-surface-text">{value ?? '-'}</p>
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
  const [tab, setTab] = useState<'application' | 'schedule' | 'history'>('application');

  useEffect(() => {
    if (id) fetchLoan(id);
  }, [id]);

  const fetchLoan = async (loanId: string) => {
    try {
      setLoading(true);
      setError(null);
      setLoan(await qardService.getLoan(loanId));
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load the loan. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const scheduleColumns: TableColumn<Installment>[] = [
    { key: 'dueDate', label: 'Due', render: (v) => formatDate(v) },
    { key: 'amount', label: 'Amount', render: (v) => formatCurrency(v) },
    { key: 'paidAmount', label: 'Paid', render: (v) => <span className="font-semibold text-[#0B4837] dark:text-brand-lime">{formatCurrency(v)}</span> },
    {
      key: 'balance',
      label: 'Balance',
      render: (_v, row) => { const bal = Math.max(0, row.amount - row.paidAmount); return <span className={bal > 0 ? 'font-semibold text-[#B3261E] dark:text-red-300' : 'font-semibold text-[#0B4837] dark:text-brand-lime'}>{formatCurrency(bal)}</span>; },
    },
    { key: 'status', label: 'Status', render: (v) => <InstallmentBadge status={v} /> },
  ];

  const repaymentColumns: TableColumn<QardRepayment>[] = [
    { key: 'paymentDate', label: 'Paid on', render: (v) => formatDate(v) },
    { key: 'amount', label: 'Amount', render: (v) => <span className="font-semibold text-[#0B4837] dark:text-brand-lime">{formatCurrency(v)}</span> },
    { key: 'receiptNo', label: 'Receipt', render: (v) => v || '-' },
    { key: 'remarks', label: 'Remarks', render: (v) => v || '-' },
  ];

  if (loading) return <LoadingSpinner />;

  if (error || !loan) {
    return (
      <div className="space-y-4">
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
    <div className="space-y-4">
      <PageHeader
        leading={<Avatar size={56} name={loanApplicantName(loan) === '-' ? '' : loanApplicantName(loan)} src={(loan.applicantMemberId && typeof loan.applicantMemberId === 'object' ? (loan.applicantMemberId as { photoUrl?: string }).photoUrl : undefined)} />}
        title={
          <span className="inline-flex flex-wrap items-center gap-2.5">
            {loanApplicantName(loan)}
            <LoanStatusBadge status={loan.status} />
          </span>
        }
        description="Qard Hasan loan"
        actions={
          <>
            {canMove && (
              <Button variant="secondary" onClick={() => setStatusOpen(true)}>
                Change status
              </Button>
            )}
            {canRepay && <Button onClick={() => setRepayOpen(true)}>Add repayment</Button>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard variant="inline" title="Requested" value={formatCurrency(loan.amount)} viz={loan.approvedAmount ? { type: 'pair', a: loan.amount, b: loan.approvedAmount } : undefined} summary={`Requested ${formatCurrency(loan.amount)}, approved ${loan.approvedAmount ? formatCurrency(loan.approvedAmount) : 'not yet'}`} />
        <StatCard
          variant="inline"
          tone="lime"
          title="Approved"
          value={loan.approvedAmount ? formatCurrency(loan.approvedAmount) : '-'}
          viz={loan.approvedAmount && loan.amount > 0 ? { type: 'bullet', percent: pct(loan.approvedAmount, loan.amount), target: 100 } : undefined}
          summary={`Approved ${loan.approvedAmount ? formatCurrency(loan.approvedAmount) : 'none'} of ${formatCurrency(loan.amount)} requested`}
        />
        <StatCard variant="inline" tone="neutral" title="Repaid" value={formatCurrency(repaid)} viz={principal > 0 ? { type: 'ring', percent: pct(repaid, principal) } : undefined} summary={`Repaid ${formatCurrency(repaid)}, ${pct(repaid, principal)} percent of the loan`} />
        <StatCard variant="inline" tone="gold" title="Outstanding" value={formatCurrency(loan.outstandingBalance)} viz={principal > 0 ? { type: 'segments', segments: [{ value: repaid }, { value: loan.outstandingBalance, color: '#E0B400' }] } : undefined} summary={`Outstanding ${formatCurrency(loan.outstandingBalance)} against ${formatCurrency(repaid)} repaid`} />
      </div>

      <Card>
        <Tabs
          aria-label="Loan sections"
          className="mb-4"
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          tabs={[
            { value: 'application', label: 'Application' },
            { value: 'schedule', label: 'Repayment schedule', count: (loan.repaymentSchedule || []).length },
            { value: 'history', label: 'Repayment history', count: (loan.repayments || []).length },
          ]}
        />

        {tab === 'application' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Field label="Purpose" value={purpose} />
            <Field label="Details" value={loan.purposeDetails || '-'} />
            <Field label="Applied" value={formatDate(loan.appliedDate)} />
            <Field
              label="Disbursed"
              value={loan.disbursedDate ? formatDate(loan.disbursedDate) : '-'}
            />
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
        )}

        {tab === 'schedule' && (
          <Table
            columns={scheduleColumns}
            data={loan.repaymentSchedule || []}
            emptyMessage="The schedule is generated when the loan is disbursed"
          />
        )}

        {tab === 'history' && (
          <Table
            columns={repaymentColumns}
            data={loan.repayments || []}
            emptyMessage="No repayments recorded yet"
          />
        )}
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
