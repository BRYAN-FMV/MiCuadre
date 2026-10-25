/**
 * Client-side utility for compressing business logo images to lightweight WebP data URLs.
 * Converts large user images (e.g. 5MB mobile photos) into ~15-25 KB WebP images (max 256x256px).
 */

export const getDataUrlSizeKb = (dataUrl: string): number => {
  if (!dataUrl) return 0;
  const base64Index = dataUrl.indexOf(',');
  const base64Str = base64Index >= 0 ? dataUrl.slice(base64Index + 1) : dataUrl;
  const bytes = (base64Str.length * 3) / 4;
  return Math.round((bytes / 1024) * 10) / 10;
};

export const compressImageToWebP = (
  file: File,
  maxDimension: number = 240,
  quality: number = 0.75
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo seleccionado no es una imagen válida.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo inicializar el contexto de imagen.'));
          return;
        }

        // Fill solid white background so transparent logos don't produce black boxes on thermal receipt printers
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // Try exporting to WebP data URL, fallback to JPEG if unsupported
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('Error al decodificar la imagen.'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsDataURL(file);
  });
};
