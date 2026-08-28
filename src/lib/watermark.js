// Stamps a small LoveVibe brand bar (heart mark + wordmark + domain) into
// the bottom of a photo before it's uploaded — baked into the file itself
// (not a CSS overlay), so it survives someone saving or screenshotting the
// photo outside the app. Used for feed post photos only.
const BRAND_ROSE = '#e11d48';
const BRAND_PINK = '#ec4899';

const drawHeart = (ctx, cx, cy, size) => {
  const top = size * 0.3;
  ctx.beginPath();
  ctx.moveTo(cx, cy + top);
  ctx.bezierCurveTo(cx, cy, cx - size / 2, cy, cx - size / 2, cy + top);
  ctx.bezierCurveTo(cx - size / 2, cy + (size + top) / 2, cx, cy + (size + top) / 2, cx, cy + size);
  ctx.bezierCurveTo(cx, cy + (size + top) / 2, cx + size / 2, cy + (size + top) / 2, cx + size / 2, cy + top);
  ctx.bezierCurveTo(cx + size / 2, cy, cx, cy, cx, cy + top);
  ctx.closePath();
};

const drawRoundedRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

export const watermarkImage = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);

  img.onload = async () => {
    try {
      try { await document.fonts?.ready; } catch { /* font loading isn't critical */ }

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const barHeight = Math.max(40, Math.round(canvas.height * 0.055));
      const barY = canvas.height - barHeight;

      const fade = ctx.createLinearGradient(0, barY, 0, canvas.height);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, barY, canvas.width, barHeight);

      const badgeSize = barHeight * 0.62;
      const padding = barHeight * 0.3;
      const badgeX = padding;
      const badgeY = canvas.height - barHeight / 2 - badgeSize / 2;

      const badgeGradient = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeSize, badgeY + badgeSize);
      badgeGradient.addColorStop(0, BRAND_ROSE);
      badgeGradient.addColorStop(1, BRAND_PINK);
      ctx.fillStyle = badgeGradient;
      drawRoundedRect(ctx, badgeX, badgeY, badgeSize, badgeSize, badgeSize * 0.28);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      drawHeart(ctx, badgeX + badgeSize / 2, badgeY + badgeSize * 0.26, badgeSize * 0.5);
      ctx.fill();

      const textX = badgeX + badgeSize + padding * 0.7;
      ctx.textBaseline = 'alphabetic';

      ctx.font = `italic 700 ${barHeight * 0.4}px 'Fraunces', Georgia, serif`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText('LoveVibe', textX, canvas.height - barHeight * 0.48);

      ctx.font = `500 ${barHeight * 0.26}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('lovevibe.com.br', textX, canvas.height - barHeight * 0.16);

      // PNG stays PNG (keeps transparency for graphics); everything else
      // becomes JPEG, matching what real camera photos already are.
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error('watermarkImage: canvas.toBlob returned null'));
            return;
          }
          resolve(new File([blob], file.name, { type: blob.type || outputType }));
        },
        outputType,
        outputType === 'image/jpeg' ? 0.92 : undefined
      );
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    }
  };

  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('watermarkImage: failed to load image'));
  };

  img.src = objectUrl;
});
