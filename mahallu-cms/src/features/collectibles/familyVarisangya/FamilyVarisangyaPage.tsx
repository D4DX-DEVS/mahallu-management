import { useSearchParams } from 'react-router-dom';
import { FiActivity, FiList, FiCreditCard } from 'react-icons/fi';
import FamilyVarisangyaList from './FamilyVarisangyaList';
import FamilyVarisangyaTransactions from './FamilyVarisangyaTransactions';
import FamilyVarisangyaWallet from './FamilyVarisangyaWallet';
import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/ui/Tabs';

export type FamilyVarisangyaView = 'transactions' | 'list' | 'wallet';

const VIEW_OPTIONS: { value: FamilyVarisangyaView; label: string; icon: React.ReactNode }[] = [
  { value: 'transactions', label: 'Transactions', icon: <FiActivity className="h-4 w-4" /> },
  { value: 'list', label: 'List', icon: <FiList className="h-4 w-4" /> },
  { value: 'wallet', label: 'Wallet History', icon: <FiCreditCard className="h-4 w-4" /> },
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
    <>
      <PageHeader title="Family varisangya" description="Payments, transactions and wallet history." />

      <div className="mb-4">
        <Tabs
          variant="segmented"
          ariaLabel="Family varisangya view"
          value={validView}
          onChange={(value) => setView(value as FamilyVarisangyaView)}
          items={VIEW_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label, icon: opt.icon }))}
        />
      </div>

      {validView === 'list' && <FamilyVarisangyaList />}
      {validView === 'transactions' && <FamilyVarisangyaTransactions />}
      {validView === 'wallet' && <FamilyVarisangyaWallet />}
    </>
  );
}
