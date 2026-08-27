const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIDE = 1600;
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.84;

type DecodedImage = CanvasImageSource & { width: number; height: number; close?: () => void };

async function decodeImage(file: File): Promise<DecodedImage> {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
      element.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export function optimizedImageExtension(type: string) {
  return type === 'image/webp' ? 'webp' : 'jpg';
}

/** Optimizes a new photo before upload. Existing stored images are never touched. */
export async function optimizeImage(file: File): Promise<File> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Formato inválido. Envie uma imagem JPEG, PNG ou WebP.');
  }

  const source = await decodeImage(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Não foi possível preparar a imagem para envio.');

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY);
    if (!blob || blob.type !== 'image/webp') {
      const jpegCanvas = document.createElement('canvas');
      jpegCanvas.width = width;
      jpegCanvas.height = height;
      const jpegContext = jpegCanvas.getContext('2d');
      if (!jpegContext) throw new Error('Não foi possível preparar a imagem para envio.');
      jpegContext.fillStyle = '#ffffff';
      jpegContext.fillRect(0, 0, width, height);
      jpegContext.drawImage(canvas, 0, 0);
      blob = await canvasToBlob(jpegCanvas, 'image/jpeg', JPEG_QUALITY);
    }

    if (!blob) throw new Error('Não foi possível otimizar a imagem selecionada.');
    const basename = file.name.replace(/\.[^.]+$/, '') || 'imagem';
    return new File([blob], `${basename}.${optimizedImageExtension(blob.type)}`, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } finally {
    source.close?.();
  }
}
