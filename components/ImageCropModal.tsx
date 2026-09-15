'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export type CropBox = {
  x: number; // pourcentage 0..100
  y: number; // pourcentage 0..100
  width: number; // pourcentage 0..100
  height: number; // pourcentage 0..100
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName?: string;
  initialCrop?: CropBox | null;
  onSaveCrop: (crop: CropBox | null) => void;
};

export default function ImageCropModal({
  isOpen,
  onClose,
  imageUrl,
  imageName,
  initialCrop,
  onSaveCrop,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Valeurs par défaut : 5% x, 5% y, 90% w, 55% h si non fourni
  const [crop, setCrop] = useState<CropBox>(
    initialCrop || { x: 5, y: 5, width: 90, height: 55 }
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const [startPos, setStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [startCrop, setStartCrop] = useState<CropBox>(crop);

  useEffect(() => {
    if (initialCrop) {
      setCrop(initialCrop);
    } else {
      setCrop({ x: 5, y: 5, width: 90, height: 55 });
    }
  }, [initialCrop, isOpen]);

  const handleMouseDown = (
    e: React.MouseEvent,
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    setDragMode(mode);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartCrop({ ...crop });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const deltaXPercent = ((e.clientX - startPos.x) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - startPos.y) / rect.height) * 100;

      let newX = startCrop.x;
      let newY = startCrop.y;
      let newW = startCrop.width;
      let newH = startCrop.height;

      const minW = 10;
      const minH = 10;

      if (dragMode === 'move') {
        newX = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + deltaXPercent));
        newY = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + deltaYPercent));
      } else if (dragMode === 'nw') {
        const potentialW = startCrop.width - deltaXPercent;
        const potentialH = startCrop.height - deltaYPercent;
        if (potentialW >= minW && startCrop.x + deltaXPercent >= 0) {
          newX = startCrop.x + deltaXPercent;
          newW = potentialW;
        }
        if (potentialH >= minH && startCrop.y + deltaYPercent >= 0) {
          newY = startCrop.y + deltaYPercent;
          newH = potentialH;
        }
      } else if (dragMode === 'ne') {
        const potentialW = startCrop.width + deltaXPercent;
        const potentialH = startCrop.height - deltaYPercent;
        if (potentialW >= minW && startCrop.x + potentialW <= 100) {
          newW = potentialW;
        }
        if (potentialH >= minH && startCrop.y + deltaYPercent >= 0) {
          newY = startCrop.y + deltaYPercent;
          newH = potentialH;
        }
      } else if (dragMode === 'sw') {
        const potentialW = startCrop.width - deltaXPercent;
        const potentialH = startCrop.height + deltaYPercent;
        if (potentialW >= minW && startCrop.x + deltaXPercent >= 0) {
          newX = startCrop.x + deltaXPercent;
          newW = potentialW;
        }
        if (potentialH >= minH && startCrop.y + potentialH <= 100) {
          newH = potentialH;
        }
      } else if (dragMode === 'se') {
        const potentialW = startCrop.width + deltaXPercent;
        const potentialH = startCrop.height + deltaYPercent;
        if (potentialW >= minW && startCrop.x + potentialW <= 100) {
          newW = potentialW;
        }
        if (potentialH >= minH && startCrop.y + potentialH <= 100) {
          newH = potentialH;
        }
      }

      setCrop({
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
        width: Math.round(newW * 10) / 10,
        height: Math.round(newH * 10) / 10,
      });
    },
    [isDragging, startPos, startCrop, dragMode]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragMode(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!isOpen) return null;

  function handleSave() {
    onSaveCrop(crop);
    onClose();
  }

  function handleReset() {
    onSaveCrop(null); // image entière
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md animate-fade-in">
      <div className="flex h-full max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-400/20 text-xl text-lime-600 dark:text-lime-400">
              ✂️
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Recadrer la Zone d&apos;Analyse OCR
              </h3>
              <p className="text-xs text-slate-500">
                Encadrez précisément le sticker de caractéristiques ou l&apos;écran pour garantir 100% de succès IA.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Canvas & Zone de sélection */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-950 p-6 select-none">
          <div
            ref={containerRef}
            className="relative max-h-[65vh] max-w-full overflow-hidden rounded-2xl shadow-2xl border border-slate-800"
          >
            {/* Image de fond */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt={imageName || 'Image à recadrer'}
              className="max-h-[63vh] max-w-full object-contain pointer-events-none"
            />

            {/* Overlay sombre tout autour */}
            <div className="absolute inset-0 bg-black/60 pointer-events-none" />

            {/* Rectangle de sélection découpé (Zone éclairée) */}
            <div
              style={{
                left: `${crop.x}%`,
                top: `${crop.y}%`,
                width: `${crop.width}%`,
                height: `${crop.height}%`,
              }}
              onMouseDown={(e) => handleMouseDown(e, 'move')}
              className="absolute border-2 border-lime-400 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] cursor-move flex flex-col justify-between"
            >
              {/* Entête rectangle info */}
              <div className="bg-lime-400/90 px-2 py-0.5 text-[10px] font-black text-black w-fit rounded-br shadow pointer-events-none">
                ✂️ Zone d&apos;analyse OCR ({crop.width.toFixed(0)}% × {crop.height.toFixed(0)}%)
              </div>

              {/* Lignes de grille de cadrage */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                <div className="border-r border-b border-lime-400/50" />
                <div className="border-r border-b border-lime-400/50" />
                <div className="border-b border-lime-400/50" />
                <div className="border-r border-b border-lime-400/50" />
                <div className="border-r border-b border-lime-400/50" />
                <div className="border-b border-lime-400/50" />
                <div className="border-r border-lime-400/50" />
                <div className="border-r border-lime-400/50" />
                <div />
              </div>

              {/* Handles aux 4 coins */}
              <div
                onMouseDown={(e) => handleMouseDown(e, 'nw')}
                className="absolute -top-2 -left-2 h-4 w-4 rounded-full bg-white border-2 border-lime-500 shadow cursor-nwse-resize hover:scale-125 transition"
              />
              <div
                onMouseDown={(e) => handleMouseDown(e, 'ne')}
                className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-white border-2 border-lime-500 shadow cursor-nesw-resize hover:scale-125 transition"
              />
              <div
                onMouseDown={(e) => handleMouseDown(e, 'sw')}
                className="absolute -bottom-2 -left-2 h-4 w-4 rounded-full bg-white border-2 border-lime-500 shadow cursor-nesw-resize hover:scale-125 transition"
              />
              <div
                onMouseDown={(e) => handleMouseDown(e, 'se')}
                className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full bg-white border-2 border-lime-500 shadow cursor-nwse-resize hover:scale-125 transition"
              />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            🔄 Image Entière (Sans recadrage)
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost text-xs"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn-primary bg-gradient-to-r from-lime-500 to-emerald-500 text-black font-extrabold text-xs px-6 py-2.5 shadow-lg shadow-lime-500/20"
            >
              ✓ Valider le Recadrage ✂️
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
