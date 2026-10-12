import { useSearchParams } from 'react-router-dom';
import { FiActivity, FiList, FiCreditCard } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Segmented from '@/components/ui/Segmented';
import FamilyVarisangyaList from './FamilyVarisangyaList';
import FamilyVarisangyaTransactions from './FamilyVarisangyaTransactions';
import FamilyVarisangyaWallet from './FamilyVarisangyaWallet';

export type FamilyVarisangyaView = 'transactions' | 'list' | 'wallet';

const VIEW_OPTIONS: { value: FamilyVarisangyaView; label: string; icon: React.ReactNode }[] = [
  { value: 'transactions', label: 'Transactions', icon: <FiActivity className="h-3.5 w-3.5" /> },
  { value: 'list', label: 'List', icon: <FiList className="h-3.5 w-3.5" /> },
  { value: 'wallet', label: 'Wallet History', icon: <FiCreditCard className="h-3.5 w-3.5" /> },
];

export default function FamilyVarisangyaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get('view') as FamilyVarisangyaView) || 'transactions';
  const familyId = searchParams.get('familyId');

  const setView = (newView: FamilyVarisangyaView) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', newView);
    if (newView === 'list') {
      next.delete('familyId');
    }
    setSearchParams(next);
  };

  const validView = VIEW_OPTIONS.some((o) => o.value === view) ? view : 'transactions';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Family Varisangya"
        actions={
          <Segmented
            aria-label="Family varisangya view"
            value={validView}
            onChange={setView}
            options={VIEW_OPTIONS.map((opt) => ({
              value: opt.value,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  {opt.icon}
                  {opt.label}
                </span>
              ),
            }))}
          />
        }
      />

      {validView === 'list' && <FamilyVarisangyaList />}
      {validView === 'transactions' && <FamilyVarisangyaTransactions />}
      {validView === 'wallet' && <FamilyVarisangyaWallet />}
    </div>
  );
}
