import { STATUS_LABELS, type PcStatus } from '@/lib/types';

const STYLES: Record<PcStatus, string> = {
  available: 'bg-emerald-100 text-emerald-700',
  reserved: 'bg-amber-100 text-amber-700',
  sold: 'bg-slate-200 text-slate-600',
  archived: 'bg-slate-100 text-slate-500',
};

export default function StatusBadge({ status }: { status: PcStatus }) {
  return <span className={`chip ${STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}
