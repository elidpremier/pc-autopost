import { NextResponse } from 'next/server';
import { listComputers, createComputer } from '@/lib/db';
import type { ComputerFields, PcStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status') as PcStatus | null;
  const q = url.searchParams.get('q') ?? undefined;
  const items = listComputers(status && ['available', 'reserved', 'sold', 'archived'].includes(status) ? { status, q } : { q });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  let body: Partial<ComputerFields>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }
  const computer = createComputer({
    brand: body.brand, model: body.model, processor: body.processor,
    ram_gb: body.ram_gb, storage_capacity_gb: body.storage_capacity_gb, storage_type: body.storage_type,
    screen_size: body.screen_size, screen_resolution: body.screen_resolution,
    graphics: body.graphics, keyboard: body.keyboard, ports: body.ports, accessories: body.accessories,
    warranty: body.warranty, condition: body.condition, battery_condition: body.battery_condition,
    price_amount: body.price_amount, currency: body.currency, status: body.status, notes: body.notes,
  });
  return NextResponse.json({ computer }, { status: 201 });
}
