/*
 * Product mockups shown on the landing page: the admin dashboard and families
 * list inside a laptop, and the member portal inside a phone. Everything here
 * is static demo data, never real member records.
 */
import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import {
  FiSearch,
  FiBell,
  FiChevronDown,
  FiChevronRight,
  FiUsers,
  FiClock,
  FiTrendingUp,
  FiHome,
  FiGrid,
  FiCreditCard,
  FiUser,
  FiFileText,
  FiInbox,
  FiPlus,
  FiMoreVertical,
} from 'react-icons/fi';
import { ICON_PATH } from '@/constants/theme';
import { ScaledFrame } from './shared';

const LAPTOP_W = 720;
const LAPTOP_H = 436;
const PHONE_W = 190;
const PHONE_H = 390;

export function LaptopFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <ScaledFrame width={LAPTOP_W} height={LAPTOP_H} className={className}>
      <div className="relative" style={{ width: LAPTOP_W, height: LAPTOP_H }}>
        <div className="absolute left-[40px] top-0 h-[420px] w-[640px] rounded-[18px] bg-[#1A1F24] p-[10px] shadow-[0_40px_70px_-30px_rgba(10,25,18,0.55)]">
          <div className="h-full w-full overflow-hidden rounded-[8px] bg-white">{children}</div>
        </div>
        <div className="absolute bottom-0 left-0 h-[16px] w-full rounded-b-[14px] bg-[linear-gradient(180deg,#3A414A_0%,#262B31_100%)]">
          <div className="mx-auto h-[5px] w-[90px] rounded-b-[6px] bg-[#1A1F24]" />
        </div>
      </div>
    </ScaledFrame>
  );
}

export function PhoneFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <ScaledFrame width={PHONE_W} height={PHONE_H} className={className}>
      <div
        className="rounded-[32px] bg-[#1A1F24] p-[7px] shadow-[0_30px_50px_-24px_rgba(10,25,18,0.6)]"
        style={{ width: PHONE_W, height: PHONE_H }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[26px] bg-[#F3F6F4]">
          <div className="absolute left-1/2 top-[6px] z-10 h-[14px] w-[56px] -translate-x-1/2 rounded-full bg-[#1A1F24]" />
          {children}
        </div>
      </div>
    </ScaledFrame>
  );
}

/* ---------------------------------------------------------------- admin app */

const SIDEBAR_ITEMS = [
  'Dashboard',
  'Families',
  'Collection',
  'Certificates',
  'Welfare & Zakat',
  'Madrasa',
  'Qabaristan',
  'Accounts',
  'Reports',
  'Settings',
];

function Sidebar({ active }: { active: string }) {
  return (
    <aside className="flex h-full w-[112px] shrink-0 flex-col bg-[#0F3D28] px-3 py-3 text-white">
      <div className="flex items-center gap-2 px-1">
        <img src={ICON_PATH} alt="" className="h-5 w-5 rounded-[5px]" />
        <span className="text-[11px] font-extrabold tracking-wide">ZAAD</span>
      </div>
      <ul className="mt-4 space-y-[3px]">
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = item === active;
          return (
            <li
              key={item}
              className={`flex items-center gap-2 whitespace-nowrap rounded-[6px] px-2 py-[5px] text-[8px] font-semibold ${
                isActive ? 'bg-white/15 text-white' : 'text-white/70'
              }`}
            >
              <span className={`h-[6px] w-[6px] rounded-[2px] ${isActive ? 'bg-[#8EDCB3]' : 'bg-white/40'}`} />
              {item}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function TopBar({ tenant }: { tenant: string }) {
  return (
    <div className="flex h-[34px] shrink-0 items-center gap-3 border-b border-[#E6E9EE] bg-white px-4">
      <div className="flex h-[20px] w-[150px] items-center gap-1 rounded-full bg-[#F3F5F7] px-2 text-[7px] text-[#8A949A]">
        <FiSearch className="h-[8px] w-[8px]" />
        Search families, members…
      </div>
      <span className="ml-auto text-[8px] font-bold text-[#192024]">{tenant}</span>
      <FiBell className="h-[9px] w-[9px] text-[#5D696F]" />
      <span className="flex items-center gap-1 rounded-full bg-[#F3F5F7] px-2 py-[2px] text-[7px] font-semibold text-[#192024]">
        <span className="h-[10px] w-[10px] rounded-full bg-[#298959]" />
        Admin
        <FiChevronDown className="h-[8px] w-[8px] text-[#8A949A]" />
      </span>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  icon: IconType;
  bg: string;
  fg: string;
}

function StatCard({ label, value, hint, icon: Icon, bg, fg }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-[#E6E9EE] bg-white p-3">
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px]" style={{ background: bg, color: fg }}>
        <Icon className="h-[12px] w-[12px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[7px] font-semibold text-[#5D696F]">{label}</p>
        <p className="text-[14px] font-extrabold leading-tight text-[#192024]">{value}</p>
        <p className="truncate text-[6.5px] text-[#8A949A]">{hint}</p>
      </div>
    </div>
  );
}

const INDEX_AXES = [
  { name: 'Education', value: 82 },
  { name: 'Family Welfare', value: 76 },
  { name: 'Elderly Care', value: 64 },
  { name: 'Health Support', value: 70 },
  { name: 'Community Programs', value: 70 },
  { name: 'Finance Management', value: 68 },
  { name: 'Zakat', value: 74 },
  { name: 'Worship', value: 80 },
];

/** The Mahallu Development Index as a radar chart, drawn by hand so it is static. */
function RadarChart({ className = '' }: { className?: string }) {
  const cx = 190;
  const cy = 76;
  const radius = 54;
  const count = INDEX_AXES.length;
  const point = (index: number, r: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), angle };
  };
  const ring = (fraction: number) =>
    INDEX_AXES.map((_, i) => {
      const p = point(i, radius * fraction);
      return `${p.x},${p.y}`;
    }).join(' ');
  const data = INDEX_AXES.map((axis, i) => point(i, (radius * axis.value) / 100));

  return (
    <svg viewBox="0 0 380 160" className={className} aria-hidden="true" focusable="false">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="#E1E7E3" strokeWidth="1" />
      ))}
      {INDEX_AXES.map((_, i) => {
        const p = point(i, radius);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E1E7E3" strokeWidth="1" />;
      })}
      <polygon
        points={data.map((p) => `${p.x},${p.y}`).join(' ')}
        className="lp-draw"
        fill="rgba(41,137,89,0.22)"
        stroke="#298959"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {data.map((p, i) => (
        <circle key={i} className="lp-pop" style={{ animationDelay: `${1100 + i * 110}ms` }} cx={p.x} cy={p.y} r="2" fill="#15603B" />
      ))}
      {INDEX_AXES.map((axis, i) => {
        const p = point(i, radius + 12);
        const cos = Math.cos(p.angle);
        const sin = Math.sin(p.angle);
        const anchor = cos > 0.1 ? 'start' : cos < -0.1 ? 'end' : 'middle';
        const dy = sin > 0.1 ? 8 : sin < -0.1 ? -4 : 3;
        return (
          <text key={axis.name} x={p.x} y={p.y + dy} textAnchor={anchor} fontSize="7" fill="#5D696F">
            <tspan>{axis.name}</tspan>
            <tspan x={p.x} dy="8" fontWeight="700" fill="#192024">
              {axis.value}%
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

export function DashboardScreen() {
  return (
    <div className="flex h-full w-full bg-[#F5F7F6] leading-[1.3] text-[#192024]">
      <Sidebar active="Dashboard" />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar tenant="Beypore Juma Masjid Mahallu" />
        <div className="flex-1 overflow-hidden p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] font-extrabold">Dashboard</p>
              <p className="text-[7px] text-[#5D696F]">Community and finance snapshot</p>
            </div>
            <span className="rounded-full border border-[#E6E9EE] bg-white px-2 py-[2px] text-[7px] font-semibold text-[#5D696F]">
              This Year 2024 – 2025
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <StatCard label="Families" value="1,248" hint="Total registered" icon={FiUsers} bg="#E6F4EC" fg="#1F8A55" />
            <StatCard label="Pending Payments" value="18" hint="Requires action" icon={FiClock} bg="#FFF3DC" fg="#D9900A" />
            <StatCard label="Varisangya collected" value="₹4.5L" hint="This year so far" icon={FiTrendingUp} bg="#E6F4EC" fg="#1F8A55" />
          </div>
          <div className="mt-3 rounded-[10px] border border-[#E6E9EE] bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-bold">Mahallu Development Index</p>
              <span className="rounded-full bg-[#E6F4EC] px-2 py-[2px] text-[7px] font-bold text-[#15603B]">Score 74 / 100</span>
            </div>
            <RadarChart className="mx-auto mt-1 h-[150px] w-full max-w-[380px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface FamilyRow {
  name: string;
  members: number;
  varisangya: 'Paid' | 'Pending' | 'Overdue';
}

const FAMILY_ROWS: FamilyRow[] = [
  { name: 'Abdul Rahman K', members: 6, varisangya: 'Paid' },
  { name: 'Muhammed Salih', members: 4, varisangya: 'Pending' },
  { name: 'Yusuf Ali', members: 5, varisangya: 'Paid' },
  { name: 'Hameed M T', members: 3, varisangya: 'Overdue' },
];

const PILL_STYLE: Record<FamilyRow['varisangya'], { bg: string; fg: string }> = {
  Paid: { bg: '#E6F4EC', fg: '#1F8A55' },
  Pending: { bg: '#FFF3DC', fg: '#B8730A' },
  Overdue: { bg: '#FDE8E8', fg: '#C62F2F' },
};

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span className="rounded-full px-2 py-[2px] text-[6.5px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: IconType }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-[#E6E9EE] bg-white px-3 py-2">
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] bg-[#E6F4EC] text-[#1F8A55]">
        <Icon className="h-[10px] w-[10px]" />
      </span>
      <div>
        <p className="text-[6.5px] font-semibold text-[#5D696F]">{label}</p>
        <p className="text-[12px] font-extrabold leading-tight">{value}</p>
      </div>
    </div>
  );
}

export function FamiliesScreen() {
  return (
    <div className="flex h-full w-full bg-[#F5F7F6] leading-[1.3] text-[#192024]">
      <Sidebar active="Families" />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar tenant="Beypore Juma Masjid Mahallu" />
        <div className="flex-1 overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-extrabold">Families</p>
              <p className="text-[7px] text-[#5D696F]">Complete family register and member details</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-[20px] w-[110px] items-center gap-1 rounded-[6px] border border-[#E6E9EE] bg-white px-2 text-[7px] text-[#8A949A]">
                <FiSearch className="h-[8px] w-[8px]" />
                Search
              </span>
              <span className="flex h-[20px] items-center gap-1 rounded-[6px] bg-[#15603B] px-2 text-[7px] font-bold text-white">
                <FiPlus className="h-[8px] w-[8px]" />
                Add Family
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <MiniStat label="Total Families" value="1,248" icon={FiHome} />
            <MiniStat label="Total Members" value="5,320" icon={FiUsers} />
            <MiniStat label="Pending" value="86" icon={FiClock} />
            <MiniStat label="Payment Updates" value="12" icon={FiCreditCard} />
          </div>
          <div className="mt-3 overflow-hidden rounded-[10px] border border-[#E6E9EE] bg-white">
            <table className="w-full border-collapse text-left text-[7.5px]">
              <thead className="bg-[#F3F5F7] text-[#5D696F]">
                <tr>
                  <th className="px-3 py-[6px] font-semibold">Family Head</th>
                  <th className="px-3 py-[6px] font-semibold">Members</th>
                  <th className="px-3 py-[6px] font-semibold">Varisangya</th>
                  <th className="px-3 py-[6px] font-semibold">Status</th>
                  <th className="px-3 py-[6px]" />
                </tr>
              </thead>
              <tbody>
                {FAMILY_ROWS.map((row) => (
                  <tr key={row.name} className="border-t border-[#EEF1F4]">
                    <td className="px-3 py-[6px]">
                      <span className="flex items-center gap-2 font-semibold">
                        <span className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-[#E6F4EC] text-[6px] font-bold text-[#15603B]">
                          {row.name.charAt(0)}
                        </span>
                        {row.name}
                      </span>
                    </td>
                    <td className="px-3 py-[6px]">{row.members}</td>
                    <td className="px-3 py-[6px]">
                      <Pill label={row.varisangya} {...PILL_STYLE[row.varisangya]} />
                    </td>
                    <td className="px-3 py-[6px]">
                      <Pill label="Active" bg="#E6F4EC" fg="#1F8A55" />
                    </td>
                    <td className="px-3 py-[6px] text-right text-[#8A949A]">
                      <FiMoreVertical className="inline h-[9px] w-[9px]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-[#EEF1F4] px-3 py-[5px] text-[6.5px] text-[#8A949A]">Showing 4 of 1,248 families</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ member portal */

const PORTAL_ITEMS = [
  { icon: FiUsers, title: 'My Family', sub: 'View and manage family details' },
  { icon: FiCreditCard, title: 'Make a Payment', sub: 'Pay Varisangya and other dues' },
  { icon: FiFileText, title: 'My Certificates', sub: 'Download your certificates' },
  { icon: FiInbox, title: 'Requests', sub: 'Track your requests' },
];

const PORTAL_TABS = [
  { icon: FiHome, label: 'Home' },
  { icon: FiGrid, label: 'Services' },
  { icon: FiCreditCard, label: 'Payments' },
  { icon: FiUser, label: 'Profile' },
];

export function MemberPortalScreen() {
  return (
    <div className="flex h-full flex-col bg-[#F3F6F4] leading-[1.3] text-[#192024]">
      <div className="rounded-b-[18px] bg-[linear-gradient(160deg,#2B8C5B_0%,#15603B_100%)] px-4 pb-4 pt-7 text-white">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-white">
            <img src={ICON_PATH} alt="" className="h-5 w-5" />
          </span>
          <span className="text-[12px] font-extrabold">ZAAD</span>
        </div>
        <p className="mt-4 text-[12px] font-extrabold">Assalamu Alaikum</p>
        <p className="text-[7.5px] text-white/80">Welcome to your Mahallu portal!</p>
      </div>
      <ul className="mt-3 flex-1 space-y-2 px-3">
        {PORTAL_ITEMS.map(({ icon: Icon, title, sub }) => (
          <li key={title} className="flex items-center gap-2 rounded-[10px] border border-[#E6E9EE] bg-white p-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#E6F4EC] text-[#15603B]">
              <Icon className="h-3 w-3" />
            </span>
            <div className="min-w-0">
              <p className="text-[8px] font-bold">{title}</p>
              <p className="truncate text-[6.5px] text-[#5D696F]">{sub}</p>
            </div>
            <FiChevronRight className="ml-auto h-3 w-3 shrink-0 text-[#8A949A]" />
          </li>
        ))}
      </ul>
      <nav className="flex items-center justify-around border-t border-[#E6E9EE] bg-white px-2 pb-3 pt-2">
        {PORTAL_TABS.map(({ icon: Icon, label }, i) => (
          <span key={label} className={`flex flex-col items-center gap-[2px] text-[6px] font-semibold ${i === 0 ? 'text-[#15603B]' : 'text-[#8A949A]'}`}>
            <Icon className="h-3 w-3" />
            {label}
          </span>
        ))}
      </nav>
    </div>
  );
}
