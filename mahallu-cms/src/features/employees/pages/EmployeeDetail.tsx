import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiArrowLeft, FiDollarSign } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { Employee } from '@/types';
import { ROUTES } from '@/constants/routes';
import { employeeService } from '@/services/employeeService';
import { formatDate } from '@/utils/format';

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
      setError(err.response?.data?.message || 'Failed to fetch employee');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageSkeleton />;

  if (error || !employee) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error || 'Employee not found'}</p>
        <Link to={ROUTES.EMPLOYEES.LIST} className="mt-4 inline-block">
          <Button variant="outline">Back to Employees</Button>
        </Link>
      </div>
    );
  }

  const statusColor = employee.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    : employee.status === 'on_leave' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{employee.name}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{employee.designation} - {employee.department || 'No Department'}</p>
        </div>
        <div className="flex items-center gap-4">
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Employees', path: ROUTES.EMPLOYEES.LIST }, { label: employee.name }]} />
          <div className="flex gap-2">
            <Link to={ROUTES.EMPLOYEES.LIST}><Button variant="outline"><FiArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
            <Button variant="outline" onClick={() => navigate(`/salary?employeeId=${employee.id}`)}><FiDollarSign className="h-4 w-4 mr-2" />Salary History</Button>
            <Link to={ROUTES.EMPLOYEES.EDIT(employee.id)}><Button><FiEdit2 className="h-4 w-4 mr-2" />Edit</Button></Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{employee.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Designation</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{employee.designation}</p>
            </div>
            {employee.department && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Department</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{employee.department}</p>
              </div>
            )}
            {employee.instituteName && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Institute</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{employee.instituteName}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Join Date</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{formatDate(employee.joinDate)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
              <p className="mt-1"><span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColor}`}>{employee.status === 'on_leave' ? 'On Leave' : employee.status || 'active'}</span></p>
            </div>
            {employee.qualifications && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Qualifications</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{employee.qualifications}</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Contact & Financial</h2>
          <div className="space-y-4">
            {employee.phone && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{employee.phone}</p>
              </div>
            )}
            {employee.email && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{employee.email}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Salary</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100 text-lg font-semibold">₹{employee.salary ? Number(employee.salary).toLocaleString() : '0'}</p>
            </div>
            {employee.bankAccount && (employee.bankAccount.accountNumber || employee.bankAccount.bankName) && (
              <>
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Bank Account</h3>
                </div>
                {employee.bankAccount.bankName && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Bank Name</label>
                    <p className="mt-1 text-gray-900 dark:text-gray-100">{employee.bankAccount.bankName}</p>
                  </div>
                )}
                {employee.bankAccount.accountNumber && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Number</label>
                    <p className="mt-1 text-gray-900 dark:text-gray-100">{employee.bankAccount.accountNumber}</p>
                  </div>
                )}
                {employee.bankAccount.ifscCode && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">IFSC Code</label>
                    <p className="mt-1 text-gray-900 dark:text-gray-100">{employee.bankAccount.ifscCode}</p>
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
