import { useSearchParams } from 'react-router-dom';
import { FiActivity, FiList, FiCreditCard } from 'react-icons/fi';
import MemberVarisangyaList from './MemberVarisangyaList';
import MemberVarisangyaTransactions from './MemberVarisangyaTransactions';
import MemberVarisangyaWallet from './MemberVarisangyaWallet';
import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/ui/Tabs';

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
    <>
      <PageHeader title="Member varisangya" description="Payments, transactions and wallet history." />

      <div className="mb-4">
        <Tabs
          variant="segmented"
          ariaLabel="Member varisangya view"
          value={validView}
          onChange={(value) => setView(value as MemberVarisangyaView)}
          items={VIEW_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label, icon: opt.icon }))}
        />
      </div>

      {validView === 'list' && <MemberVarisangyaList />}
      {validView === 'transactions' && <MemberVarisangyaTransactions />}
      {validView === 'wallet' && <MemberVarisangyaWallet />}
    </>
  );
}
