import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Segmented from '@/components/ui/Segmented';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Alert from '@/components/ui/Alert';
import Ring from '@/components/ui/stat-viz/Ring';
import Bullet from '@/components/ui/stat-viz/Bullet';
import HijriDate from '@/components/HijriDate';
import formatINR from '@/utils/formatINR';
import { campaignService, Campaign, campaignTypeLabel, IslamicSuggestion } from '@/services/campaignService';
import Avatar from '@/components/ui/Avatar';
import { getFriendlyError } from '@/utils/apiMessages';

type Filter = 'all' | 'active' | 'draft' | 'closed';

export function CampaignCard({ campaign, onOpen }: { campaign: Campaign; onOpen: () => void }) {
  const hasTarget = (campaign.targetAmount || 0) > 0;
  return (
    <Card hoverEffect padding="lg" className="cursor-pointer" onClick={onOpen} role="link" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={campaign.name} size={40} />
          <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">{campaignTypeLabel(campaign.type)}</p>
          <h3 className="mt-0.5 truncate text-[15px] font-extrabold text-[#18231E] dark:text-surface-text">{campaign.name}</h3>
          {campaign.nameMl && <p className="truncate font-malayalam text-xs text-[#7B8983] dark:text-surface-muted">{campaign.nameMl}</p>}
          </div>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      <div className="mt-4 flex items-center gap-4">
        {hasTarget ? <Ring percent={campaign.percent || 0} scale={1.8} /> : <span className="h-[61px] w-[61px]" />}
        <div className="min-w-0">
          <p className="text-[22px] font-extrabold leading-none text-primary-700 dark:text-surface-text">{formatINR(campaign.raised)}</p>
          <p className="mt-1 text-xs text-[#7B8983] dark:text-surface-muted">
            {hasTarget ? <>raised of {formatINR(campaign.targetAmount)} ({campaign.percent ?? 0}%)</> : 'raised, no target set'}
          </p>
        </div>
      </div>

      {hasTarget && (
        <div className="mt-3">
          <Bullet percent={campaign.percent || 0} scale={4} />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-[#7B8983] dark:text-surface-muted">
        <span>{campaign.contributionCount} receipt{campaign.contributionCount === 1 ? '' : 's'}</span>
        {campaign.endDate && <span>Ends {new Date(campaign.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
      </div>
    </Card>
  );
}

export default function CampaignsList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [suggestions, setSuggestions] = useState<IslamicSuggestion[]>([]);

  useEffect(() => {
    campaignService.list()
      .then(setItems)
      .catch((e) => setError(getFriendlyError(e, "Couldn't load campaigns. Refresh the page or try again.")))
      .finally(() => setLoading(false));
    campaignService.suggestions().then(setSuggestions).catch(() => setSuggestions([]));
  }, []);

  const shown = items.filter((c) => filter === 'all' || c.status === filter);
  const nextSuggestion = suggestions[0];
  const count = (s: Filter) => (s === 'all' ? items.length : items.filter((c) => c.status === s).length);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Campaigns"
        description="Seasonal collections: Zakat al-Fitr, Udhiya, Ramadan relief and building funds"
        actions={<Button onClick={() => navigate('/campaigns/new')}><FiPlus className="h-3.5 w-3.5" />New campaign</Button>}
      />

      {nextSuggestion && !items.some((c) => c.type === nextSuggestion.suggestedCampaignType && c.status !== 'closed') && (
        <Alert tone="info" title={`${nextSuggestion.label} is coming up`}
          action={<Link to={`/campaigns/new?type=${nextSuggestion.suggestedCampaignType}&date=${nextSuggestion.date.slice(0, 10)}`}><Button size="sm" variant="secondary">Start a campaign</Button></Link>}>
          <HijriDate date={nextSuggestion.date} withGregorian /> (approximate, depends on moon sighting)
        </Alert>
      )}

      <Segmented<Filter>
        aria-label="Filter campaigns"
        value={filter}
        onChange={setFilter}
        options={(['all', 'active', 'draft', 'closed'] as Filter[]).map((f) => ({ value: f, label: f[0].toUpperCase() + f.slice(1), count: count(f) }))}
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : shown.length === 0 ? (
        <Card><EmptyState title="No campaigns here yet" description="Start one for Ramadan, Eid or a building fund and track what has been raised." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => <CampaignCard key={c.id} campaign={c} onOpen={() => navigate(`/campaigns/${c.id}`)} />)}
        </div>
      )}
    </div>
  );
}
