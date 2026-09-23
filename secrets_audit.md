# Audit des Secrets GitHub — Conflits & Résolution ✅ Résolu

## Situation Finale

Le dépôt gère désormais en toute autonomie **deux domaines d'activité** isolés sur le même projet GitHub :

| Domaine | Workflow de veille | Workflow de publication | Fichier Config | Onglets Google Sheet | Canaux Telegram |
|---|---|---|---|---|---|
| **GALENIA** (Sciences Pharmaceutiques) | `veille.yml` | `publish.yml` (Step 1) | `config/domain.json` | `Veille` / `Queue` | `CHANNEL_2_ID`, `CHANNEL_3_ID` |
| **Marchés Publics** (DGCMEF BF) | `veille_marches_publics.yml` | `publish.yml` (Step 2) | `config/marches_publics.json` | `Veille_MP` / `Queue_MP` | `TELEGRAM_CHANNEL_PRIVE_ID`, `TELEGRAM_CHANNEL_PUBLIC_ID` |

---

## Solutions Appliquées

### 1. 🛡️ Isolation des Onglets Google Sheet (Gestion du `SHEET_ID` partagé)
- **Problem** : Un seul secret `SHEET_ID` partagé risquait de mélanger les publications pharmaceutiques et les avis marchés publics.
- **Solution** : `fetch_veille.py` et `publish.py` dérivent automatiquement le nom des onglets depuis la configuration :
  - Domaine GALENIA → Onglets `Veille` et `Queue`
  - Domaine DGCMEF → Onglets `Veille_MP` et `Queue_MP`
- **Résultat** : Un seul Google Sheet requis, sans risque de collision ni de doublon.

### 2. 📢 Routage des Canaux Telegram & Publication Unifiée
- **Workflow `publish.yml`** exécute à la suite :
  1. La publication des articles GALENIA sur `CHANNEL_2_ID` / `CHANNEL_3_ID`.
  2. La publication des avis Marchés Publics sur `TELEGRAM_CHANNEL_PRIVE_ID` (fiches complètes) et `TELEGRAM_CHANNEL_PUBLIC_ID` (teasers).
- **Fallback intelligent** : Si `TELEGRAM_CHANNEL_PUBLIC_ID` n'est pas défini, `publish.py` redirige automatiquement les teasers publics sur le canal privé.

---

## Répertoire Complet des Secrets GitHub à Configurer

### Secrets Commun / Partagés (Obligatoires)
- `SHEET_ID` : L'ID de la feuille Google Sheet partagée.
- `GOOGLE_SERVICE_ACCOUNT_JSON` : Clé JSON du Compte de Service Google avec accès éditeur.
- `GEMINI_API_KEY` : Clé API Google Gemini (utilisée par les 2 domaines).

### Secrets Spécifiques — Domaine GALENIA (Sciences Pharmaceutiques)
- `TELEGRAM_BOT_TOKEN` : Bot Telegram principal.
- `CHANNEL_2_ID` : ID du canal Telegram principal GALENIA.
- `CHANNEL_3_ID` : (Optionnel) ID du canal secondaire GALENIA.
- `FACEBOOK_PAGE_ID` & `FACEBOOK_PAGE_ACCESS_TOKEN` : Accès Page Facebook GALENIA.

### Secrets Spécifiques — Domaine Marchés Publics (DGCMEF BF)
- `TELEGRAM_CHANNEL_PRIVE_ID` : ID du canal Telegram Privé / VIP (fiches complètes avec montants).
- `TELEGRAM_CHANNEL_PUBLIC_ID` : (Optionnel) ID du canal Telegram Public (teasers masqués). Si absent = canal privé.
- `SOURCE_BULLETIN_URL` : (Optionnel) URL spécifique de téléchargement du PDF DGCMEF.

---

## Validation des Tests Unitaires
- **20/20 tests** dans `test_marches_publics_engine.py` validés avec succès.
