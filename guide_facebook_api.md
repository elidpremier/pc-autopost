# 📘 Guide : Configurer l'API Facebook pour PC AutoPost

## Ce dont l'application a besoin

| Champ | Valeur |
|---|---|
| **Page ID** | L'identifiant numérique de ta Page Facebook |
| **Page Access Token** | Un jeton d'accès **permanent** pour la Page (≠ User Token) |

---

## Étape 1 — Ajouter les bonnes permissions

Dans l'**Explorateur de l'API Graph** (que tu as déjà ouvert), clique sur **"Ajouter une autorisation"** et ajoute ces 3 permissions :

| Permission | Rôle |
|---|---|
| `pages_manage_posts` | ✅ **Obligatoire** — publier des photos/posts |
| `pages_read_engagement` | ✅ **Obligatoire** — lire les infos de la page |
| `manage_pages` | ✅ Déjà ajouté — accéder aux pages |

> [!WARNING]
> `manage_pages` seul ne suffit plus depuis l'API Graph v13+. Sans `pages_manage_posts`, la publication échouera avec une erreur de permission.

---

## Étape 2 — Générer le User Access Token

1. Clique sur **"Obtenir le token"** → **"Obtenir le token d'accès utilisateur"**
2. Une fenêtre apparaît → coche les 3 permissions → **Valider**
3. Le token s'affiche dans le champ **"Token d'accès"**

---

## Étape 3 — Trouver ton Page Access Token

Le token généré à l'étape 2 est un **User Token**. Il faut le convertir en **Page Token** :

1. Dans le champ d'URL de l'explorateur, tape :
   ```
   /me/accounts
   ```
2. Clique sur **"Envoyer"** (bouton bleu)
3. Dans le résultat JSON, repère ta Page dans `data[]` :
   ```json
   {
     "data": [
       {
         "access_token": "EAABxx...",   ← C'EST TON PAGE ACCESS TOKEN
         "id": "123456789012345",        ← C'EST TON PAGE ID
         "name": "Nom de ta Page"
       }
     ]
   }
   ```
4. Copie `access_token` et `id`

---

## Étape 4 — Saisir dans PC AutoPost

1. Ouvre l'application → **Réglages**
2. Dans la section Facebook :
   - **Page ID** : colle l'`id` numérique (ex: `123456789012345`)
   - **Page Access Token** : colle l'`access_token` long (commence par `EAABxx...`)
3. Clique sur **"Tester la connexion"** pour vérifier

---

## ⚠️ Durée de vie des tokens

| Type de token | Durée |
|---|---|
| User Token (court) | ~1 heure |
| User Token (long) | ~60 jours |
| **Page Access Token** | **Indéfini** ✅ (si app en mode développement) |

> [!TIP]
> Le **Page Access Token** obtenu via `/me/accounts` dans l'explorateur est **permanent** tant que ton application reste en mode développement et que tu n'as pas modifié les permissions. C'est celui-là qu'il faut utiliser.

---

## Récapitulatif visuel

```
Explorateur Graph → [me/accounts] → Envoyer
                                        ↓
                              data[0].access_token  →  Coller dans "Page Access Token"
                              data[0].id            →  Coller dans "Page ID"
```
