import Link from 'next/link';
import Nav from '@/components/Nav';
import StatusBadge from '@/components/StatusBadge';
import { listComputers, listImages, getSettings } from '@/lib/db';
import { CONDITION_LABELS, type PcStatus } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Ctx = { searchParams: { status?: string; q?: string } };

const FILTERS: { id: string; label: string }[] = [
  { id: '', label: 'Tous' },
  { id: 'available', label: 'Disponibles' },
  { id: 'reserved', label: 'Réservés' },
  { id: 'sold', label: 'Vendus' },
  { id: 'archived', label: 'Archivés' },
];

export default function Dashboard({ searchParams }: Ctx) {
  const status = (['available', 'reserved', 'sold', 'archived'].includes(searchParams.status ?? '')
    ? searchParams.status
    : undefined) as PcStatus | undefined;
  const q = searchParams.q || undefined;
  const items = listComputers(status ? { status, q } : { q });
  const settings = getSettings();

  const stats = {
    available: items.filter((c) => c.status === 'available').length,
    reserved: items.filter((c) => c.status === 'reserved').length,
    sold: items.filter((c) => c.status === 'sold').length,
    archived: items.filter((c) => c.status === 'archived').length,
  };

  const now = Date.now();
  const rows = items.map((c) => {
    const images = listImages(c.id);
    const thumb = images.find((i) => i.kind === 'cleaned') || images.find((i) => i.kind === 'main') || images.find((i) => i.kind === 'secondary');
    const daysAvailable = Math.floor((now - new Date(c.created_at).getTime()) / 86400000);
    return { computer: c, thumb: thumb ? `/api/images/${thumb.id}` : null, daysAvailable, imageCount: images.length };
  });

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Mon stock</h1>
            <p className="mt-1 text-sm text-slate-500">
              {settings.shop_name} — {items.length} produit{items.length > 1 ? 's' : ''}
            </p>
          </div>
          <Link href="/computers/new" className="btn-primary">+ Ajouter un ordinateur</Link>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ['available', stats.available, 'text-emerald-600'],
              ['reserved', stats.reserved, 'text-amber-600'],
              ['sold', stats.sold, 'text-slate-600'],
              ['archived', stats.archived, 'text-slate-400'],
            ] as const
          ).map(([key, n, color]) => (
            <div key={key} className="card px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{FILTERS.find((f) => f.id === key)?.label}</div>
              <div className={`mt-1 text-2xl font-bold ${color}`}>{n}</div>
            </div>
          ))}
        </div>

        <form method="GET" className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
            {FILTERS.map((f) => (
              <Link
                key={f.id}
                href={f.id ? `/?status=${f.id}` : '/'}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  (status ?? '') === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Rechercher (marque, modèle)…"
            className="input ml-auto w-64"
          />
          <button type="submit" className="btn-ghost">Rechercher</button>
        </form>

        {rows.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="text-4xl">📦</div>
            <h2 className="text-lg font-semibold">Aucun ordinateur pour le moment</h2>
            <p className="max-w-md text-sm text-slate-500">
              Ajoutez votre premier produit : photos, caractéristiques, prix. PC AutoPost générera ensuite les visuels
              et les textes prêts à publier.
            </p>
            <Link href="/computers/new" className="btn-primary mt-2">Créer ma première fiche</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(({ computer: c, thumb, daysAvailable, imageCount }) => (
              <Link key={c.id} href={`/computers/${c.id}`} className="card group overflow-hidden transition hover:shadow-md">
                <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={`${c.brand} ${c.model}`} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl text-slate-300">🖼️</div>
                  )}
                  <div className="absolute left-2 top-2"><StatusBadge status={c.status} /></div>
                  {c.status === 'available' && daysAvailable >= 7 && (
                    <div className="absolute bottom-2 left-2 rounded-full bg-blue-700/95 px-2.5 py-1 text-[11px] font-semibold text-white">
                      Disponible depuis {daysAvailable} j — à républier
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-tight">
                      {c.brand || 'Marque ?'} {c.model || '—'}
                    </h3>
                    <span className="whitespace-nowrap text-sm font-bold text-blue-700">
                      {formatPrice(c.price_amount, c.currency)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">{CONDITION_LABELS[c.condition]}</span>
                    {c.ram_gb ? <span className="rounded bg-slate-100 px-1.5 py-0.5">{c.ram_gb} Go</span> : null}
                    {c.storage_capacity_gb ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5">
                        {c.storage_capacity_gb} {c.storage_type ?? 'Go'}
                      </span>
                    ) : null}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">📷 {imageCount}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
