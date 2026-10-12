import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import StatusBadge from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { SalaryPayment } from '@/types';
import { ROUTES } from '@/constants/routes';
import { salaryService } from '@/services/salaryService';
import { getFriendlyError } from '@/utils/apiMessages';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function SalaryDetail() {
  const { id } = useParams<{ id: string }>();
  const [payment, setPayment] = useState<SalaryPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchPayment();
  }, [id]);

  const fetchPayment = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await salaryService.getById(id);
      setPayment(data);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load payment details. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><LoadingSpinner /></div>;

  if (error || !payment) {
    return (
      <div className="text-center py-12">
        <p className="text-[#B3261E] dark:text-red-300">{error || 'Payment not found'}</p>
        <Link to={ROUTES.SALARY.LIST} className="mt-4 inline-block"><Button variant="secondary">Back to Salary</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        leading={payment.employeeName ? <Avatar size={56} name={payment.employeeName} /> : undefined}
        title="Salary Payment Detail"
        description={`${MONTHS[payment.month]} ${payment.year} - ${payment.employeeName || 'Employee'}`}
        actions={<Link to={ROUTES.SALARY.LIST}><Button variant="secondary"><FiArrowLeft className="h-3.5 w-3.5" />Back</Button></Link>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="lg">
          <h2 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Payment Information</h2>
          <div className="space-y-3">
            <div>
              <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Employee</label>
              {payment.employeeName ? <div className="mt-1"><PersonCell name={payment.employeeName} size={32} /></div> : <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">-</p>}
            </div>
            {payment.instituteName && (
              <div>
                <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Institute</label>
                <div className="mt-0.5"><PersonCell name={payment.instituteName} size={24} /></div>
              </div>
            )}
            <div>
              <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Period</label>
              <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{MONTHS[payment.month]} {payment.year}</p>
            </div>
            <div>
              <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Status</label>
              <p className="mt-1"><StatusBadge status={payment.status || 'pending'} /></p>
            </div>
            {payment.paymentDate && (
              <div>
                <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Payment Date</label>
                <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{new Date(payment.paymentDate).toLocaleDateString()}</p>
              </div>
            )}
            {payment.paymentMethod && (
              <div>
                <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Payment Method</label>
                <p className="mt-0.5"><StatusBadge status={payment.paymentMethod} tone="neutral" dot={false} /></p>
              </div>
            )}
            {payment.referenceNo && (
              <div>
                <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Reference No.</label>
                <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{payment.referenceNo}</p>
              </div>
            )}
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Amount Breakdown</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 text-[13px] border-b border-line dark:border-surface-border">
              <span className="text-[13px] text-[#5B6963] dark:text-surface-muted">Base Salary</span>
              <span className="text-[#18231E] dark:text-surface-text font-medium">₹{Number(payment.baseSalary || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-[13px] border-b border-line dark:border-surface-border">
              <span className="text-primary-600 dark:text-primary-400">+ Allowances</span>
              <span className="text-primary-600 dark:text-primary-400 font-medium">₹{Number(payment.allowances || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-[13px] border-b border-line dark:border-surface-border">
              <span className="text-[#B3261E] dark:text-red-300">- Deductions</span>
              <span className="text-[#B3261E] dark:text-red-300 font-medium">₹{Number(payment.deductions || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-mint px-4 py-3 dark:bg-brand-lime/10">
              <span className="text-[13px] font-bold text-primary-700 dark:text-brand-lime">Net Amount</span>
              <span className="text-xl font-extrabold text-primary-700 dark:text-brand-lime">₹{Number(payment.netAmount || 0).toLocaleString()}</span>
            </div>
          </div>
          {payment.remarks && (
            <div className="mt-4 pt-4 border-t border-line dark:border-surface-border">
              <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Remarks</label>
              <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{payment.remarks}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
