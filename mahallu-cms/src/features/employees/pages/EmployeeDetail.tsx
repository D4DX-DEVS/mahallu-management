import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiArrowLeft, FiDollarSign } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import StatusBadge from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Employee } from '@/types';
import { ROUTES } from '@/constants/routes';
import { employeeService } from '@/services/employeeService';
import { formatDate } from '@/utils/format';
import { getFriendlyError } from '@/utils/apiMessages';

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchEmployee();
  }, [id]);

  const fetchEmployee = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await employeeService.getById(id);
      setEmployee(data);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load employee. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><LoadingSpinner /></div>;

  if (error || !employee) {
    return (
      <div className="text-center py-12">
        <p className="text-[#B3261E] dark:text-red-300">{error || 'Employee not found'}</p>
        <Link to={ROUTES.EMPLOYEES.LIST} className="mt-4 inline-block">
          <Button variant="secondary">Back to Employees</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        leading={<Avatar size={56} name={employee.name} />}
        title={employee.name}
        description={`${employee.designation} - ${employee.department || 'No Department'}`}
        actions={
          <>
            <Link to={ROUTES.EMPLOYEES.LIST}><Button variant="secondary"><FiArrowLeft className="h-3.5 w-3.5" />Back</Button></Link>
            <Button variant="secondary" onClick={() => navigate(`/salary?employeeId=${employee.id}`)}><FiDollarSign className="h-3.5 w-3.5" />Salary History</Button>
            <Link to={ROUTES.EMPLOYEES.EDIT(employee.id)}><Button><FiEdit2 className="h-3.5 w-3.5" />Edit</Button></Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card padding="lg">
          <h2 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Basic Information</h2>
          <div className="space-y-3">
            <div>
              <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Name</label>
              <div className="mt-0.5"><PersonCell name={employee.name} size={24} /></div>
            </div>
            <div>
              <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Designation</label>
              <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{employee.designation}</p>
            </div>
            {employee.department && (
              <div>
                <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Department</label>
                <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{employee.department}</p>
              </div>
            )}
            {employee.instituteName && (
              <div>
                <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Institute</label>
                <div className="mt-0.5"><PersonCell name={employee.instituteName} size={24} /></div>
              </div>
            )}
            <div>
              <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Join Date</label>
              <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{formatDate(employee.joinDate)}</p>
            </div>
            <div>
              <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Status</label>
              <p className="mt-1"><StatusBadge status={employee.status || 'active'} label={employee.status === 'on_leave' ? 'On Leave' : undefined} tone={employee.status === 'on_leave' ? 'warning' : employee.status === 'resigned' || employee.status === 'terminated' ? 'neutral' : undefined} /></p>
            </div>
            {employee.qualifications && (
              <div>
                <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Qualifications</label>
                <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{employee.qualifications}</p>
              </div>
            )}
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Contact & Financial</h2>
          <div className="space-y-3">
            {employee.phone && (
              <div>
                <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Phone</label>
                <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{employee.phone}</p>
              </div>
            )}
            {employee.email && (
              <div>
                <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Email</label>
                <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{employee.email}</p>
              </div>
            )}
            <div>
              <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Monthly Salary</label>
              <p className="mt-0.5 text-base font-extrabold text-primary-700 dark:text-surface-text">₹{employee.salary ? Number(employee.salary).toLocaleString() : '0'}</p>
            </div>
            {employee.bankAccount && (employee.bankAccount.accountNumber || employee.bankAccount.bankName) && (
              <>
                <div className="pt-3 border-t border-line dark:border-surface-border">
                  <h3 className="mb-1 text-xs font-bold text-[#3A4741] dark:text-surface-text">Bank Account</h3>
                </div>
                {employee.bankAccount.bankName && (
                  <div>
                    <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Bank Name</label>
                    <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{employee.bankAccount.bankName}</p>
                  </div>
                )}
                {employee.bankAccount.accountNumber && (
                  <div>
                    <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Account Number</label>
                    <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{employee.bankAccount.accountNumber}</p>
                  </div>
                )}
                {employee.bankAccount.ifscCode && (
                  <div>
                    <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">IFSC Code</label>
                    <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{employee.bankAccount.ifscCode}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
