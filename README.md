# PC AutoPost — MVP v1

Application web pour vendeurs d'ordinateurs d'occasion / reconditionnés.
Elle transforme une **photo-fiche** (fiche technique en haut + photo du PC en bas) en :

- une **photo produit nettoyée** (zone de texte retirée par recadrage déterministe, jamais de retouche IA),
- une **fiche technique structurée** (OCR local + parsing, chaque valeur avec son niveau de confiance),
- des **visuels prêts à publier** (carré 1080×1080, portrait 1080×1350, story 1080×1920, fiche détaillée),
- des **textes de publication** Facebook / Instagram / WhatsApp.

> Principe directeur (spec §10.3, §22.4) : **aucune donnée n'est utilisée avant confirmation humaine.**
> Les valeurs OCR sont badgeées « OCR » et deviennent « confirmées » dès qu'elles sont modifiées.

## Lancer en local

```bash
# 1) Installer les dépendances — INDISPENSABLE
#    (sinon : « sh: 1: next: not found »)
npm install

# 2) Mode développement
npm run dev        # http://localhost:3000

# — ou mode production —
npm run build
npm start
```

Données : SQLite dans `data/pc-autopost.sqlite`, fichiers dans `uploads/` (originales, nettoyées, secondaires, générés, logos). Aucun service externe requis.

### Problèmes fréquents

| Symptôme | Cause | Solution |
|---|---|---|
| `sh: 1: next: not found` | `node_modules` absent (non inclus dans les archives de téléchargement) | `npm install` |
| Erreur binaire SWC / better-sqlite3 | Node.js très récent non pré-testé | Node 20 LTS : `nvm install 20 && nvm use 20` |
| Port 3000 occupé | Autre serveur | `npx next dev -p 3001` |
| `EADDRINUSE` au `npm start` | Processus déjà lancé | Arrêter l'ancien, ou `npm run dev` |

Un contrôle d'environnement (`scripts/check-env.js`) s'exécute automatiquement avant `dev`/`build`/`start` et affiche la solution correspondante.

### Scripts utilitaires

| Commande | Rôle |
|---|---|
| `npm run make-sample` | Reconstruit la photo-fiche d'exemple (`samples/fiche_example.jpg`) |
| `npm run seed` | Crée un produit d'exemple complet (Dell Latitude 5420) dans la base |
| `npm run test-pipeline` | Teste le pipeline complet : OCR → parsing → recadrage → rendu 4 formats → textes |

## Import sans saisie manuelle (texte standard / JSON)

L'OCR des photos réelles peut être imparfait. La méthode de référence est donc le
**copier-coller d'un format standard** : toute la fiche est importée d'un coup,
détectée automatiquement (JSON ou texte), sans ressaisie.

### Texte standard (recommandé)

```text
MARQUE : Dell
MODELE : Latitude 5420
PROCESSEUR : Intel Core i5-1145G7
RAM : 16 Go
STOCKAGE : 512 Go SSD
ECRAN : 14 pouces Full HD
GRAPHIQUE : Intel Iris Xe
CLAVIER : AZERTY rétroéclairé
PORTS : USB, RJ45, HDMI, USB-C
BATTERIE : autonomie résistante
ACCESSOIRES : sac, chargeur, souris
GARANTIE : 3 mois
PRIX : 250000 FCFA
ETAT : Bon état
STATUT : Disponible
```

Lignes optionnelles : `GRAPHIQUE`, `CLAVIER`, `PORTS`, `BATTERIE`, `ACCESSOIRES`,
`GARANTIE`, `PRIX`, `ETAT`, `STATUT`. Les libellés tolèrent les variantes
(`PROC`/`CPU`, `DISQUE`, `MÉMOIRE`, `AUTONOMIE`, `ECRAN` avec ou sans accent…).

### JSON standard

```json
{
  "marque": "Dell",
  "modele": "Latitude 5420",
  "processeur": "Intel Core i5-1145G7",
  "ram_go": 16,
  "stockage": { "go": 512, "type": "SSD" },
  "ecran": { "pouces": 14, "resolution": "Full HD" },
  "graphique": "Intel Iris Xe",
  "clavier": "AZERTY rétroéclairé",
  "ports": ["USB", "RJ45", "HDMI", "USB-C"],
  "batterie": "autonomie résistante",
  "accessoires": ["sac", "chargeur", "souris"],
  "garantie": "3 mois",
  "prix": 250000,
  "devise": "FCFA",
  "etat": "Bon état",
  "statut": "Disponible"
}
```

`stockage` accepte aussi `"512 Go SSD"` (string), `ecran` aussi `"14 pouces Full HD"`.
Les clés anglaises (`brand`, `model`, `processor`, `price`…) sont acceptées.

### Extraction par IA (optionnelle)

Si `PC_AUTOPOST_LLM_API_KEY` est définie (`.env.local`, API compatible OpenAI — voir
`.env.example`), le texte collé est d'abord structuré par le LLM, puis validé par le
parseur local. Sans clé : parseur local déterministe, aucune dépendance externe.

## Parcours principal

1. **Stock** (`/`) : liste des produits, statuts, filtres, recherche, alerte « à républier » (disponible depuis ≥ 7 j).
2. **Ajouter un ordinateur** (`/computers/new`) : fiche de base (marque, modèle, prix, devise, état).
3. **Espace produit** (`/computers/[id]`) :
   - **Importer la fiche** : texte standard ou JSON copier-collé (modèles copiables en un clic),
     texte libre/OCR accepté — toutes les caractéristiques (marque → statut) remplies d'un coup,
     récapitulatif des valeurs importées, badge « IMPORT »/« OCR » sur chaque champ.
   - **Photos** : téléversement de la photo-fiche, **ligne de séparation déplaçable** sur l'aperçu,
     recadrage appliqué (l'original est toujours conservé), photo secondaire, extraction OCR
     en complément (badge « OCR »).
   - **Caractéristiques & prix** : tous les champs, contrôle de complétude en temps réel
     (la génération est bloquée tant qu'un champ obligatoire manque).
   - **Génération** : sélection des formats, rendu déterministe (template Professionnel v2 —
  photo entière visible, jamais recadrée), aperçus,
     **téléchargement** des images, **copie** des textes, déclaration de publication.
   - **Historique** : générations (template versionné + snapshot des données),
     extractions (texte brut conservé), changements de statut horodatés.
4. **Boutique** (`/settings`) : nom, slogan, téléphone, ville, devise, couleurs, logo.

## Règles métier implémentées (spec §8, §15)

- Champs obligatoires avant génération : marque, modèle, processeur (ou « Non renseigné »),
  RAM, stockage, état général, prix > 0, devise.
- Statuts : disponible / réservé / vendu / archivé — changements historisés.
- Le passage à « vendu » retire le produit des suggestions de republication.
- Images : types JPEG/PNG/WebP, 15 Mo max ; l'original n'est jamais écrasé
  (le recadrage stocke `crop_top` + méthode et est reproductible).
- La fiche détaillée masque automatiquement les zones dont les données sont absentes.
- Formulations ambigües (ex. « autonomie résistante ») conservées telles quelles (`battery_note`),
  jamais normalisées en promesse technique.
- Rendu déterministe : même fiche + même template + mêmes photos = même image
  (chaque génération conserve template version + snapshot JSON des données d'entrée).

## Architecture

```
app/
  page.tsx                      # Tableau de bord (stock)
  computers/new/page.tsx        # Création rapide d'une fiche
  computers/[id]/page.tsx       # Espace produit (édition + génération)
  settings/page.tsx             # Paramètres boutique
  api/
    computers/…                 # CRUD + images + extract + re-crop + generate
    generations/…               # aperçu + téléchargement
    images/[id]                 # service des fichiers
    publications/…              # déclarations de publication
    settings/…                  # paramètres + logo
components/workspace/           # UI du space produit (client)
lib/
  db.ts                         # SQLite (better-sqlite3) + repositories
  services/
    image-service.ts            # sharp : sauvegarde, recadrage déterministe, zones
    ocr-service.ts              # Tesseract.js (eng+fra), optionnel, temps limité
    spec-parser.ts              # texte brut → champs structurés + confiances
    generation-service.ts       # templates SVG + rendu sharp (4 formats)
    text-service.ts             # textes FB / IG / WhatsApp (données validées uniquement)
scripts/                        # make-sample, seed, test-pipeline
```

Stack : **Next.js 14 (TypeScript) + Tailwind + SQLite + sharp + Tesseract.js**.
Conforme aux recommandations du document de cadrage : SQLite acceptable pour le prototype ;
les services `image-preprocessor`, `region-detector`, `ocr-extractor` et `spec-normalizer`
(spécification §22.8) correspondent à `image-service`, `CropSlider` + `re-crop`,
`ocr-service` et `spec-parser`.

## Hors périmètre MVP (roadmap)

- Publication automatique via API officielles (Phase 5) — la v1 est en **publication assistée** :
  l'app prépare fichiers + textes, la publication reste manuelle.
- Détection automatique de la bordure (le MVP utilise le gabarit ajustable + validation).
- Templates multiples, statistiques, gestion clients, marketplace, estimation de prix.
- Authentification : à prévoir avant tout déploiement multi-utilisateurs (spec §14).

## Notes techniques

- Tesseract.js télécharge ses modèles au premier OCR (quelques Mo, mis en cache).
  Si le téléchargement échoue, l'application bascule sur la saisie de texte manuelle :
  le cœur du produit reste 100 % fonctionnel hors OCR.
- Les visuels sont générés côté serveur : fond `sharp` + photos recadrées en « cover »
  (ratio préservé, pas de déformation) + calque de texte SVG (polices système DejaVu).
- Port par défaut : **3000** (`npm run dev` / `npm start`, host `0.0.0.0`).
