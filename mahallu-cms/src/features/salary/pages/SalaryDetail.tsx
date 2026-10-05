import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiTrash2 } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { SalaryPayment } from '@/types';
import { ROUTES } from '@/constants/routes';
import { salaryService } from '@/services/salaryService';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { toTitleCase } from '@/utils/format';

const MONTHS = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function SalaryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [payment, setPayment] = useState<SalaryPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      setError(loadErrorMessage(err, 'payment details'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await salaryService.delete(id);
      navigate(ROUTES.SALARY.LIST);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'delete salary payment' }));
      setDeleting(false);
    }
  };

  if (loading) return <PageSkeleton />;

  if (error || !payment) {
    return (
      <div className="text-center py-10">
        <p className="text-red-600 dark:text-red-400">{error || 'Payment not found'}</p>
        <Link to={ROUTES.SALARY.LIST} className="mt-4 inline-block">
          <Button variant="outline">Back to Salary</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <PageHeader title="Detail" breadcrumbs={[{ label: 'Salary', path: ROUTES.SALARY.LIST }]} />
          <Link to={ROUTES.SALARY.LIST}>
            <Button variant="outline">
              <FiArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <Link to={ROUTES.SALARY.EDIT(payment.id)}>
            <Button icon={<FiEdit2 />} collapseLabel>Edit</Button>
          </Link>
          <Button variant="danger" onClick={() => setShowDeleteModal(true)} icon={<FiTrash2 />} collapseLabel>Delete</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Payment Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Employee</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{payment.employeeName ? toTitleCase(payment.employeeName) : '-'}</p>
            </div>
            {payment.instituteName && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Institute</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{toTitleCase(payment.instituteName)}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Period</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">
                {MONTHS[payment.month]} {payment.year}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
              <p className="mt-1">
                <StatusBadge status={payment.status} />
              </p>
            </div>
            {payment.paymentDate && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Date</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  {new Date(payment.paymentDate).toLocaleDateString()}
                </p>
              </div>
            )}
            {payment.paymentMethod && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Method</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 capitalize">
                  {payment.paymentMethod.replace('_', ' ')}
                </p>
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
          <h2 className="text-lg font-semibold mb-3 text-foreground">Amount Breakdown</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Base Salary</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                ₹{Number(payment.baseSalary || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-green-600 dark:text-green-400">+ Allowances</span>
              <span className="text-green-600 dark:text-green-400 font-medium">
                ₹{Number(payment.allowances || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-red-600 dark:text-red-400">- Deductions</span>
              <span className="text-red-600 dark:text-red-400 font-medium">
                ₹{Number(payment.deductions || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4">
              <span className="text-lg font-semibold text-blue-900 dark:text-blue-200">Net Amount</span>
              <span className="text-2xl font-semibold tabular-nums text-blue-900 dark:text-blue-200">
                ₹{Number(payment.netAmount || 0).toLocaleString()}
              </span>
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

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Salary Payment"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete this salary payment? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
