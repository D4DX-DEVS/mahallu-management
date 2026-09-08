import { useSearchParams } from 'react-router-dom';
import { FiActivity, FiList, FiCreditCard } from 'react-icons/fi';
import { ROUTES } from '@/constants/routes';
import MemberVarisangyaList from './MemberVarisangyaList';
import MemberVarisangyaTransactions from './MemberVarisangyaTransactions';
import MemberVarisangyaWallet from './MemberVarisangyaWallet';
import PageHeader from '@/components/layout/PageHeader';

export type MemberVarisangyaView = 'transactions' | 'list' | 'wallet';

const VIEW_OPTIONS: { value: MemberVarisangyaView; label: string; icon: React.ReactNode }[] = [
  { value: 'transactions', label: 'Transactions', icon: <FiActivity className="h-4 w-4" /> },
  { value: 'list', label: 'List', icon: <FiList className="h-4 w-4" /> },
  { value: 'wallet', label: 'Wallet History', icon: <FiCreditCard className="h-4 w-4" /> },
];

export default function MemberVarisangyaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get('view') as MemberVarisangyaView) || 'transactions';
  const memberId = searchParams.get('memberId');

  const setView = (newView: MemberVarisangyaView) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', newView);
    if (newView === 'list') {
      next.delete('memberId');
    }
    setSearchParams(next);
  };

  const validView = VIEW_OPTIONS.some((o) => o.value === view) ? view : 'transactions';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Member Varisangya"
        breadcrumbs={[{ label: 'Collectibles', path: ROUTES.COLLECTIBLES.OVERVIEW }]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-1 gap-0.5">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setView(opt.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                validView === opt.value
                  ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {validView === 'list' && <MemberVarisangyaList />}
      {validView === 'transactions' && <MemberVarisangyaTransactions />}
      {validView === 'wallet' && <MemberVarisangyaWallet />}
    </div>
  );
}
