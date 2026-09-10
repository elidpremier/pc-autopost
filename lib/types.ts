// Types partagés de PC AutoPost

export type PcStatus = 'available' | 'reserved' | 'sold' | 'archived';
export type Condition = 'neuf' | 'tres_bon' | 'bon' | 'correct' | 'a_reparer';
export type BatteryCondition = 'non_renseignee' | 'excellente' | 'bonne' | 'faible';
export type StorageType = 'SSD' | 'HDD' | 'NVMe' | 'eMMC' | 'autre';
export type ImageKind = 'main' | 'cleaned' | 'secondary';
export type CropMethod = 'none' | 'template' | 'manual';
export type Format = 'square' | 'portrait' | 'story' | 'detail';
export type Platform = 'facebook' | 'instagram' | 'whatsapp' | 'other';
export type FieldSource = 'user' | 'ocr' | 'ai';

export const STATUS_LABELS: Record<PcStatus, string> = {
  available: 'Disponible',
  reserved: 'Réservé',
  sold: 'Vendu',
  archived: 'Archivé',
};

export const CONDITION_LABELS: Record<Condition, string> = {
  neuf: 'Neuf',
  tres_bon: 'Très bon état',
  bon: 'Bon état',
  correct: 'État correct',
  a_reparer: 'À réparer',
};

export const BATTERY_LABELS: Record<BatteryCondition, string> = {
  non_renseignee: 'Non renseignée',
  excellente: 'Excellente',
  bonne: 'Bonne',
  faible: 'Faible',
};

export const STORAGE_TYPES: StorageType[] = ['SSD', 'HDD', 'NVMe', 'eMMC', 'autre'];

export const FORMAT_INFO: Record<Format, { label: string; w: number; h: string; usage: string }> = {
  square: { label: 'Carré', w: 1080, h: '1080 × 1080', usage: 'Publication générale et partage' },
  portrait: { label: 'Portrait', w: 1080, h: '1080 × 1350', usage: 'Fil Instagram' },
  story: { label: 'Story', w: 1080, h: '1080 × 1920', usage: 'Stories et statuts' },
  detail: { label: 'Fiche détaillée', w: 1080, h: '1080 × 1080', usage: 'Deuxième image — fiche technique complète' },
};

export const FORMATS: Format[] = ['square', 'portrait', 'story', 'detail'];
export const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'other', label: 'Autre' },
];

/** Champs obligatoires avant génération (spec §8.1). */
export const REQUIRED_FIELDS = ['brand', 'model', 'processor', 'ram_gb', 'storage', 'condition', 'price_amount', 'currency', 'status'] as const;

export type ComputerFields = {
  brand: string;
  model: string;
  processor: string;
  ram_gb: number | null;
  storage_capacity_gb: number | null;
  storage_type: StorageType | null;
  screen_size: number | null;
  screen_resolution: string | null;
  graphics: string | null;
  keyboard: string | null;
  ports: string[];
  accessories: string[];
  warranty: string | null;
  condition: Condition;
  battery_condition: BatteryCondition;
  /** Formulation libre conservée telle quelle (ex. « autonomie résistante »). */
  battery_note: string | null;
  price_amount: number | null;
  currency: string;
  status: PcStatus;
  notes: string;
};

export type ImageRow = {
  id: string;
  computer_id: string;
  kind: ImageKind;
  filename: string;
  width: number;
  height: number;
  crop_top: number | null;
  crop_method: CropMethod;
  derived_from: string | null;
  created_at: string;
};

export type GenerationRow = {
  id: string;
  computer_id: string;
  template_id: string;
  template_version: string;
  format: Format;
  filename: string;
  snapshot: Record<string, unknown>;
  status: 'done' | 'error';
  error: string | null;
  created_at: string;
};

export type PublicationRow = {
  id: string;
  computer_id: string;
  generation_id: string | null;
  platform: Platform;
  declared_status: 'published' | 'removed';
  published_at: string;
  link: string | null;
  text_final: string | null;
  created_at: string;
};

export type StatusHistoryRow = {
  id: string;
  computer_id: string;
  from_status: PcStatus | null;
  to_status: PcStatus;
  created_at: string;
};

export type ExtractionRow = {
  id: string;
  computer_id: string;
  image_id: string | null;
  provider: string;
  raw_text: string;
  structured: Record<string, unknown>;
  confidence: Record<string, number>;
  status: 'proposed' | 'accepted' | 'corrected';
  created_at: string;
};

export type Settings = {
  shop_name: string;
  tagline: string;
  phone: string;
  city: string;
  currency: string;
  color_primary: string;
  color_accent: string;
  logo_file: string;
  default_template?: string;
  facebook_page_id?: string;
  facebook_page_access_token?: string;
};

/** Données normalisées passées au moteur de rendu et au service texte. */
export type TemplateData = {
  shopName: string;
  tagline: string;
  phone: string;
  city: string;
  colorPrimary: string;
  colorAccent: string;
  brand: string;
  model: string;
  title: string;
  processor: string;
  ramText: string;
  storageText: string;
  screenText: string;
  graphics: string;
  keyboard: string;
  ports: string[];
  accessories: string[];
  warranty: string;
  battery: string;
  conditionLabel: string;
  priceText: string;
  notes: string;
};

export type ExtractedField = {
  key: string;
  label: string;
  value: string | number | string[] | null;
  confidence: number;
  note?: string;
};
