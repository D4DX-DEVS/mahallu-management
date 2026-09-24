import { useNavigate } from 'react-router-dom';
import { FiUsers, FiClipboard, FiBook } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/layout/PageHeader';

export default function SelectUserType() {
  const navigate = useNavigate();

  const userTypes = [
    {
      title: 'Mahall User',
      description: 'Create a user for Mahall management',
      icon: <FiUsers className="h-8 w-8" />,
      path: '/users/mahall/create',
      color: 'blue',
    },
    {
      title: 'Survey User',
      description: 'Create a user for survey operations',
      icon: <FiClipboard className="h-8 w-8" />,
      path: '/users/survey/create',
      color: 'green',
    },
    {
      title: 'Institute User',
      description: 'Create a user for institute management',
      icon: <FiBook className="h-8 w-8" />,
      path: '/users/institute/create',
      color: 'purple',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader
          title="Create New User"
          description="Select the type of user you want to create"
          breadcrumbs={[{ label: 'All Users', path: '/admin/users' }]}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {userTypes.map((type) => (
          <Card
            key={type.path}
            className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
            onClick={() => navigate(type.path)}
          >
            <div className="py-6 text-center space-y-4">
              <div
                className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-${type.color}-100 text-${type.color}-600 dark:bg-${type.color}-900 dark:text-${type.color}-200`}
              >
                {type.icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{type.title}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{type.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
