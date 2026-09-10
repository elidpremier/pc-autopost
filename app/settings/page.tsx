import Nav from '@/components/Nav';
import SettingsForm from '@/components/SettingsForm';
import { getSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <main className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Paramètres de la boutique</h1>
        <p className="mt-1 text-sm text-slate-500">
          Identité affichée sur tous les visuels générés (nom, logo, téléphone, ville, devise, couleurs).
        </p>
        <div className="mt-6">
          <SettingsForm initial={getSettings()} />
        </div>
      </div>
    </main>
  );
}
