'use client';

import { useRef, useState } from 'react';

type Props = {
  src: string;
  ratio: number; // 0..1 — position de la ligne de séparation
  onRatioChange: (r: number) => void;
  naturalHeight?: number;
};

/**
 * Aperçu de la photo-fiche avec ligne de séparation déplaçable (spec §22.2 :
 * gabarit ajustable — priorité MVP). La zone au-dessus de la ligne sera retirée.
 */
export default function CropSlider({ src, ratio, onRatioChange, naturalHeight }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState<number | undefined>(undefined);
  const effectiveHeight = naturalHeight ?? measuredHeight;

  function ratioFromClientY(clientY: number): number {
    const el = boxRef.current;
    if (!el) return ratio;
    const rect = el.getBoundingClientRect();
    const r = (clientY - rect.top) / rect.height;
    return Math.min(0.95, Math.max(0.03, Math.round(r * 1000) / 1000));
  }

  const px = effectiveHeight ? Math.round(ratio * effectiveHeight) : null;

  return (
    <div>
      <div
        ref={boxRef}
        className="relative mx-auto w-fit max-w-full select-none overflow-hidden rounded-lg bg-slate-900"
        style={{ touchAction: 'none' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Photo-fiche"
          draggable={false}
          onLoad={(e) => {
            setLoaded(true);
            const h = (e.target as HTMLImageElement).naturalHeight;
            if (h) setMeasuredHeight(h);
          }}
          className="block max-h-[480px] w-auto max-w-full"
        />
        {!loaded && <div className="absolute inset-0 flex items-center justify-center text-sm text-white">Chargement…</div>}

        {/* Zone de la fiche (retirée) */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-center bg-red-500/20"
          style={{ height: `${ratio * 100}%` }}
        >
          <span className="mt-1.5 rounded bg-red-600/90 px-2 py-0.5 text-[11px] font-semibold text-white">
            Zone de la fiche — retirée ({px !== null ? `${px} px` : Math.round(ratio * 100) + ' %'})
          </span>
        </div>

        {/* Ligne de séparation + poignée */}
        <div
          className="absolute inset-x-0 z-10"
          style={{ top: `calc(${ratio * 100}% - 12px)` }}
          onPointerDown={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setDragging(true);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            onRatioChange(ratioFromClientY(e.clientY));
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          <div className="relative h-6 cursor-grab active:cursor-grabbing" role="slider" aria-label="Ligne de séparation" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={3} aria-valuemax={95}>
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-amber-400 shadow" />
            <div className="absolute left-1/2 top-1/2 flex h-6 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-[10px] font-bold text-white shadow-md">
              ⋮⋮
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">
        Glissez la ligne sous la bordure de la fiche. La photo du PC (sous la ligne) sera conservée.
      </p>
    </div>
  );
}
