/**
 * client/src/lib/resizeImage.js
 * 
 * Robust client-side image resizing utility:
 * - Resizes image so its longest edge is <= maxDimension (default 1024px)
 * - Encodes to JPEG at quality (default 0.8)
 * - Returns:
 *   - blob: Resized JPEG Blob ready for multipart upload
 *   - previewUrl: Object URL or data URL for rendering preview in UI
 *   - thumbnail: 200px thumbnail data URL for lightweight local storage
 * - Strictly handles decoding, canvas drawing, and export errors
 */

export async function resizeImage(file, maxDimension = 1024, quality = 0.8) {
  if (!file) {
    throw new Error('No file provided for resizing.');
  }

  // Basic MIME check on client
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image. Please choose a JPEG, PNG, or WebP photo.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read the selected photo. The file may be unreadable or corrupt.'));
    };

    reader.onload = (readerEvent) => {
      const img = new Image();

      img.onerror = () => {
        reject(new Error('Failed to decode the image. Please try another photo format (JPEG, PNG, WebP).'));
      };

      img.onload = () => {
        try {
          const originWidth = img.naturalWidth || img.width;
          const originHeight = img.naturalHeight || img.height;

          if (!originWidth || !originHeight) {
            return reject(new Error('Image has invalid dimensions.'));
          }

          // Calculate scaled dimensions for maxDimension
          let targetWidth = originWidth;
          let targetHeight = originHeight;

          if (originWidth > maxDimension || originHeight > maxDimension) {
            if (originWidth > originHeight) {
              targetWidth = maxDimension;
              targetHeight = Math.round((originHeight / originWidth) * maxDimension);
            } else {
              targetHeight = maxDimension;
              targetWidth = Math.round((originWidth / originHeight) * maxDimension);
            }
          }

          // 1. Draw scaled main image
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            return reject(new Error('Could not initialize browser graphics context for image processing.'));
          }

          // Fill background with dark tone in case of transparent PNG
          ctx.fillStyle = '#111827';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // 2. Export main resized JPEG blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return reject(new Error('Failed to compress and export resized image.'));
              }

              // Check 4MB backend boundary safety
              if (blob.size > 4 * 1024 * 1024) {
                return reject(new Error(`Resized image size (${(blob.size / (1024 * 1024)).toFixed(1)} MB) exceeds 4 MB server limit.`));
              }

              // 3. Create small ~200px thumbnail
              let thumbWidth = 200;
              let thumbHeight = Math.round((targetHeight / targetWidth) * 200);
              const thumbCanvas = document.createElement('canvas');
              thumbCanvas.width = thumbWidth;
              thumbCanvas.height = thumbHeight;
              const thumbCtx = thumbCanvas.getContext('2d');
              thumbCtx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight);
              const thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);

              const previewUrl = URL.createObjectURL(blob);

              resolve({
                blob,
                previewUrl,
                thumbnail: thumbnailDataUrl,
                width: targetWidth,
                height: targetHeight,
                sizeBytes: blob.size
              });
            },
            'image/jpeg',
            quality
          );
        } catch (err) {
          reject(new Error(`Image resizing process failed: ${err.message}`));
        }
      };

      img.src = readerEvent.target.result;
    };

    reader.readAsDataURL(file);
  });
}
