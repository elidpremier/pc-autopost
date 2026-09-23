import Nav from '@/components/Nav';
import StockDashboard from '@/components/StockDashboard';
import { listComputers, listImages, listPublications, getSettings } from '@/lib/db';
import { checkGenerationReadiness } from '@/lib/services/generation-service';
import type { PcStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { searchParams: { status?: string; q?: string } };

export default function Dashboard({ searchParams }: Ctx) {
  const status = (['available', 'reserved', 'sold', 'archived'].includes(searchParams.status ?? '')
    ? searchParams.status
    : undefined) as PcStatus | undefined;
  const q = searchParams.q || undefined;
  const items = listComputers();
  const settings = getSettings();

  const now = Date.now();
  const rows = items.map((c) => {
    const images = listImages(c.id);
    const publications = listPublications(c.id);
    const thumb = images.find((i) => i.kind === 'cleaned') || images.find((i) => i.kind === 'main') || images.find((i) => i.kind === 'secondary');
    const daysAvailable = Math.floor((now - new Date(c.created_at).getTime()) / 86400000);
    const missingFields = checkGenerationReadiness(c);

    return {
      computer: c,
      thumb: thumb ? `/api/images/${thumb.id}` : null,
      daysAvailable,
      imageCount: images.length,
      missingFields,
      publications,
    };
  });

  return (
    <main className="min-h-screen">
      <Nav />
      <StockDashboard
        rows={rows}
        settings={{ shop_name: settings.shop_name, currency: settings.currency }}
        currentStatus={status}
        currentQuery={q}
      />
    </main>
  );
}
