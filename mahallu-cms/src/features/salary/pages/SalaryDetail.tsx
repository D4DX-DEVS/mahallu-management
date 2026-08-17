import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { SalaryPayment } from '@/types';
import { ROUTES } from '@/constants/routes';
import { salaryService } from '@/services/salaryService';

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
      setError(err.response?.data?.message || 'Failed to fetch payment details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageSkeleton />;

  if (error || !payment) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error || 'Payment not found'}</p>
        <Link to={ROUTES.SALARY.LIST} className="mt-4 inline-block"><Button variant="outline">Back to Salary</Button></Link>
      </div>
    );
  }

  const statusColor = payment.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    : payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Salary Payment Detail</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{MONTHS[payment.month]} {payment.year} - {payment.employeeName || 'Employee'}</p>
        </div>
        <div className="flex items-center gap-4">
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Salary', path: ROUTES.SALARY.LIST }, { label: 'Detail' }]} />
          <Link to={ROUTES.SALARY.LIST}><Button variant="outline"><FiArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Payment Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Employee</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{payment.employeeName || '-'}</p>
            </div>
            {payment.instituteName && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Institute</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{payment.instituteName}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Period</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{MONTHS[payment.month]} {payment.year}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
              <p className="mt-1"><span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColor}`}>{payment.status || 'pending'}</span></p>
            </div>
            {payment.paymentDate && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Date</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{new Date(payment.paymentDate).toLocaleDateString()}</p>
              </div>
            )}
            {payment.paymentMethod && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Method</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 capitalize">{payment.paymentMethod.replace('_', ' ')}</p>
              </div>
            )}
            {payment.referenceNo && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Reference No.</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{payment.referenceNo}</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Amount Breakdown</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Base Salary</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">₹{Number(payment.baseSalary || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-green-600 dark:text-green-400">+ Allowances</span>
              <span className="text-green-600 dark:text-green-400 font-medium">₹{Number(payment.allowances || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-red-600 dark:text-red-400">- Deductions</span>
              <span className="text-red-600 dark:text-red-400 font-medium">₹{Number(payment.deductions || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4">
              <span className="text-lg font-semibold text-blue-900 dark:text-blue-200">Net Amount</span>
              <span className="text-2xl font-bold text-blue-900 dark:text-blue-200">₹{Number(payment.netAmount || 0).toLocaleString()}</span>
            </div>
          </div>
          {payment.remarks && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Remarks</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{payment.remarks}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
