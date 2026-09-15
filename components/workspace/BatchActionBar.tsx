'use client';

type Props = {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  onReanalyzeSelected?: () => void;
  onCropSelected?: () => void;
};

export default function BatchActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDeleteSelected,
  onReanalyzeSelected,
  onCropSelected,
}: Props) {
  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 animate-bounce-in">
      <div className="flex items-center gap-3 rounded-full border border-slate-700/60 bg-slate-950/85 px-5 py-3 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 text-white">
        
        {/* Statut Sélection */}
        <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-400 text-xs font-black text-black">
            {selectedCount}
          </span>
          <span className="text-xs font-extrabold text-slate-200">
            sélectionné{selectedCount > 1 ? 's' : ''}
          </span>
        </div>

        {/* Tout sélectionner / Désélectionner */}
        <button
          type="button"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition"
        >
          {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>

        {/* Actions groupées */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          
          {onCropSelected && selectedCount === 1 && (
            <button
              type="button"
              onClick={onCropSelected}
              className="flex items-center gap-1.5 rounded-full bg-slate-800 hover:bg-slate-700 px-3.5 py-1.5 text-xs font-bold text-lime-400 transition border border-lime-400/30"
            >
              ✂️ Recadrer Zone OCR
            </button>
          )}

          {onReanalyzeSelected && (
            <button
              type="button"
              onClick={onReanalyzeSelected}
              className="flex items-center gap-1.5 rounded-full bg-slate-800 hover:bg-slate-700 px-3.5 py-1.5 text-xs font-bold text-blue-400 transition border border-blue-400/30"
            >
              🤖 Relancer IA ({selectedCount})
            </button>
          )}

          <button
            type="button"
            onClick={onDeleteSelected}
            className="flex items-center gap-1.5 rounded-full bg-rose-600/20 hover:bg-rose-600/40 px-4 py-1.5 text-xs font-black text-rose-400 hover:text-rose-200 transition border border-rose-500/30"
          >
            🗑️ Supprimer ({selectedCount})
          </button>

        </div>

      </div>
    </div>
  );
}
