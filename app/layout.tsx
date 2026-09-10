import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PC AutoPost',
  description:
    'De la photo-fiche à l’annonce prête à publier : visuels cohérents, textes adaptés et stock maîtrisé.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
