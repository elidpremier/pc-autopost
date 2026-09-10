'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';

/**
 * Page de passage : crée immédiatement la fiche (sans saisie) et redirige
 * vers l'espace produit où tout se passe (import texte/JSON, photos, OCR…).
 */
export default function NewComputerPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (started) return;
    setStarted(true);
    (async () => {
      try {
        const res = await fetch('/api/computers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currency: 'FCFA' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Erreur de création');
        router.push(`/computers/${data.computer.id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de création');
      }
    })();
  }, [started, router]);

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        {error ? (
          <div className="card p-8">
            <p className="font-semibold text-red-600">Impossible de créer la fiche : {error}</p>
            <Link href="/" className="btn-ghost mt-4">← Retour au stock</Link>
          </div>
        ) : (
          <>
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <h1 className="text-lg font-semibold">Création de la fiche…</h1>
            <p className="mt-1 text-sm text-slate-500">
              Redirection vers l’espace produit : import de la fiche (texte/JSON), photos, génération…
            </p>
          </>
        )}
      </div>
    </main>
  );
}
