import Link from 'next/link';

export default function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-white">💻</span>
          <span>
            PC AutoPost
            <span className="ml-2 hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:inline">
              MVP
            </span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            Stock
          </Link>
          <Link href="/settings" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            Boutique
          </Link>
          <Link href="/computers/new" className="btn-primary ml-2 !py-2">
            + Ajouter un ordinateur
          </Link>
        </nav>
      </div>
    </header>
  );
}
