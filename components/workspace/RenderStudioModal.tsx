'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FORMAT_INFO, FORMATS, type Format, type ImageRow, type ExtractedField, type ComputerFields, type StorageType } from '@/lib/types';
import FacebookPublishModal from './FacebookPublishModal';
import CropSlider from './CropSlider';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  computerId: string;
  initialFormat?: Format;
  initialTemplate?: string;
  texts?: { facebook: string; instagram: string; whatsapp: string };
  onPrevious?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
  onDelete?: (id: string) => void;
  onUpdated?: () => void;
};

const TEMPLATE_OPTIONS = [
  { id: 'cyber_luxe_v2', label: 'Cyber Luxe v2', badge: 'Base PSD Ultra-Tech', color: 'bg-purple-500' },
  { id: 'promo_banner', label: 'Bannière Promo', badge: 'High Impact Offre', color: 'bg-lime-400' },
];

const COLOR_PRESETS = [
  { name: 'Violet PSD', primary: '#7C3AED', accent: '#CCFF00' },
  { name: 'Bleu Cyber', primary: '#2563EB', accent: '#00F0FF' },
  { name: 'Cyan Tech', primary: '#06B6D4', accent: '#FF0055' },
  { name: 'Vert Émeraude', primary: '#059669', accent: '#FFD700' },
  { name: 'Rouge Impact', primary: '#DC2626', accent: '#FFCC00' },
  { name: 'Ambre Gold', primary: '#D97706', accent: '#00FFFF' },
];

export default function RenderStudioModal({
  isOpen,
  onClose,
  computerId,
  initialFormat = 'square',
  initialTemplate = 'cyber_luxe_v2',
  texts: initialTexts,
  onPrevious,
  onNext,
  currentIndex,
  totalCount,
  onDelete,
  onUpdated,
}: Props) {
  const router = useRouter();
  const [currentFormat, setCurrentFormat] = useState<Format>(initialFormat);
  const [currentTemplate, setCurrentTemplate] = useState<string>(initialTemplate);
  const [colorPrimary, setColorPrimary] = useState<string>('#7C3AED');
  const [colorAccent, setColorAccent] = useState<string>('#CCFF00');
  const [textTab, setTextTab] = useState<'facebook' | 'instagram' | 'whatsapp'>('facebook');
  const [loadingImg, setLoadingImg] = useState(true);
  const [copied, setCopied] = useState(false);
  const [imgTick, setImgTick] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [refineSuccess, setRefineSuccess] = useState<string | null>(null);
  const [currentProcessor, setCurrentProcessor] = useState<string>('');
  const [currentGraphics, setCurrentGraphics] = useState<string>('');
  const [specs, setSpecs] = useState<Partial<ComputerFields>>({});
  const [showAdjustSpecs, setShowAdjustSpecs] = useState(true);
  const [isSavingSpecs, setIsSavingSpecs] = useState(false);
  const [specsSavedMsg, setSpecsSavedMsg] = useState<string | null>(null);
  const [pendingProposal, setPendingProposal] = useState<{
    field: 'processor' | 'graphics';
    value: string;
    method: 'ai' | 'rule';
  } | null>(null);

  // Recadrage & Zone OCR dans le Studio
  const [leftTab, setLeftTab] = useState<'render' | 'crop'>('render');
  const [images, setImages] = useState<ImageRow[]>([]);
  const [cropRatio, setCropRatio] = useState<number>(0.32);
  const [isCropping, setIsCropping] = useState(false);
  const [cropSuccess, setCropSuccess] = useState<string | null>(null);
  const [cropTick, setCropTick] = useState<number>(0);
  const [extractedProposal, setExtractedProposal] = useState<{
    fields: ExtractedField[];
    structured: Partial<ComputerFields>;
  } | null>(null);

  const [loadedTexts, setLoadedTexts] = useState<{ facebook: string; instagram: string; whatsapp: string } | null>(
    initialTexts || null
  );

  // Facebook publish modal
  const [showFbModal, setShowFbModal] = useState(false);

  function refreshProductTexts(c: Partial<ComputerFields> & { price_amount?: number | null; currency?: string | null; phone?: string | null }) {
    const title = `${c.brand || ''} ${c.model || ''}`.trim() || 'Ordinateur portable';
    const price = c.price_amount
      ? `${new Intl.NumberFormat('fr-FR').format(c.price_amount)} ${c.currency || 'FCFA'}`
      : 'Prix sur demande';

    setLoadedTexts({
      facebook: `💻 ${title}\n🔧 ${c.processor || 'Processeur Performant'}\n🧠 RAM : ${c.ram_gb ? `${c.ram_gb} Go` : 'Standard'}\n💾 Stockage : ${c.storage_capacity_gb ? `${c.storage_capacity_gb} ${c.storage_type || 'Go'}` : 'Inclus'}${c.graphics ? `\n🎮 Graphique : ${c.graphics}` : ''}\n💰 ${price}\n📞 ${c.phone || ''}\n#PC #Informatique #${c.brand || 'Tech'}`,
      instagram: `💻 ${title}\n${c.processor || ''} • ${c.ram_gb ? `${c.ram_gb}Go RAM` : ''} • ${c.storage_capacity_gb ? `${c.storage_capacity_gb}Go` : ''}${c.graphics ? ` • ${c.graphics}` : ''}\n💰 ${price}\n#pc #informatique #${c.brand || 'tech'}`,
      whatsapp: `Bonjour 👋\nJe vous propose cet ordinateur ${title} :\n• Processeur : ${c.processor || '-'}\n• RAM : ${c.ram_gb ? `${c.ram_gb} Go` : '-'}\n• Stockage : ${c.storage_capacity_gb ? `${c.storage_capacity_gb} ${c.storage_type || 'Go'}` : '-'}${c.graphics ? `\n• Graphique : ${c.graphics}` : ''}\n💰 Prix : ${price}\nContact : ${c.phone || 'Me contacter'}`,
    });
  }

  async function handleRefine(field: 'processor' | 'graphics', mode: 'auto' | 'ai' | 'rule' = 'auto') {
    try {
      setIsRefining(true);
      setRefineSuccess(null);
      setPendingProposal(null);
      const endpoint = field === 'processor' ? 'refine-processor' : 'refine-graphics';
      const res = await fetch(`/api/computers/${computerId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, apply: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de réactualisation');

      const proposed = (field === 'processor' ? data.proposedProcessor : data.proposedGraphics) || '';
      const current = field === 'processor' ? currentProcessor : currentGraphics;

      if (!data.hasChanged && proposed === current) {
        setRefineSuccess(`Le champ ${field === 'processor' ? 'processeur' : 'carte graphique'} est déjà conforme.`);
        setTimeout(() => setRefineSuccess(null), 3500);
      } else {
        setPendingProposal({
          field,
          value: proposed,
          method: data.method || (mode === 'ai' ? 'ai' : 'rule'),
        });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la réactualisation');
    } finally {
      setIsRefining(false);
    }
  }

  async function acceptProposal() {
    if (!pendingProposal) return;
    try {
      setIsRefining(true);
      const { field, value, method } = pendingProposal;
      const endpoint = field === 'processor' ? 'refine-processor' : 'refine-graphics';
      const bodyKey = field === 'processor' ? 'processor' : 'graphics';

      const res = await fetch(`/api/computers/${computerId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply: true, [bodyKey]: value, mode: method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l’application');

      if (field === 'processor') {
        setCurrentProcessor(value);
      } else {
        setCurrentGraphics(value);
      }
      setPendingProposal(null);
      setRefineSuccess(`${field === 'processor' ? 'Processeur' : 'Carte graphique'} mis à jour : "${value}"`);
      setTimeout(() => setRefineSuccess(null), 4000);

      // Rafraîchir l'image du studio
      setLoadingImg(true);
      setImgTick((t) => t + 1);

      // Recharger les données et textes du produit
      const compRes = await fetch(`/api/computers/${computerId}`);
      const compData = await compRes.json();
      if (compData.computer) {
        refreshProductTexts(compData.computer);
      }

      if (onUpdated) onUpdated();
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la confirmation');
    } finally {
      setIsRefining(false);
    }
  }

  function refuseProposal() {
    setPendingProposal(null);
  }

  async function handleReCrop() {
    const main = images.find((i) => i.kind === 'main');
    if (!main) return;
    try {
      setIsCropping(true);
      setCropSuccess(null);
      const res = await fetch(`/api/computers/${computerId}/re-crop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: main.id, cropRatio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors du recadrage');
      if (data.images) setImages(data.images);
      setCropTick((t) => t + 1);
      setLoadingImg(true);
      setImgTick((t) => t + 1);
      setCropSuccess('✓ Recadrage appliqué avec succès ! La photo a été mise à jour.');
      setTimeout(() => setCropSuccess(null), 4000);
      if (onUpdated) onUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors du recadrage');
    } finally {
      setIsCropping(false);
    }
  }

  async function handleReCropAndExtract() {
    const main = images.find((i) => i.kind === 'main');
    if (!main) return;
    try {
      setIsCropping(true);
      setCropSuccess(null);
      setExtractedProposal(null);

      // 1. Recadrer
      const cropRes = await fetch(`/api/computers/${computerId}/re-crop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: main.id, cropRatio }),
      });
      const cropData = await cropRes.json();
      if (!cropRes.ok) throw new Error(cropData.error || 'Erreur lors du recadrage');
      if (cropData.images) setImages(cropData.images);
      setCropTick((t) => t + 1);
      setLoadingImg(true);
      setImgTick((t) => t + 1);

      // 2. Extraire la zone OCR
      const extRes = await fetch(`/api/computers/${computerId}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: main.id, cropRatio }),
      });
      const extData = await extRes.json();
      if (!extRes.ok) throw new Error(extData.error || 'Erreur lors de l’extraction');

      if (extData.structured) {
        setExtractedProposal({
          fields: extData.fields || [],
          structured: extData.structured,
        });
        setCropSuccess('Zone OCR analysée ! Vérifiez la proposition ci-dessous.');
      }
      if (onUpdated) onUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsCropping(false);
    }
  }

  async function applyExtractedSpecs() {
    if (!extractedProposal?.structured) return;
    try {
      setIsCropping(true);
      const res = await fetch(`/api/computers/${computerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extractedProposal.structured),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la mise à jour');

      if (data.computer) {
        const c = data.computer;
        setCurrentProcessor(c.processor || '');
        setCurrentGraphics(c.graphics || '');
        refreshProductTexts(c);
      }
      setExtractedProposal(null);
      setCropSuccess('✓ Fiche produit mise à jour d’après la nouvelle zone OCR !');
      setTimeout(() => setCropSuccess(null), 4000);
      setLoadingImg(true);
      setImgTick((t) => t + 1);
      setLeftTab('render');
      if (onUpdated) onUpdated();
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsCropping(false);
    }
  }

  async function handleDeleteProduct() {
    if (!confirm('Voulez-vous vraiment supprimer définitivement cet ordinateur et toutes ses images associées ?')) {
      return;
    }
    try {
      setIsDeleting(true);
      const res = await fetch('/api/computers/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ computerIds: [computerId] }),
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression de la fiche');
      
      if (onDelete) {
        onDelete(computerId);
      }

      if (onNext) {
        onNext();
      } else if (onPrevious) {
        onPrevious();
      } else {
        onClose();
      }

      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    setCurrentFormat(initialFormat);
    setCurrentTemplate(initialTemplate);
  }, [initialFormat, initialTemplate, isOpen, computerId]);

  // Navigation au clavier Flèche Gauche / Flèche Droite / Échap
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' && onPrevious) {
        onPrevious();
      } else if (e.key === 'ArrowRight' && onNext) {
        onNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onPrevious, onNext, onClose]);

  async function updateSpecsField(patch: Partial<ComputerFields>) {
    setSpecs((prev) => ({ ...prev, ...patch }));
    try {
      setIsSavingSpecs(true);
      const res = await fetch(`/api/computers/${computerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (res.ok && data.computer) {
        const c = data.computer;
        setSpecs(c);
        if ('processor' in patch) setCurrentProcessor(c.processor || '');
        if ('graphics' in patch) setCurrentGraphics(c.graphics || '');
        refreshProductTexts(c);
        setLoadingImg(true);
        setImgTick((t) => t + 1);
        setSpecsSavedMsg('✓ Mis à jour');
        setTimeout(() => setSpecsSavedMsg(null), 2500);
        if (onUpdated) onUpdated();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingSpecs(false);
    }
  }

  useEffect(() => {
    if (initialTexts) {
      setLoadedTexts(initialTexts);
    }
    if (computerId && isOpen) {
      fetch(`/api/computers/${computerId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.computer) {
            const c = data.computer;
            setSpecs(c);
            setCurrentProcessor(c.processor || '');
            setCurrentGraphics(c.graphics || '');
            if (!initialTexts) {
              refreshProductTexts(c);
            }
          }
          if (Array.isArray(data.images)) {
            setImages(data.images);
            const main = data.images.find((i: ImageRow) => i.kind === 'main');
            const cleaned = data.images.find((i: ImageRow) => i.kind === 'cleaned');
            if (main) {
              const saved = (cleaned?.crop_top ?? main.crop_top) ? (cleaned?.crop_top ?? main.crop_top)! / main.height : 0.32;
              setCropRatio(saved);
            }
          }
        })
        .catch(() => {});
    }
  }, [computerId, initialTexts, isOpen]);

  if (!isOpen) return null;

  const activeTexts = loadedTexts || {
    facebook: 'Chargement de la légende…',
    instagram: 'Chargement de la légende…',
    whatsapp: 'Chargement de la légende…',
  };

  const colorQuery = `&colorPrimary=${encodeURIComponent(colorPrimary)}&colorAccent=${encodeURIComponent(colorAccent)}`;
  const previewUrl = `/api/computers/${computerId}/preview?format=${currentFormat}&template=${currentTemplate}${colorQuery}&t=${imgTick}`;
  const downloadUrl = `/api/computers/${computerId}/preview?format=${currentFormat}&template=${currentTemplate}${colorQuery}&download=1`;

  async function copyText(t: string) {
    try {
      await navigator.clipboard.writeText(t);
      setCopied(true);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
    }
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-md animate-fade-in">
      <div className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              🎨
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Studio de Rendu & Fiche Produit
                </h3>
                {typeof currentIndex === 'number' && typeof totalCount === 'number' && (
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-slate-500">
                    Produit {currentIndex + 1} / {totalCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Aperçu réel HD — Défilez avec ← / →, téléchargez ou publiez en 1-clic.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Boutons de navigation Flèches */}
            {(onPrevious || onNext) && (
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={onPrevious}
                  disabled={!onPrevious}
                  className="rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-30"
                  title="Produit Précédent (Flèche Gauche)"
                >
                  ← Précédent
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!onNext}
                  className="rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-30"
                  title="Produit Suivant (Flèche Droite)"
                >
                  Suivant →
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleDeleteProduct}
              disabled={isDeleting}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3.5 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition disabled:opacity-50"
              title="Supprimer définitivement la fiche produit"
            >
              {isDeleting ? 'Suppression…' : '🗑️ Supprimer'}
            </button>

            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body : 2 colonnes */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12">
          
          {/* Colonne Gauche : Aperçu Réel Visuel HD OU Recadrage & Zone OCR */}
          <div className="relative flex flex-col items-center justify-between bg-slate-950 p-4 lg:col-span-7 overflow-y-auto">
            
            {/* Barre d'onglets pour basculer entre Rendu HD et Recadrage OCR */}
            <div className="flex items-center gap-1 rounded-xl bg-slate-900/90 p-1 border border-slate-800 mb-2 z-20 shrink-0">
              <button
                type="button"
                onClick={() => setLeftTab('render')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                  leftTab === 'render'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>🎨 Aperçu Rendu HD</span>
              </button>
              <button
                type="button"
                onClick={() => setLeftTab('crop')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                  leftTab === 'crop'
                    ? 'bg-amber-500 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Ajuster la ligne de recadrage et la zone lue par l'OCR"
              >
                <span>✂️ Recadrer / Zone OCR</span>
                {images.some((i) => i.kind === 'main') && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300"></span>
                )}
              </button>
            </div>

            {leftTab === 'render' ? (
              <>
                {loadingImg && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                    <span className="mt-3 text-xs font-semibold text-slate-300">Génération du rendu HD…</span>
                  </div>
                )}
                
                <div className="relative flex h-full max-h-[66vh] w-full items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Aperçu HD"
                    onLoad={() => setLoadingImg(false)}
                    onError={() => setLoadingImg(false)}
                    className="max-h-[64vh] max-w-full rounded-2xl object-contain shadow-2xl transition-all duration-300"
                  />
                </div>

                {/* Badge de format bas */}
                <div className="mt-2 flex items-center gap-2 rounded-full bg-slate-900/80 px-4 py-1.5 text-xs text-slate-300 border border-slate-800">
                  <span className="font-bold text-white">{FORMAT_INFO[currentFormat]?.label}</span>
                  <span>•</span>
                  <span>{FORMAT_INFO[currentFormat]?.h}</span>
                </div>
              </>
            ) : (
              /* Vue Recadrage & Zone OCR */
              <div className="flex flex-col items-center w-full max-h-[72vh] overflow-y-auto px-2 space-y-3">
                {images.find((i) => i.kind === 'main') ? (
                  <>
                    <div className="text-center max-w-lg px-2">
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Glissez la ligne orange : la zone <strong className="text-red-400">supérieure (rouge)</strong> est lue par l’OCR, la photo <strong className="text-emerald-400">du PC (inférieure)</strong> est conservée pour le visuel.
                      </p>
                    </div>

                    <div className="w-full max-w-xl">
                      <CropSlider
                        src={`/api/images/${images.find((i) => i.kind === 'main')!.id}?t=${cropTick}`}
                        ratio={cropRatio}
                        onRatioChange={setCropRatio}
                        naturalHeight={images.find((i) => i.kind === 'main')!.height}
                      />
                    </div>

                    {cropSuccess && (
                      <div className="rounded-xl bg-emerald-950/90 border border-emerald-800 px-4 py-2 text-xs font-bold text-emerald-300 animate-fade-in flex items-center gap-1.5">
                        <span>✓</span> {cropSuccess}
                      </div>
                    )}

                    {/* Proposition d'extraction suite à Recadrer & Ré-extraire */}
                    {extractedProposal && (
                      <div className="w-full max-w-md rounded-2xl border border-blue-500/50 bg-blue-950/80 p-3 text-left space-y-2 animate-fade-in shadow-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-blue-200 flex items-center gap-1.5">
                            <span>✨</span> Caractéristiques détectées par l'OCR :
                          </span>
                          <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300 uppercase">
                            À valider
                          </span>
                        </div>
                        <div className="rounded-xl bg-slate-900/90 p-2.5 text-[11px] font-mono space-y-1 text-slate-200 border border-slate-800">
                          {extractedProposal.structured.processor && (
                            <div>• Processeur : <strong className="text-white">{extractedProposal.structured.processor}</strong></div>
                          )}
                          {extractedProposal.structured.ram_gb && (
                            <div>• RAM : <strong className="text-white">{extractedProposal.structured.ram_gb} Go</strong></div>
                          )}
                          {extractedProposal.structured.storage_capacity_gb && (
                            <div>• Stockage : <strong className="text-white">{extractedProposal.structured.storage_capacity_gb} Go {extractedProposal.structured.storage_type || ''}</strong></div>
                          )}
                          {extractedProposal.structured.graphics && (
                            <div>• Graphique : <strong className="text-white">{extractedProposal.structured.graphics}</strong></div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={applyExtractedSpecs}
                            disabled={isCropping}
                            className="flex-1 rounded-xl bg-emerald-600 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-500 transition shadow"
                          >
                            ✓ Appliquer à la fiche
                          </button>
                          <button
                            type="button"
                            onClick={() => setExtractedProposal(null)}
                            disabled={isCropping}
                            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
                          >
                            ✕ Ignorer
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions de recadrage */}
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleReCrop}
                        disabled={isCropping}
                        className="rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-amber-400 transition shadow disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isCropping ? 'Recadrage…' : '✂️ Appliquer ce recadrage'}
                      </button>
                      <button
                        type="button"
                        onClick={handleReCropAndExtract}
                        disabled={isCropping}
                        className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-blue-500 transition shadow disabled:opacity-50 flex items-center gap-1.5"
                        title="Recadre et relance l'OCR et l'IA sur la nouvelle zone de texte"
                      >
                        {isCropping ? 'Traitement…' : '🔍 Recadrer & Ré-extraire (OCR + IA)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeftTab('render')}
                        className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
                      >
                        Voir le rendu HD →
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16">
                    <p className="text-sm text-slate-400">Aucune photo-fiche principale disponible pour ce produit.</p>
                    <Link
                      href={`/computers/${computerId}`}
                      className="mt-3 inline-block rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
                    >
                      Téléverser une photo depuis la fiche
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Colonne Droite : Contrôles, Modèles & Actions */}
          <div className="flex flex-col justify-between overflow-y-auto p-6 lg:col-span-5 border-l border-slate-100 dark:border-slate-800">
            <div className="space-y-5">
              
              {/* 1. Sélecteur de Modèle Visuel */}
              <div>
                <label className="mb-2.5 block text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  1. Modèle Visuel
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {TEMPLATE_OPTIONS.map((t) => {
                    const active = currentTemplate === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setLoadingImg(true);
                          setCurrentTemplate(t.id);
                        }}
                        className={`flex flex-col items-start rounded-2xl border p-3 text-left transition-all ${
                          active
                            ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/40'
                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{t.label}</span>
                          <span className={`h-2 w-2 rounded-full ${t.color}`} />
                        </div>
                        <span className="mt-1 text-[10px] font-semibold text-slate-500">{t.badge}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1b. Personnalisation des Couleurs */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    🎨 Thème & Couleurs
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorPrimary}
                      onChange={(e) => {
                        setLoadingImg(true);
                        setColorPrimary(e.target.value);
                      }}
                      className="h-6 w-8 cursor-pointer rounded border-0 p-0"
                      title="Couleur Principale"
                    />
                    <input
                      type="color"
                      value={colorAccent}
                      onChange={(e) => {
                        setLoadingImg(true);
                        setColorAccent(e.target.value);
                      }}
                      className="h-6 w-8 cursor-pointer rounded border-0 p-0"
                      title="Couleur Accent"
                    />
                  </div>
                </div>

                {/* Presets */}
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PRESETS.map((p) => {
                    const active = colorPrimary.toUpperCase() === p.primary.toUpperCase() && colorAccent.toUpperCase() === p.accent.toUpperCase();
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => {
                          setLoadingImg(true);
                          setColorPrimary(p.primary);
                          setColorAccent(p.accent);
                        }}
                        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
                          active
                            ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex h-2.5 w-5 items-center overflow-hidden rounded-sm border border-black/20">
                          <span className="h-full w-1/2" style={{ backgroundColor: p.primary }} />
                          <span className="h-full w-1/2" style={{ backgroundColor: p.accent }} />
                        </div>
                        {p.name.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1c. Ajustement & Édition Rapide des Caractéristiques (Specs) */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50 space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowAdjustSpecs(!showAdjustSpecs)}
                    className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-blue-600 transition"
                  >
                    <span>✏️ Ajuster les caractéristiques</span>
                    <span className="text-[10px] text-slate-400">({showAdjustSpecs ? 'Masquer' : 'Afficher'})</span>
                  </button>
                  <div className="flex items-center gap-2">
                    {isSavingSpecs && (
                      <span className="text-[11px] font-bold text-blue-500 animate-pulse">
                        Enregistrement…
                      </span>
                    )}
                    {specsSavedMsg && (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in">
                        {specsSavedMsg}
                      </span>
                    )}
                  </div>
                </div>

                {showAdjustSpecs && (
                  <div className="space-y-2.5 pt-1 animate-fade-in">
                    {/* Statut du produit */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Statut du produit
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            ['available', 'Disponible', 'bg-emerald-600 text-white'],
                            ['reserved', 'Réservé', 'bg-amber-500 text-white'],
                            ['sold', 'Vendu', 'bg-slate-700 text-white'],
                            ['archived', 'Archivé', 'bg-slate-500 text-white'],
                          ] as const
                        ).map(([sKey, sLabel, activeBg]) => {
                          const active = specs.status === sKey;
                          return (
                            <button
                              key={sKey}
                              type="button"
                              onClick={() => updateSpecsField({ status: sKey })}
                              className={`rounded-lg px-2 py-0.5 text-[11px] font-bold transition border ${
                                active
                                  ? `${activeBg} shadow-sm border-transparent scale-105`
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                              }`}
                            >
                              {sLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Marque & Modèle */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Marque</label>
                        <input
                          type="text"
                          value={specs.brand ?? ''}
                          onChange={(e) => updateSpecsField({ brand: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          placeholder="Lenovo"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Modèle</label>
                        <input
                          type="text"
                          value={specs.model ?? ''}
                          onChange={(e) => updateSpecsField({ model: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          placeholder="IdeaPad"
                        />
                      </div>
                    </div>

                    {/* Ligne Processeur */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[10px] font-bold uppercase text-slate-400">Processeur</label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRefine('processor', 'ai')}
                            disabled={isRefining}
                            className="rounded bg-purple-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white hover:bg-purple-500 transition disabled:opacity-50"
                            title="Harmoniser le processeur via l'IA"
                          >
                            ✨ IA
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRefine('processor', 'rule')}
                            disabled={isRefining}
                            className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition disabled:opacity-50"
                            title="Formatage automatique par règles"
                          >
                            ⚡ Règles
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={currentProcessor || specs.processor || ''}
                        onChange={(e) => {
                          setCurrentProcessor(e.target.value);
                          updateSpecsField({ processor: e.target.value });
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        placeholder="Intel Core i5-1145G7"
                      />
                    </div>

                    {/* RAM & Stockage & Type */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">RAM (Go)</label>
                        <input
                          type="number"
                          min="1"
                          max="128"
                          value={specs.ram_gb ?? ''}
                          onChange={(e) => updateSpecsField({ ram_gb: e.target.value ? parseInt(e.target.value, 10) : null })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          placeholder="16"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Stockage (Go)</label>
                        <input
                          type="number"
                          min="1"
                          max="8192"
                          value={specs.storage_capacity_gb ?? ''}
                          onChange={(e) => updateSpecsField({ storage_capacity_gb: e.target.value ? parseInt(e.target.value, 10) : null })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          placeholder="512"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Type</label>
                        <select
                          value={specs.storage_type ?? ''}
                          onChange={(e) => updateSpecsField({ storage_type: (e.target.value || null) as StorageType | null })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                          <option value="">—</option>
                          <option value="SSD">SSD</option>
                          <option value="HDD">HDD</option>
                          <option value="NVMe">NVMe</option>
                          <option value="eMMC">eMMC</option>
                        </select>
                      </div>
                    </div>

                    {/* Écran, Résolution & Tactile */}
                    <div className="space-y-1.5 rounded-xl border border-slate-200/80 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Écran (pouces)</label>
                          <input
                            type="number"
                            step="0.5"
                            min="8"
                            max="24"
                            value={specs.screen_size ?? ''}
                            onChange={(e) => updateSpecsField({ screen_size: e.target.value ? parseFloat(e.target.value) : null })}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            placeholder="14"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Résolution</label>
                          <input
                            type="text"
                            value={specs.screen_resolution ?? ''}
                            onChange={(e) => updateSpecsField({ screen_resolution: e.target.value || null })}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            placeholder="Full HD"
                          />
                        </div>
                      </div>
                      {/* Checkboxes Écran Tactile & x360 */}
                      <div className="flex flex-wrap items-center gap-4 pt-0.5 select-none">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={/tactil|touch/i.test(specs.screen_resolution || '')}
                            onChange={(e) => {
                              let res = specs.screen_resolution || '';
                              if (e.target.checked) {
                                if (!/tactil|touch/i.test(res)) {
                                  res = res ? `${res} Tactile` : 'Tactile';
                                }
                              } else {
                                res = res.replace(/\s*tactile/gi, '').replace(/\s*touchscreen/gi, '').replace(/\s*touch/gi, '').trim();
                              }
                              updateSpecsField({ screen_resolution: res || null });
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                            🖐️ Écran Tactile
                          </span>
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={/360|x360/i.test(specs.screen_resolution || '')}
                            onChange={(e) => {
                              let res = specs.screen_resolution || '';
                              if (e.target.checked) {
                                if (!/360|x360/i.test(res)) {
                                  res = res ? `${res} x360` : 'x360';
                                }
                              } else {
                                res = res.replace(/\s*x360/gi, '').replace(/\s*360°/gi, '').replace(/\s*360/gi, '').trim();
                              }
                              updateSpecsField({ screen_resolution: res || null });
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                            🔄 Pliable x360°
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Carte Graphique */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[10px] font-bold uppercase text-slate-400">Carte graphique</label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRefine('graphics', 'ai')}
                            disabled={isRefining}
                            className="rounded bg-purple-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white hover:bg-purple-500 transition disabled:opacity-50"
                            title="Harmoniser avec l'IA"
                          >
                            ✨ IA
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRefine('graphics', 'rule')}
                            disabled={isRefining}
                            className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition disabled:opacity-50"
                            title="Formatage automatique"
                          >
                            ⚡ Règles
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={currentGraphics || specs.graphics || ''}
                        onChange={(e) => {
                          setCurrentGraphics(e.target.value);
                          updateSpecsField({ graphics: e.target.value });
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        placeholder="Intel Iris Xe / AMD Radeon"
                      />
                    </div>

                    {/* Ports & Connectiques */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Ports (séparés par des virgules)</label>
                      <input
                        type="text"
                        value={Array.isArray(specs.ports) ? specs.ports.join(', ') : ''}
                        onChange={(e) => {
                          const pList = e.target.value.split(/[,;+]/).map((s) => s.trim()).filter(Boolean);
                          updateSpecsField({ ports: pList });
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        placeholder="USB-C, HDMI, Jack, USB 3.0"
                      />
                    </div>

                    {/* Prix & Devise */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Prix</label>
                        <input
                          type="number"
                          value={specs.price_amount ?? ''}
                          onChange={(e) => updateSpecsField({ price_amount: e.target.value ? parseInt(e.target.value, 10) : null })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          placeholder="250000"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Devise</label>
                        <input
                          type="text"
                          value={specs.currency ?? 'FCFA'}
                          onChange={(e) => updateSpecsField({ currency: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          placeholder="FCFA"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Zone de validation de proposition (Accepter / Refuser) */}
                {pendingProposal && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/95 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/60 space-y-2 animate-fade-in shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-indigo-800 dark:text-indigo-200 flex items-center gap-1">
                        <span>💡</span> Proposition {pendingProposal.field === 'processor' ? 'processeur' : 'graphique'} ({pendingProposal.method === 'ai' ? 'IA' : 'Règles'}) :
                      </span>
                      <span className="rounded bg-indigo-200/60 dark:bg-indigo-900/60 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">
                        À valider
                      </span>
                    </div>
                    <input
                      type="text"
                      value={pendingProposal.value}
                      onChange={(e) => setPendingProposal({ ...pendingProposal, value: e.target.value })}
                      className="w-full rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-white"
                      placeholder="Valeur proposée…"
                    />
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={acceptProposal}
                        disabled={isRefining}
                        className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-500 transition shadow disabled:opacity-50"
                      >
                        ✓ Accepter
                      </button>
                      <button
                        type="button"
                        onClick={refuseProposal}
                        disabled={isRefining}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition disabled:opacity-50"
                      >
                        ✕ Refuser
                      </button>
                    </div>
                  </div>
                )}

                {refineSuccess && (
                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 animate-fade-in flex items-center gap-1">
                    <span>✓</span> {refineSuccess}
                  </p>
                )}
              </div>

              {/* 2. Sélecteur de Format */}
              <div>
                <label className="mb-2.5 block text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  2. Format d'exportation
                </label>
                <div className="flex flex-wrap gap-2">
                  {FORMATS.map((f) => {
                    const active = currentFormat === f;
                    const info = FORMAT_INFO[f];
                    return (
                      <button
                        key={f}
                        onClick={() => {
                          setLoadingImg(true);
                          setCurrentFormat(f);
                        }}
                        className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                          active
                            ? 'bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {info.label} ({info.h.split(' ')[0]})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Texte de publication */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    3. Légende du Post
                  </label>
                  <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] dark:bg-slate-800">
                    {(['facebook', 'instagram', 'whatsapp'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setTextTab(tab)}
                        className={`rounded-md px-2 py-0.5 font-bold capitalize ${textTab === tab ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400' : 'text-slate-500'}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <textarea
                    readOnly
                    rows={4}
                    value={activeTexts[textTab]}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                  />
                  <button
                    onClick={() => void copyText(activeTexts[textTab])}
                    className={`absolute bottom-2.5 right-2.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${copied ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
                  >
                    {copied ? 'Copié ✓' : 'Copier'}
                  </button>
                </div>
              </div>

            </div>

            {/* 4. Boutons d'Action Final */}
            <div className="mt-6 space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <a
                href={downloadUrl}
                download
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 py-3 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition"
              >
                ⬇ Télécharger l'image HD (.jpg)
              </a>

              <button
                onClick={() => setShowFbModal(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 text-xs font-extrabold text-white shadow-md hover:bg-blue-700 transition"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Publier directement sur Facebook
              </button>

              <Link
                href={`/computers/${computerId}`}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
              >
                ✏️ Modifier la fiche produit (photos & specs)
              </Link>
            </div>

          </div>

        </div>

      </div>

      {/* Modal d'envoi Facebook */}
      {showFbModal && (
        <FacebookPublishModal
          isOpen={showFbModal}
          onClose={() => setShowFbModal(false)}
          computerId={computerId}
          generationId={null}
          filename={`preview_${currentTemplate}_${currentFormat}.jpg`}
          imageUrl={previewUrl}
          defaultCaption={activeTexts[textTab]}
        />
      )}
    </div>
  );
}
