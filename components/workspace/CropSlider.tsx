'use client';

import { useRef, useState } from 'react';

type Props = {
  src: string;
  ratio: number; // 0..1 — position de la ligne de séparation
  onRatioChange: (r: number) => void;
  naturalHeight?: number;
};

/**
 * Aperçu de la photo-fiche avec ligne de séparation déplaçable.
 * Loupe de précision 3.0x centrée EXCLUSIVEMENT sur la bordure exacte du recadrage (ratio * 100%).
 */
export default function CropSlider({ src, ratio, onRatioChange, naturalHeight }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [pointerXPercent, setPointerXPercent] = useState<number>(50);
  const [loaded, setLoaded] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState<number | undefined>(undefined);
  const effectiveHeight = naturalHeight ?? measuredHeight;

  function updatePointer(clientX: number, clientY: number) {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top) / rect.height;
    const clampedY = Math.min(0.95, Math.max(0.03, ry));
    setPointerXPercent(Math.min(100, Math.max(0, rx * 100)));
    return Math.round(clampedY * 1000) / 1000;
  }

  const px = effectiveHeight ? Math.round(ratio * effectiveHeight) : null;
  const showLoupe = dragging || hovering;
  const cropYPercent = ratio * 100;

  return (
    <div className="relative select-none">
      <div
        ref={boxRef}
        className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg bg-slate-900 border border-slate-700 shadow-lg"
        style={{ touchAction: 'none' }}
        onPointerEnter={(e) => {
          setHovering(true);
          updatePointer(e.clientX, e.clientY);
        }}
        onPointerLeave={() => {
          if (!dragging) {
            setHovering(false);
          }
        }}
        onPointerMove={(e) => {
          const newRatio = updatePointer(e.clientX, e.clientY);
          if (dragging && newRatio !== undefined) {
            onRatioChange(newRatio);
          }
        }}
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
          className="block max-h-[480px] w-auto max-w-full cursor-row-resize"
        />
        {!loaded && <div className="absolute inset-0 flex items-center justify-center text-sm text-white">Chargement…</div>}

        {/* Zone de la fiche (retirée en rouge translucide) */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-center bg-red-500/25 transition-all"
          style={{ height: `${cropYPercent}%` }}
        >
          <span className="mt-1.5 rounded-full bg-red-600/90 backdrop-blur px-2.5 py-0.5 text-[11px] font-bold text-white shadow">
            Zone de la fiche — retirée ({px !== null ? `${px} px` : Math.round(cropYPercent) + ' %'})
          </span>
        </div>

        {/* Ligne de séparation + poignée */}
        <div
          className="absolute inset-x-0 z-10"
          style={{ top: `calc(${cropYPercent}% - 12px)` }}
          onPointerDown={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setDragging(true);
            setHovering(true);
            const r = updatePointer(e.clientX, e.clientY);
            if (r !== undefined) onRatioChange(r);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            const r = updatePointer(e.clientX, e.clientY);
            if (r !== undefined) onRatioChange(r);
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          <div className="relative h-6 cursor-grab active:cursor-grabbing" role="slider" aria-label="Ligne de séparation" aria-valuenow={Math.round(cropYPercent)} aria-valuemin={3} aria-valuemax={95}>
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-amber-400 shadow-md ring-1 ring-amber-500/50" />
            <div className="absolute left-1/2 top-1/2 flex h-6 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-[10px] font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95">
              ↔ {px !== null ? `${px} px` : `${Math.round(cropYPercent)}%`}
            </div>
          </div>
        </div>

        {/* Loupe de Zoom Précision (3.2x) — centrée EXCLUSIVEMENT sur la BORDURE DE RECADRAGE */}
        {showLoupe && (
          <div
            className="pointer-events-none absolute z-30 h-36 w-36 -translate-x-1/2 rounded-full border-4 border-amber-400 bg-slate-950 shadow-2xl overflow-hidden ring-4 ring-black/50 transition-all"
            style={{
              left: `${pointerXPercent}%`,
              top: cropYPercent > 50 ? `calc(${cropYPercent}% - 92px)` : `calc(${cropYPercent}% + 20px)`,
            }}
          >
            {/* Image zoomée 3.2x avec repère exact de coupe */}
            <div className="relative h-full w-full overflow-hidden">
              <div
                className="absolute max-w-none origin-top-left"
                style={{
                  width: `${boxRef.current?.clientWidth ?? 300}px`,
                  height: `${boxRef.current?.clientHeight ?? 400}px`,
                  transform: `translate(${
                    72 - (pointerXPercent / 100) * (boxRef.current?.clientWidth ?? 300) * 3.2
                  }px, ${
                    72 - (cropYPercent / 100) * (boxRef.current?.clientHeight ?? 400) * 3.2
                  }px) scale(3.2)`,
                  transformOrigin: '0 0',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} className="h-full w-full object-fill block" alt="" />
                {/* Masque rouge identique dans la loupe */}
                <div
                  className="absolute inset-x-0 top-0 bg-red-500/30"
                  style={{ height: `${cropYPercent}%` }}
                />
              </div>

              {/* Ligne d'or centrale indiquant la séparation au pixel près */}
              <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-amber-400 shadow-sm shadow-amber-900 ring-1 ring-black/80 z-10" />
              <div className="absolute left-1/2 inset-y-0 w-0.5 -translate-x-1/2 bg-amber-400/40 z-10" />

              {/* Tag de précision */}
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-slate-900/90 backdrop-blur px-2 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-400/40 shadow z-20">
                🎯 Ligne de découpe ({px !== null ? `${px} px` : `${Math.round(cropYPercent)}%`})
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
        <span>🎯</span>
        <span>La <strong>Loupe Précision 3.2x</strong> est verrouillée sur la <strong>ligne exacte de découpe</strong> ({px !== null ? `${px} px` : ''}) pour un calage au pixel près.</span>
      </p>
    </div>
  );
}
