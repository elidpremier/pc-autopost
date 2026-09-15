'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import BatchGenerateModal from '@/components/BatchGenerateModal';
import RenderStudioModal from '@/components/workspace/RenderStudioModal';
import { CONDITION_LABELS, STORAGE_TYPES, type PcStatus } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import type { ComputerRow } from '@/lib/db';

type StockItemRow = {
  computer: ComputerRow;
  thumb: string | null;
  daysAvailable: number;
  imageCount: number;
  missingFields: string[];
};

type Props = {
  rows: StockItemRow[];
  settings: { shop_name: string; currency: string };
  currentStatus?: PcStatus;
  currentQuery?: string;
};

const FILTERS: { id: string; label: string }[] = [
  { id: '', label: 'Tous' },
  { id: 'available', label: 'Disponibles' },
  { id: 'reserved', label: 'Réservés' },
  { id: 'sold', label: 'Vendus' },
  { id: 'archived', label: 'Archivés' },
  { id: '__duplicates__', label: '⚠️ Doublons' },
];

export default function StockDashboard({ rows, settings, currentStatus, currentQuery }: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [studioComputerId, setStudioComputerId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Recherche et filtre de statut dynamiques côté client
  const [searchQuery, setSearchQuery] = useState<string>(currentQuery ?? '');
  const [activeStatus, setActiveStatus] = useState<string>(currentStatus ?? '');

  // Filtres avancés & Tri
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedCondition, setSelectedCondition] = useState<string>('');
  const [selectedRam, setSelectedRam] = useState<string>('');
  const [selectedStorageCapacity, setSelectedStorageCapacity] = useState<string>('');
  const [selectedScreenSize, setSelectedScreenSize] = useState<string>('');
  const [selectedTouchscreen, setSelectedTouchscreen] = useState<string>('');
  const [selectedGraphicsBrand, setSelectedGraphicsBrand] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [completenessFilter, setCompletenessFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Extrait la liste des marques disponibles dans le stock
  const availableBrands = Array.from(
    new Set(
      rows
        .map((r) => r.computer.brand?.trim())
        .filter((b): b is string => Boolean(b && b.length > 0))
    )
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const activeAdvancedFilterCount = [
    selectedBrand !== '',
    selectedCondition !== '',
    selectedRam !== '',
    selectedStorageCapacity !== '',
    selectedScreenSize !== '',
    selectedTouchscreen !== '',
    selectedGraphicsBrand !== '',
    minPrice !== '',
    maxPrice !== '',
    completenessFilter !== '',
  ].filter(Boolean).length;

  function resetAllFilters() {
    setSearchQuery('');
    setActiveStatus('');
    setSelectedBrand('');
    setSelectedCondition('');
    setSelectedRam('');
    setSelectedStorageCapacity('');
    setSelectedScreenSize('');
    setSelectedTouchscreen('');
    setSelectedGraphicsBrand('');
    setMinPrice('');
    setMaxPrice('');
    setCompletenessFilter('');
    setSortBy('newest');
  }

  // --- Détection des doublons ---
  // Une fiche est un doublon si une autre fiche partage la même clef (marque + modèle + RAM + stockage + type).
  // On calcule d'abord le Set des IDs concernés, puis on l'utilise dans le filtre.
  const duplicateIds: Set<string> = (() => {
    const groups: Record<string, string[]> = {};
    for (const { computer: c } of rows) {
      const key = [
        (c.brand ?? '').toLowerCase().trim(),
        (c.model ?? '').toLowerCase().trim(),
        // Normalise le processeur : on garde uniquement les mots-clés significatifs
        // ex: "Intel Core i5-1135G7" → "i5", "AMD Ryzen 5 5500U" → "ryzen5"
        (c.processor ?? '')
          .toLowerCase()
          .replace(/intel\s+core\s*/i, '')   // retire "Intel Core"
          .replace(/\s+/g, ' ')
          .trim()
          .split(/[\s\-]/)[0] ?? '',          // garde uniquement le premier token (i5, i7, ryzen, celeron…)
        String(c.ram_gb ?? ''),
        String(c.storage_capacity_gb ?? ''),
        (c.storage_type ?? '').toLowerCase().trim(),
      ].join('|');
      if (!groups[key]) groups[key] = [];
      groups[key].push(c.id);
    }
    const ids = new Set<string>();
    for (const group of Object.values(groups)) {
      if (group.length > 1) group.forEach((id) => ids.add(id));
    }
    return ids;
  })();

  // Filtrage réactif et tri (recherche + statut + pseudo-filtre doublons + filtres avancés)
  const filteredRows = rows
    .filter((r) => {
      const matchStatus =
        activeStatus === '' ? true
        : activeStatus === '__duplicates__' ? duplicateIds.has(r.computer.id)
        : r.computer.status === activeStatus;

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (r.computer.brand ?? '').toLowerCase().includes(q) ||
        (r.computer.model ?? '').toLowerCase().includes(q) ||
        (r.computer.processor ?? '').toLowerCase().includes(q) ||
        (r.computer.graphics ?? '').toLowerCase().includes(q) ||
        (r.computer.notes ?? '').toLowerCase().includes(q) ||
        `${r.computer.brand ?? ''} ${r.computer.model ?? ''}`.toLowerCase().includes(q);

      const matchBrand =
        !selectedBrand || (r.computer.brand ?? '').toLowerCase() === selectedBrand.toLowerCase();

      const matchCondition = !selectedCondition || r.computer.condition === selectedCondition;

      let matchRam = true;
      if (selectedRam === 'lt8') matchRam = (r.computer.ram_gb ?? 0) > 0 && (r.computer.ram_gb ?? 0) < 8;
      else if (selectedRam === '8') matchRam = r.computer.ram_gb === 8;
      else if (selectedRam === '16') matchRam = r.computer.ram_gb === 16;
      else if (selectedRam === 'gte32') matchRam = (r.computer.ram_gb ?? 0) >= 32;

      // Capacité de stockage
      let matchStorageCap = true;
      const cap = r.computer.storage_capacity_gb ?? 0;
      if (selectedStorageCapacity === 'lt256') matchStorageCap = cap > 0 && cap < 256;
      else if (selectedStorageCapacity === '256') matchStorageCap = cap === 256;
      else if (selectedStorageCapacity === '512') matchStorageCap = cap === 512;
      else if (selectedStorageCapacity === 'gte1000') matchStorageCap = cap >= 1000;

      // Taille d'écran
      let matchScreenSize = true;
      const scr = r.computer.screen_size ?? 0;
      if (selectedScreenSize === 'lt14') matchScreenSize = scr > 0 && scr < 14;
      else if (selectedScreenSize === '14') matchScreenSize = scr >= 14 && scr < 15;
      else if (selectedScreenSize === '15.6') matchScreenSize = scr >= 15 && scr <= 16;
      else if (selectedScreenSize === 'gte17') matchScreenSize = scr >= 17;

      // Écran tactile & x360
      const isTouch =
        (r.computer.screen_resolution ?? '').toLowerCase().includes('tactil') ||
        (r.computer.screen_resolution ?? '').toLowerCase().includes('touch') ||
        (r.computer.notes ?? '').toLowerCase().includes('tactil') ||
        (r.computer.notes ?? '').toLowerCase().includes('touch');
      const isX360 =
        (r.computer.screen_resolution ?? '').toLowerCase().includes('360') ||
        (r.computer.screen_resolution ?? '').toLowerCase().includes('pliable') ||
        (r.computer.model ?? '').toLowerCase().includes('360') ||
        (r.computer.model ?? '').toLowerCase().includes('pliable') ||
        (r.computer.notes ?? '').toLowerCase().includes('360') ||
        (r.computer.notes ?? '').toLowerCase().includes('pliable');

      const matchTouchscreen =
        selectedTouchscreen === '' ? true
        : selectedTouchscreen === 'touch' ? isTouch
        : selectedTouchscreen === 'x360' ? isX360
        : !isTouch;

      // Carte graphique
      const gfx = (r.computer.graphics ?? '').toLowerCase();
      let matchGraphics = true;
      if (selectedGraphicsBrand === 'nvidia') matchGraphics = gfx.includes('nvidia') || gfx.includes('rtx') || gfx.includes('gtx') || gfx.includes('geforce') || gfx.includes('quadro');
      else if (selectedGraphicsBrand === 'intel') matchGraphics = gfx.includes('intel') || gfx.includes('iris') || gfx.includes('uhd') || gfx.includes('hd graphics');
      else if (selectedGraphicsBrand === 'amd') matchGraphics = gfx.includes('amd') || gfx.includes('radeon') || gfx.includes('vega');
      else if (selectedGraphicsBrand === 'apple') matchGraphics = gfx.includes('apple') || gfx.includes('m1') || gfx.includes('m2') || gfx.includes('m3') || gfx.includes('m4');

      const price = r.computer.price_amount ?? 0;
      const minP = minPrice !== '' ? Number(minPrice) : null;
      const maxP = maxPrice !== '' ? Number(maxPrice) : null;
      const matchMinPrice = minP === null || isNaN(minP) || price >= minP;
      const matchMaxPrice = maxP === null || isNaN(maxP) || price <= maxP;

      const isReady = r.missingFields.length === 0 && r.imageCount > 0;
      const matchCompleteness =
        completenessFilter === '' ? true
        : completenessFilter === 'complete' ? isReady
        : !isReady;

      return (
        matchStatus &&
        matchSearch &&
        matchBrand &&
        matchCondition &&
        matchRam &&
        matchStorageCap &&
        matchScreenSize &&
        matchTouchscreen &&
        matchGraphics &&
        matchMinPrice &&
        matchMaxPrice &&
        matchCompleteness
      );
    })
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.computer.created_at).getTime() - new Date(a.computer.created_at).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.computer.created_at).getTime() - new Date(b.computer.created_at).getTime();
      }
      if (sortBy === 'price_asc') {
        return (a.computer.price_amount ?? 0) - (b.computer.price_amount ?? 0);
      }
      if (sortBy === 'price_desc') {
        return (b.computer.price_amount ?? 0) - (a.computer.price_amount ?? 0);
      }
      if (sortBy === 'brand_asc') {
        return (a.computer.brand ?? '').localeCompare(b.computer.brand ?? '');
      }
      return 0;
    });

  // Raccourci Échap pour annuler la sélection et fermer le studio/modales
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (studioComputerId !== null) {
          setStudioComputerId(null);
        }
        if (showBatchModal) {
          setShowBatchModal(false);
        }
        if (selectedIds.length > 0) {
          setSelectedIds([]);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [studioComputerId, showBatchModal, selectedIds]);

  // Stats toujours calculées sur l'ensemble du stock (pas sur les résultats filtrés)
  const stats = {
    available: rows.filter((r) => r.computer.status === 'available').length,
    reserved: rows.filter((r) => r.computer.status === 'reserved').length,
    sold: rows.filter((r) => r.computer.status === 'sold').length,
    archived: rows.filter((r) => r.computer.status === 'archived').length,
    duplicate: rows.filter((r) => r.computer.status === 'duplicate' || duplicateIds.has(r.computer.id)).length,
  };

  const allSelected = filteredRows.length > 0 && filteredRows.every((r) => selectedIds.includes(r.computer.id));

  function toggleSelectAll() {
    if (allSelected) {
      // Désélectionner les fiches visibles
      const visibleIds = new Set(filteredRows.map((r) => r.computer.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      // Sélectionner toutes les fiches visibles en plus des déjà sélectionnées
      const visibleIds = filteredRows.map((r) => r.computer.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  }

  function handleCardClick(id: string, e: React.MouseEvent) {
    // Si Ctrl ou Cmd est enfoncé, basculer la sélection sans ouvrir le studio
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter((item) => item !== id));
      } else {
        setSelectedIds([...selectedIds, id]);
      }
    } else {
      // Clic simple : ouvrir le Studio de Rendu & Fiche Produit
      setStudioComputerId(id);
    }
  }

  function toggleSelectCheckbox(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  }

  async function handleDeleteSingle(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Voulez-vous vraiment supprimer cet ordinateur et ses images de manière définitive ?')) {
      return;
    }
    try {
      setIsDeleting(true);
      const res = await fetch('/api/computers/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ computerIds: [id] }),
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      if (studioComputerId === id) setStudioComputerId(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur de suppression');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDeleteBatch() {
    if (selectedIds.length === 0) return;
    if (
      !confirm(
        `Voulez-vous vraiment supprimer définitivement ces ${selectedIds.length} ordinateur(s) et leurs images associées ?`
      )
    ) {
      return;
    }
    try {
      setIsDeleting(true);
      const res = await fetch('/api/computers/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ computerIds: selectedIds }),
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression par lot');
      setSelectedIds([]);
      setStudioComputerId(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur de suppression');
    } finally {
      setIsDeleting(false);
    }
  }

  // Navigation dans le Studio entre fiches produits
  const studioIndex = studioComputerId
    ? rows.findIndex((r) => r.computer.id === studioComputerId)
    : -1;

  const handlePreviousProduct = () => {
    if (studioIndex > 0) {
      setStudioComputerId(rows[studioIndex - 1].computer.id);
    }
  };

  const handleNextProduct = () => {
    if (studioIndex >= 0 && studioIndex < rows.length - 1) {
      setStudioComputerId(rows[studioIndex + 1].computer.id);
    }
  };

  const selectedComputers = rows
    .filter((r) => selectedIds.includes(r.computer.id))
    .map((r) => ({
      id: r.computer.id,
      brand: r.computer.brand,
      model: r.computer.model,
      price_amount: r.computer.price_amount,
      currency: r.computer.currency,
      status: r.computer.status,
      imageCount: r.imageCount,
      missingFields: r.missingFields,
    }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 relative pb-28">
      {/* Top Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mon stock</h1>
          <p className="mt-1 text-sm text-slate-500">
            {settings.shop_name} — {rows.length} produit{rows.length > 1 ? 's' : ''} (Cliquez sur un produit pour ouvrir le Studio de Rendu)
          </p>
        </div>

        {/* Alerte doublons */}
        {duplicateIds.size > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-400/20">
            <span className="text-base">⚠️</span>
            <span>
              <strong>{duplicateIds.size} fiche{duplicateIds.size > 1 ? 's' : ''}</strong> semblent être des doublons.
            </span>
            <button
              type="button"
              onClick={() => { setActiveStatus('__duplicates__'); setSearchQuery(''); }}
              className="ml-2 rounded-lg bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-300 transition dark:bg-amber-400/30 dark:text-amber-200 dark:hover:bg-amber-400/50"
            >
              Voir les doublons
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          {rows.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="btn-ghost text-xs font-semibold"
            >
              {allSelected ? '✕ Désélectionner tout' : '☑ Tout sélectionner'}
            </button>
          )}
        </div>
      </div>

      {/* Cartes Statut */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ['available', stats.available, 'text-emerald-600'],
            ['reserved', stats.reserved, 'text-amber-600'],
            ['sold', stats.sold, 'text-slate-600'],
            ['archived', stats.archived, 'text-slate-400'],
            ['__duplicates__', stats.duplicate, 'text-red-500'],
          ] as const
        ).map(([key, n, color]) => (
          <div
            key={key}
            onClick={() => setActiveStatus(activeStatus === key ? '' : key)}
            className={`card px-4 py-3 cursor-pointer transition-all hover:scale-105 ${
              activeStatus === key ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/40' : 'hover:border-slate-300'
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {FILTERS.find((f) => f.id === key)?.label}
            </div>
            <div className={`mt-1 text-2xl font-bold ${color}`}>{n}</div>
          </div>
        ))}
      </div>

      {/* Barre de Recherche, Filtres et Tri */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Onglets de Statut */}
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveStatus(f.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  activeStatus === f.id
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Champ de recherche dynamique, Bouton Filtres et Trier */}
          <div className="relative ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher (marque, modèle, processeur…)"
                className="input pl-9 w-56 sm:w-72"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white text-lg leading-none"
                  title="Effacer la recherche"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Bouton Filtres Avancés */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                showAdvancedFilters || activeAdvancedFilterCount > 0
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-400/30'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              <span>🎛️ Filtres</span>
              {activeAdvancedFilterCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-black text-white">
                  {activeAdvancedFilterCount}
                </span>
              )}
            </button>

            {/* Sélecteur de Tri */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input text-sm py-2 px-3 cursor-pointer"
              title="Trier la liste"
            >
              <option value="newest">📅 Récent ➔ Ancien</option>
              <option value="oldest">📅 Ancien ➔ Récent</option>
              <option value="price_asc">🏷️ Prix : croissant</option>
              <option value="price_desc">🏷️ Prix : décroissant</option>
              <option value="brand_asc">🔤 Marque (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Panneau des filtres avancés */}
        {showAdvancedFilters && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60 backdrop-blur-sm transition">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span>🎛️ Filtres multicritères</span>
              </h3>
              {(activeAdvancedFilterCount > 0 || searchQuery || activeStatus) && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition flex items-center gap-1"
                >
                  ✕ Réinitialiser tous les filtres
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Marque */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Marque
                </label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="input text-sm w-full"
                >
                  <option value="">Toutes les marques</option>
                  {availableBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* État du produit */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  État du matériel
                </label>
                <select
                  value={selectedCondition}
                  onChange={(e) => setSelectedCondition(e.target.value)}
                  className="input text-sm w-full"
                >
                  <option value="">Tous les états</option>
                  {Object.entries(CONDITION_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mémoire RAM */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Mémoire RAM
                </label>
                <select
                  value={selectedRam}
                  onChange={(e) => setSelectedRam(e.target.value)}
                  className="input text-sm w-full"
                >
                  <option value="">Toutes les configurations RAM</option>
                  <option value="lt8">&lt; 8 Go</option>
                  <option value="8">8 Go</option>
                  <option value="16">16 Go</option>
                  <option value="gte32">32 Go et plus</option>
                </select>
              </div>

              {/* Capacité de Stockage */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Capacité de stockage
                </label>
                <select
                  value={selectedStorageCapacity}
                  onChange={(e) => setSelectedStorageCapacity(e.target.value)}
                  className="input text-sm w-full"
                >
                  <option value="">Toutes les capacités</option>
                  <option value="lt256">&lt; 256 Go</option>
                  <option value="256">256 Go</option>
                  <option value="512">512 Go</option>
                  <option value="gte1000">1 To+ (1000 Go et +)</option>
                </select>
              </div>

              {/* Taille d'écran */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Taille d'écran
                </label>
                <select
                  value={selectedScreenSize}
                  onChange={(e) => setSelectedScreenSize(e.target.value)}
                  className="input text-sm w-full"
                >
                  <option value="">Toutes les tailles</option>
                  <option value="lt14">&lt; 14" (Ultraportable)</option>
                  <option value="14">14" (Compact)</option>
                  <option value="15.6">15.6" (Standard)</option>
                  <option value="gte17">17"+ (Grand écran)</option>
                </select>
              </div>

              {/* Écran tactile */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Écran tactile
                </label>
                <select
                  value={selectedTouchscreen}
                  onChange={(e) => setSelectedTouchscreen(e.target.value)}
                  className="input text-sm w-full"
                >
                  <option value="">Tous les écrans</option>
                  <option value="touch">🖐️ Tactile uniquement</option>
                  <option value="x360">🔄 x360° / Pliable / Convertible</option>
                  <option value="non_touch">🖥️ Non-tactile</option>
                </select>
              </div>

              {/* Carte Graphique */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Carte graphique
                </label>
                <select
                  value={selectedGraphicsBrand}
                  onChange={(e) => setSelectedGraphicsBrand(e.target.value)}
                  className="input text-sm w-full"
                >
                  <option value="">Toutes les cartes</option>
                  <option value="nvidia">NVIDIA GeForce / RTX / GTX</option>
                  <option value="intel">Intel Iris Xe / UHD / HD</option>
                  <option value="amd">AMD Radeon / Vega</option>
                  <option value="apple">Apple Silicon GPU</option>
                </select>
              </div>

              {/* Prix Min */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Prix minimum ({settings.currency})
                </label>
                <input
                  type="number"
                  placeholder="ex: 50000"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="input text-sm w-full"
                  min="0"
                />
              </div>

              {/* Prix Max */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Prix maximum ({settings.currency})
                </label>
                <input
                  type="number"
                  placeholder="ex: 250000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="input text-sm w-full"
                  min="0"
                />
              </div>

              {/* Complétude de la fiche */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Complétude de la fiche
                </label>
                <select
                  value={completenessFilter}
                  onChange={(e) => setCompletenessFilter(e.target.value)}
                  className="input text-sm w-full"
                >
                  <option value="">Toutes les fiches</option>
                  <option value="complete">✅ Fiches complètes / Prêtes</option>
                  <option value="incomplete">⚠️ Fiches incomplètes</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Résumé des résultats et réinitialisation */}
        {(searchQuery || activeStatus || activeAdvancedFilterCount > 0) && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>
              <strong>{filteredRows.length}</strong> produit{filteredRows.length > 1 ? 's' : ''} trouvé{filteredRows.length > 1 ? 's' : ''} sur {rows.length} au total
            </span>
            <button
              type="button"
              onClick={resetAllFilters}
              className="font-bold text-slate-500 hover:text-red-600 transition"
            >
              Effacer les filtres (✕)
            </button>
          </div>
        )}
      </div>

      {/* Liste des cartes / Stock vide */}
      {rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="text-4xl">📦</div>
          <h2 className="text-lg font-semibold">Aucun ordinateur pour le moment</h2>
          <p className="max-w-md text-sm text-slate-500">
            Ajoutez votre premier produit : photos, caractéristiques, prix. PC AutoPost générera ensuite les visuels
            et les textes prêts à publier.
          </p>
          <Link href="/computers/new" className="btn-primary mt-2">Créer ma première fiche</Link>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="text-4xl">🔍</div>
          <h2 className="text-lg font-semibold">Aucun résultat</h2>
          <p className="text-sm text-slate-500">Aucun ordinateur ne correspond à vos critères de recherche.</p>
          <button type="button" onClick={resetAllFilters} className="btn-ghost text-sm mt-1">Réinitialiser les filtres</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRows.map(({ computer: c, thumb, daysAvailable, imageCount, missingFields }) => {
            const isSelected = selectedIds.includes(c.id);
            const isReady = missingFields.length === 0 && imageCount > 0;

            return (
              <div
                key={c.id}
                className={`card group relative overflow-hidden transition hover:shadow-xl cursor-pointer border-2 ${
                  isSelected ? 'border-lime-400 ring-2 ring-lime-400/30' : 'border-transparent hover:border-blue-500/50'
                }`}
                onClick={(e) => handleCardClick(c.id, e)}
              >
                {/* Case à cocher de sélection & bouton suppression individuel */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSingle(c.id, e)}
                    disabled={isDeleting}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/60 backdrop-blur text-red-400 hover:bg-red-600 hover:text-white transition shadow opacity-0 group-hover:opacity-100"
                    title="Supprimer la fiche"
                  >
                    🗑️
                  </button>

                  <div onClick={(e) => toggleSelectCheckbox(c.id, e)}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="h-5 w-5 rounded border-slate-300 text-lime-500 focus:ring-lime-400 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="relative h-44 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {thumb ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={thumb} alt={`${c.brand} ${c.model}`} className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl text-slate-300">🖼️</div>
                  )}
                  <div className="absolute left-2 top-2 flex flex-col gap-1 items-start">
                    <StatusBadge status={c.status} />
                    {!isReady && (
                      <span className="rounded-full bg-amber-500/90 backdrop-blur px-2 py-0.5 text-[10px] font-bold text-white shadow">
                        ⚠️ Fiche incomplète
                      </span>
                    )}
                    {duplicateIds.has(c.id) && (
                      <span className="rounded-full bg-red-600/90 backdrop-blur px-2 py-0.5 text-[10px] font-bold text-white shadow" title="Une autre fiche avec les mêmes caractéristiques existe dans le stock">
                        🔁 Doublon possible
                      </span>
                    )}
                  </div>
                  {c.status === 'available' && daysAvailable >= 7 && (
                    <div className="absolute bottom-2 left-2 rounded-full bg-blue-700/95 px-2.5 py-1 text-[11px] font-semibold text-white">
                      Disponible depuis {daysAvailable} j — à républier
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className="font-semibold leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition break-words line-clamp-2"
                      title={`${c.brand || ''} ${c.model || ''}`}
                    >
                      {c.brand || 'Marque ?'} {c.model || '—'}
                    </h3>
                    <span className="whitespace-nowrap text-sm font-bold text-blue-700 dark:text-blue-400">
                      {formatPrice(c.price_amount, c.currency)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5">{CONDITION_LABELS[c.condition]}</span>
                    {c.ram_gb ? <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5">{c.ram_gb} Go RAM</span> : null}
                    {c.storage_capacity_gb ? (
                      <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5">
                        💾 {c.storage_capacity_gb} Go {c.storage_type ? `(${c.storage_type})` : ''}
                      </span>
                    ) : null}
                    {c.screen_size || c.screen_resolution ? (
                      <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5">
                        🖥️ {c.screen_size ? `${c.screen_size}"` : ''}
                        {c.screen_resolution ? ` ${c.screen_resolution}` : ''}
                        {((c.screen_resolution ?? '').toLowerCase().includes('tactil') || (c.screen_resolution ?? '').toLowerCase().includes('touch')) && !(c.screen_resolution ?? '').toLowerCase().includes('tactile') ? ' 🖐️' : ''}
                      </span>
                    ) : null}
                    {c.graphics ? (
                      <span className="rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5">
                        🎮 {c.graphics}
                      </span>
                    ) : null}
                    {c.ports && c.ports.length > 0 ? (
                      <span className="rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5">
                        🔌 {c.ports.join(', ')}
                      </span>
                    ) : null}
                    <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5">📷 {imageCount}</span>
                  </div>

                  <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-blue-600 group-hover:underline dark:text-blue-400 flex items-center gap-1">
                      🎨 Studio de Rendu & Légende ➔
                    </span>
                    <Link
                      href={`/computers/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                      title="Modifier les photos et caractéristiques"
                    >
                      ✏️ Fiche
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Bar pour les actions par Lot (Génération + Suppression) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full bg-slate-950/90 text-white px-6 py-3 shadow-2xl backdrop-blur-md border border-slate-800 animate-slide-up">
          <div className="flex items-center gap-2 mr-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime-400 text-black text-xs font-black">
              {selectedIds.length}
            </span>
            <span className="text-sm font-semibold text-slate-200">
              sélectionné{selectedIds.length > 1 ? 's' : ''}
            </span>
          </div>

          <button
            onClick={() => setShowBatchModal(true)}
            className="rounded-full bg-gradient-to-r from-lime-400 to-emerald-400 px-5 py-2 text-xs font-black text-black shadow-lg shadow-lime-400/20 hover:scale-105 transition"
          >
            ⚡ Télécharger les affiches par lot
          </button>

          <button
            onClick={handleDeleteBatch}
            disabled={isDeleting}
            className="rounded-full bg-red-600/80 hover:bg-red-600 px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5"
          >
            🗑️ Supprimer ({selectedIds.length})
          </button>
        </div>
      )}

      {/* Studio de Rendu HD & Fiche Produit (avec navigation Précédent/Suivant) */}
      {studioComputerId && (
        <RenderStudioModal
          isOpen={!!studioComputerId}
          onClose={() => setStudioComputerId(null)}
          computerId={studioComputerId}
          onPrevious={studioIndex > 0 ? handlePreviousProduct : undefined}
          onNext={studioIndex >= 0 && studioIndex < rows.length - 1 ? handleNextProduct : undefined}
          currentIndex={studioIndex !== -1 ? studioIndex + 1 : undefined}
          totalCount={rows.length}
          onDelete={(id) => {
            setSelectedIds((prev) => prev.filter((item) => item !== id));
          }}
          onUpdated={() => router.refresh()}
        />
      )}

      {/* Modal de Génération / Téléchargement par Lot */}
      <BatchGenerateModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        selectedComputers={selectedComputers}
        onComplete={() => {
          setSelectedIds([]);
        }}
      />
    </div>
  );
}


