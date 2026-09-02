import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { useToast } from '../../context/ToastContext';
import { useMultiImageUpload } from '../../lib/useMultiImageUpload';
import { watermarkImage } from '../../lib/watermark';
import { useBackButtonClose } from '../../lib/useBackButtonClose';
import { CameraCapture } from '../common/CameraCapture';
import { X, Image as ImageIcon, Camera, Loader2, Globe, Users } from 'lucide-react';

// Stays mounted at all times (like AuthModal/ProModal/TermsModal) instead
// of being mounted/unmounted by the parent on open/close — React 18
// StrictMode's dev-only mount→cleanup→mount dance on a *freshly mounted*
// component with useBackButtonClose(true, ...) was popping the just-pushed
// history entry an instant after pushing it, closing the modal right as it
// opened. Toggling an always-mounted component's `isOpen` prop doesn't hit
// that path — its effect only starts real work on a later render, never on
// the initial commit that StrictMode double-invokes.
export const CreateStoryModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const { createStory } = useSocial();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const [visibility, setVisibility] = useState('everyone'); // 'everyone' | 'friends'
  const [posting, setPosting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  useBackButtonClose(isOpen, onClose);

  const { images, addFiles, removeImage, reset, isUploading, readyUrls } = useMultiImageUpload(
    'media',
    currentUser?.id,
    { watermark: watermarkImage }
  );

  // Start each opening from a clean slate — otherwise a photo picked (or a
  // visibility choice made) in a previous session would still be sitting
  // here since the component never unmounts between opens now. Camera
  // opens by default (that's the common case for a story); the gallery is
  // one tap away from inside it, or from the fallback picker if the
  // camera gets closed without capturing anything.
  useEffect(() => {
    if (isOpen) {
      reset();
      setVisibility('everyone');
      setCameraOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    // A story only carries one photo — picking again replaces it.
    if (e.target.files[0]) addFiles([e.target.files[0]]);
    e.target.value = '';
  };

  const handleCameraCapture = (files) => {
    setCameraOpen(false);
    if (files[0]) addFiles([files[0]]);
  };

  const handleUseGallery = () => {
    setCameraOpen(false);
    fileInputRef.current?.click();
  };

  const handlePublish = async () => {
    if (readyUrls.length === 0 || isUploading) return;
    setPosting(true);
    const res = await createStory(readyUrls[0], visibility);
    setPosting(false);
    if (!res.success) {
      showToast(res.message, 'error');
      return;
    }
    showToast('Story publicado!', 'success');
    onClose();
  };

  // Portaled straight to <body>, same fix ChatView's mobile sheet uses:
  // rendered inline, this sits inside <main>'s scrollable/nested ancestor
  // chain, which clipped the overlay short of the real screen bottom on
  // mobile (leaving a strip of the app visible underneath). A body-level
  // portal plus 100dvh (not the plain viewport-unit-prone `inset-0` alone)
  // has no such ancestor and sizes to the actual visible viewport.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" style={{ height: '100dvh' }}>
      <div className="relative w-full max-w-sm bg-[var(--c-surface)] border border-rose-500/30 rounded-3xl shadow-2xl p-5 space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--c-text-muted)] hover:text-[var(--c-text)] p-1.5 rounded-full hover:bg-[var(--c-overlay-10)] transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <h3 className="text-sm font-bold text-[var(--c-text)]">Novo Story</h3>
          <p className="text-[10px] text-[var(--c-text-faint)]">Fica visível por 24 horas e depois some sozinho.</p>
        </div>

        {images.length === 0 ? (
          <div className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-[var(--c-border)] flex flex-col items-center justify-center gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl text-[var(--c-text-muted)] hover:text-rose-400 hover:bg-[var(--c-overlay-5)] transition"
              >
                <ImageIcon className="w-7 h-7" />
                <span className="text-xs font-semibold">Galeria</span>
              </button>
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl text-[var(--c-text-muted)] hover:text-rose-400 hover:bg-[var(--c-overlay-5)] transition"
              >
                <Camera className="w-7 h-7" />
                <span className="text-xs font-semibold">Câmera</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-black/40">
            <img src={images[0].previewUrl} alt="Pré-visualização" className="w-full h-full object-cover" />
            {images[0].uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
            {images[0].error && (
              <div className="absolute inset-0 bg-red-950/70 flex items-center justify-center text-xs text-red-200 font-bold">
                Falhou ao enviar
              </div>
            )}
            <button
              type="button"
              onClick={() => removeImage(images[0].id)}
              className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white rounded-full p-1.5 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        <div>
          <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1.5">Quem pode ver</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVisibility('everyone')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition ${
                visibility === 'everyone'
                  ? 'bg-rose-600 border-rose-500 text-white'
                  : 'bg-[var(--c-surface-3)] border-[var(--c-border)] text-[var(--c-text-muted)]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> Todos
            </button>
            <button
              type="button"
              onClick={() => setVisibility('friends')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition ${
                visibility === 'friends'
                  ? 'bg-rose-600 border-rose-500 text-white'
                  : 'bg-[var(--c-surface-3)] border-[var(--c-border)] text-[var(--c-text-muted)]'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Apenas amigos
            </button>
          </div>
        </div>

        <button
          onClick={handlePublish}
          disabled={images.length === 0 || isUploading || posting}
          className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition disabled:opacity-60"
        >
          {posting ? 'Publicando...' : isUploading ? 'Enviando foto...' : 'Publicar Story'}
        </button>
      </div>

      {cameraOpen && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setCameraOpen(false)} onUseGallery={handleUseGallery} />
      )}
    </div>,
    document.body
  );
};
