import { useNavigate } from 'react-router-dom';
import { FiUsers, FiClipboard, FiBook } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';

export default function SelectUserType() {
  const navigate = useNavigate();

  const userTypes = [
    {
      title: 'Mahall User',
      description: 'Create a user for Mahall management',
      icon: <FiUsers className="h-7 w-7" />,
      path: '/users/mahall/create',
    },
    {
      title: 'Survey User',
      description: 'Create a user for survey operations',
      icon: <FiClipboard className="h-7 w-7" />,
      path: '/users/survey/create',
    },
    {
      title: 'Institute User',
      description: 'Create a user for institute management',
      icon: <FiBook className="h-7 w-7" />,
      path: '/users/institute/create',
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create New User"
        description="Select the type of user you want to create"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {userTypes.map((type) => (
          <Card
            key={type.path}
            className="cursor-pointer" hoverEffect
            onClick={() => navigate(type.path)}
          >
            <div className="p-6 text-center space-y-4">
              <div
                className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-mint text-primary-600 dark:bg-brand-lime/15 dark:text-brand-lime"
              >
                {type.icon}
              </div>
              <div>
                <h3 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">
                  {type.title}
                </h3>
                <p className="mt-1 text-sm text-[#7B8983] dark:text-surface-muted">
                  {type.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
