import { useRef, useState } from 'react';
import { uploadImage } from './storage';

// Backs every "add one or more photos" flow (feed composer, direct chat,
// group chat): shows an instant local preview per file while it uploads
// in the background, so picking/capturing several photos in a row doesn't
// block on each one finishing before the next preview appears.
export const useMultiImageUpload = (bucket, userId, { watermark } = {}) => {
  const [images, setImages] = useState([]); // { id, previewUrl, url, uploading, error }
  const imagesRef = useRef(images);
  imagesRef.current = images;

  const addFiles = (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;

    const entries = list.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      previewUrl: URL.createObjectURL(file),
      url: null,
      uploading: true,
      error: false
    }));
    setImages((prev) => [...prev, ...entries]);

    entries.forEach(async (entry, i) => {
      const file = list[i];
      try {
        let toUpload = file;
        if (watermark) {
          try {
            toUpload = await watermark(file);
          } catch {
            // watermarking failed — upload the original photo rather than blocking
          }
        }
        const url = await uploadImage(bucket, userId, toUpload);
        setImages((prev) => prev.map((img) => (img.id === entry.id ? { ...img, url, uploading: false } : img)));
      } catch {
        setImages((prev) => prev.map((img) => (img.id === entry.id ? { ...img, uploading: false, error: true } : img)));
      }
    });
  };

  const removeImage = (id) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  };

  const reset = () => {
    imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
  };

  const isUploading = images.some((img) => img.uploading);
  const readyUrls = images.filter((img) => img.url && !img.error).map((img) => img.url);

  return { images, addFiles, removeImage, reset, isUploading, readyUrls };
};
