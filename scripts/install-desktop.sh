#!/usr/bin/env bash

# ==============================================================================
# PC AutoPost — Script d'installation du raccourci dans le menu système Linux
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_DIR}"

APP_NAME="PC AutoPost"
EXEC_PATH="${PROJECT_DIR}/bin/pc-autopost"
ICON_PATH="${PROJECT_DIR}/assets/icon.png"

echo "🎨 Étape 1 : Génération de l'icône HD de l'application..."
node scripts/generate-icon.js

echo "🔑 Étape 2 : Validation des permissions de l'exécutable..."
chmod +x "${EXEC_PATH}"

# Définition des dossiers standards XDG pour l'utilisateur
USER_DESKTOP_DIR="${HOME}/.local/share/applications"
USER_ICON_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"

mkdir -p "${USER_DESKTOP_DIR}"
mkdir -p "${USER_ICON_DIR}"

echo "🖼️ Étape 3 : Installation de l'icône système..."
cp "${ICON_PATH}" "${USER_ICON_DIR}/pc-autopost.png"

DESKTOP_FILE="${USER_DESKTOP_DIR}/pc-autopost.desktop"

echo "📝 Étape 4 : Création du fichier .desktop (${DESKTOP_FILE})..."
cat <<EOF > "${DESKTOP_FILE}"
[Desktop Entry]
Version=1.0
Type=Application
Name=PC AutoPost
GenericName=Gestionnaire & Générateur de Contenu PC
Comment=Génération et gestion de contenus pour vendeurs d'ordinateurs d'occasion
Exec="${EXEC_PATH}"
Path=${PROJECT_DIR}
Icon=pc-autopost
Terminal=false
Categories=Utility;Office;
StartupWMClass=pc-autopost
Keywords=PC;AutoPost;Facebook;Instagram;WhatsApp;Computer;Ordinateur;
EOF

chmod +x "${DESKTOP_FILE}"

echo "🔄 Étape 5 : Actualisation du cache du menu système..."
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${USER_DESKTOP_DIR}" >/dev/null 2>&1 || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" >/dev/null 2>&1 || true
fi

if command -v desktop-file-validate >/dev/null 2>&1; then
  desktop-file-validate "${DESKTOP_FILE}" || true
fi

echo ""
echo "✨ FÉLICITATIONS ! ${APP_NAME} est maintenant installé dans votre menu d'applications système."
echo "👉 Vous pouvez maintenant lancer \"PC AutoPost\" depuis le menu des applications Linux !"
echo "👉 Vous pouvez également utiliser le fichier exécutable : ${EXEC_PATH}"
