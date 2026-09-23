#!/usr/bin/env python3
"""
Script de détourage professionnel — rembg + BiRefNet
=====================================================
Usage : python3 remove_bg.py <input_path> <output_path> [model]

Modèles disponibles (par ordre de qualité) :
  birefnet-general        → Meilleur pour photographie produit (défaut)
  birefnet-general-lite   → Plus rapide, qualité légèrement moindre
  isnet-general-use       → Bon pour fond blanc/studio
  u2net                   → Classique, bon pour général

Sortie : PNG transparent (alpha channel) de qualité professionnelle
"""

import sys
import os

def main():
    if len(sys.argv) < 3:
        print("Usage: remove_bg.py <input> <output> [model]", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    model_name = sys.argv[3] if len(sys.argv) > 3 else "birefnet-general"

    if not os.path.exists(input_path):
        print(f"ERREUR: Fichier introuvable : {input_path}", file=sys.stderr)
        sys.exit(2)

    try:
        from rembg import remove, new_session
        from PIL import Image
        import io

        print(f"[rembg] Modèle : {model_name}", flush=True)
        print(f"[rembg] Chargement du modèle (1ère fois = téléchargement)...", flush=True)

        # Créer une session avec le modèle choisi
        session = new_session(model_name)

        print(f"[rembg] Modèle prêt. Traitement de l'image...", flush=True)

        # Ouvrir l'image d'entrée
        with open(input_path, "rb") as f:
            input_data = f.read()

        # Effectuer le détourage
        output_data = remove(
            input_data,
            session=session,
            alpha_matting=True,          # Active le matting alpha avancé (bords plus précis)
            alpha_matting_foreground_threshold=240,  # Seuil premier plan
            alpha_matting_background_threshold=10,   # Seuil arrière-plan
            alpha_matting_erode_size=10,             # Érosion pour bords nets
        )

        # Sauvegarder en PNG transparent
        with open(output_path, "wb") as f:
            f.write(output_data)

        print(f"[rembg] ✅ Détourage réussi → {output_path}", flush=True)
        sys.exit(0)

    except ImportError as e:
        print(f"ERREUR_IMPORT: {e}", file=sys.stderr)
        sys.exit(10)
    except Exception as e:
        print(f"ERREUR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
