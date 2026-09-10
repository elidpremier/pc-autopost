'use client';

type Props = {
  image: { url: string; formatLabel: string } | null;
  text: string;
  shopName: string;
  logoUrl: string | null;
};

/**
 * Aperçu simulé d'une publication Facebook : le texte (caption) au-dessus,
 * le visuel en dessous, comme sur la plateforme — pour juger du rendu réel
 * avant de publier.
 */
export default function FacebookPreview({ image, text, shopName, logoUrl }: Props) {
  const initial = (shopName || 'B').trim().charAt(0).toUpperCase() || 'B';
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 pt-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo boutique" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-lg font-bold text-white">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{shopName || 'Ma Boutique'}</div>
            <div className="text-xs text-slate-500">
              À l’instant · <span aria-hidden>🌐</span>
            </div>
          </div>
          <div className="text-lg leading-none text-slate-400">⋯</div>
        </div>

        {text ? (
          <div className="whitespace-pre-wrap px-4 py-3 text-[15px] leading-snug text-slate-800">{text}</div>
        ) : (
          <div className="px-4 py-3 text-sm text-slate-400">Aucun texte généré pour cette image.</div>
        )}

        {image ? (
          <div className="flex max-h-[560px] items-center justify-center overflow-hidden bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={`Visuel ${image.formatLabel}`} className="max-h-[560px] w-auto object-contain" />
          </div>
        ) : null}

        <div className="flex border-t border-slate-100 px-2 py-1 text-sm font-medium text-slate-500">
          <span className="flex-1 cursor-default rounded-lg px-3 py-1.5 text-center hover:bg-slate-50">👍 J’aime</span>
          <span className="flex-1 cursor-default rounded-lg px-3 py-1.5 text-center hover:bg-slate-50">💬 Commenter</span>
          <span className="flex-1 cursor-default rounded-lg px-3 py-1.5 text-center hover:bg-slate-50">↪️ Partager</span>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400">
        Aperçu simulé d’une publication Facebook — le texte et le visuel sont exactement ce qui sera copié/publié.
      </p>
    </div>
  );
}
