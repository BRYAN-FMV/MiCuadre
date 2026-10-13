#!/bin/bash
# ==============================================================================
# MiCuadre POS - Script de Instalacion Nativa para Linux (Ubuntu / Debian / Mint)
# ==============================================================================

set -e

APP_NAME="MiCuadre POS"
APP_URL="https://micuadre.app"
ICON_URL="https://micuadre.app/icon-512.png"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"
ICON_PATH="$ICON_DIR/micuadre.png"
DESKTOP_FILE="$DESKTOP_DIR/micuadre.desktop"

echo "=== Instalando $APP_NAME en Linux ==="

# 1. Crear directorios locales de aplicaciones e iconos
mkdir -p "$DESKTOP_DIR"
mkdir -p "$ICON_DIR"

# 2. Descargar icono oficial de alta resolucion
echo "Configurando icono oficial..."
if command -v curl &> /dev/null; then
    curl -sSL -o "$ICON_PATH" "$ICON_URL"
elif command -v wget &> /dev/null; then
    wget -q -O "$ICON_PATH" "$ICON_URL"
fi

# 3. Detectar navegador web disponible para modo aplicacion
BROWSER_EXEC=""

if command -v google-chrome &> /dev/null; then
    BROWSER_EXEC="google-chrome --app=\"$APP_URL\""
elif command -v google-chrome-stable &> /dev/null; then
    BROWSER_EXEC="google-chrome-stable --app=\"$APP_URL\""
elif command -v chromium &> /dev/null; then
    BROWSER_EXEC="chromium --app=\"$APP_URL\""
elif command -v chromium-browser &> /dev/null; then
    BROWSER_EXEC="chromium-browser --app=\"$APP_URL\""
elif command -v brave-browser &> /dev/null; then
    BROWSER_EXEC="brave-browser --app=\"$APP_URL\""
elif command -v microsoft-edge &> /dev/null; then
    BROWSER_EXEC="microsoft-edge --app=\"$APP_URL\""
elif command -v firefox &> /dev/null; then
    BROWSER_EXEC="firefox --new-window \"$APP_URL\""
else
    BROWSER_EXEC="x-www-browser \"$APP_URL\""
fi

# 4. Crear lanzador de aplicacion .desktop
echo "Creando acceso directo nativo en el sistema..."
cat << EOF > "$DESKTOP_FILE"
[Desktop Entry]
Version=1.0
Type=Application
Name=$APP_NAME
GenericName=Sistema POS & Gestion Comercial
Comment=Punto de Venta POS, Inventario Kardex CPP y Facturacion SAR
Exec=$BROWSER_EXEC
Icon=$ICON_PATH
Terminal=false
Categories=Office;Finance;PointOfSale;
StartupWMClass=micuadre.app
StartupNotify=true
EOF

chmod +x "$DESKTOP_FILE"

# 5. Actualizar cache de aplicaciones del sistema
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

echo "======================================================"
echo "$APP_NAME se ha instalado con exito en tu sistema."
echo "Ya puedes buscar 'MiCuadre POS' en el menu de aplicaciones"
echo "de Ubuntu y anclarlo a tus Favoritos."
echo "======================================================"
