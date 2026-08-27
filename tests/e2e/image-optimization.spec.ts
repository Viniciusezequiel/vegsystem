import { expect, test } from '@playwright/test';

test('normalização continua bloqueando Base64, blob e URL externa', async ({ page }, testInfo) => {
  test.skip(!String(testInfo.project.use.baseURL).includes('127.0.0.1'), 'Teste técnico executado contra o frontend local.');
  await page.goto('/admin-auth');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/lib/lostItemImageValue.ts';
    const { normalizeLostItemImagePath, getDeletableLostItemImagePath } = await import(/* @vite-ignore */ modulePath);
    const rejected = ['data:image/png;base64,AAAA', 'blob:https://example.test/id', 'https://external.test/image.jpg']
      .map(value => {
        try { normalizeLostItemImagePath(value); return false; } catch { return true; }
      });
    return {
      rejected,
      purePath: normalizeLostItemImagePath('legacy/foto antiga.jpg'),
      oldStorageUrl: normalizeLostItemImagePath('https://old.supabase.co/storage/v1/object/public/lost-items/legacy/foto.webp'),
      unsafeDeletePath: getDeletableLostItemImagePath('../fora.webp'),
    };
  });
  expect(result.rejected).toEqual([true, true, true]);
  expect(result.purePath).toBe('legacy/foto antiga.jpg');
  expect(result.oldStorageUrl).toBe('legacy/foto.webp');
  expect(result.unsafeDeletePath).toBeNull();
});

test('imagem grande é redimensionada e convertida sem ampliação', async ({ page }, testInfo) => {
  test.skip(!String(testInfo.project.use.baseURL).includes('127.0.0.1'), 'Teste técnico executado contra o frontend local.');
  await page.goto('/admin-auth');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/lib/optimizeImage.ts';
    const { optimizeImage } = await import(/* @vite-ignore */ modulePath);
    const canvas = document.createElement('canvas');
    canvas.width = 3200;
    canvas.height = 2400;
    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#173f5f');
    gradient.addColorStop(0.5, '#ed553b');
    gradient.addColorStop(1, '#3caea3');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 2500; index += 1) {
      context.fillStyle = `hsla(${index % 360},70%,60%,0.35)`;
      context.fillRect((index * 97) % 3200, (index * 53) % 2400, 35, 35);
    }
    const originalBlob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('blob')), 'image/png'));
    const optimized = await optimizeImage(new File([originalBlob], 'large.png', { type: 'image/png' }));
    const bitmap = await createImageBitmap(optimized);
    const metrics = {
      originalBytes: originalBlob.size,
      finalBytes: optimized.size,
      originalWidth: 3200,
      originalHeight: 2400,
      finalWidth: bitmap.width,
      finalHeight: bitmap.height,
      finalType: optimized.type,
    };
    bitmap.close();
    return metrics;
  });
  expect(result.finalType).toBe('image/webp');
  expect(Math.max(result.finalWidth, result.finalHeight)).toBe(1600);
  expect(result.finalBytes).toBeLessThan(result.originalBytes);
  testInfo.annotations.push({ type: 'compression', description: JSON.stringify(result) });
});

test('fotografia de alta entropia mantém proporção e registra redução realista', async ({ page }, testInfo) => {
  test.skip(!String(testInfo.project.use.baseURL).includes('127.0.0.1'), 'Teste técnico executado contra o frontend local.');
  await page.goto('/admin-auth');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/lib/optimizeImage.ts';
    const { optimizeImage } = await import(/* @vite-ignore */ modulePath);
    const width = 2400;
    const height = 1800;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d')!;
    const pixels = context.createImageData(width, height);
    let seed = 0x5eed1234;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const light = 45 + 120 * (1 - y / height);
        const landscape = 55 * Math.sin(x / 115) + 35 * Math.cos((x + y) / 83);
        const sensorNoise = (random() - 0.5) * 70;
        pixels.data[offset] = Math.max(0, Math.min(255, light + landscape + sensorNoise));
        pixels.data[offset + 1] = Math.max(0, Math.min(255, light + 35 + landscape * 0.45 + sensorNoise));
        pixels.data[offset + 2] = Math.max(0, Math.min(255, 170 - light * 0.35 + landscape * 0.2 + sensorNoise));
        pixels.data[offset + 3] = 255;
      }
    }
    context.putImageData(pixels, 0, 0);
    const originalBlob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('blob')), 'image/png'));
    const optimized = await optimizeImage(new File([originalBlob], 'high-entropy.png', { type: 'image/png' }));
    const bitmap = await createImageBitmap(optimized);
    const metrics = {
      originalBytes: originalBlob.size,
      finalBytes: optimized.size,
      originalWidth: width,
      originalHeight: height,
      finalWidth: bitmap.width,
      finalHeight: bitmap.height,
      finalType: optimized.type,
    };
    bitmap.close();
    return metrics;
  });
  expect(result.finalType).toBe('image/webp');
  expect(result.finalWidth).toBe(1600);
  expect(result.finalHeight).toBe(1200);
  expect(result.finalBytes).toBeLessThan(result.originalBytes);
  testInfo.annotations.push({ type: 'realistic-compression', description: JSON.stringify(result) });
});
