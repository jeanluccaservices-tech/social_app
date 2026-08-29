import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { useToast } from '../../context/ToastContext';
import { useMultiImageUpload } from '../../lib/useMultiImageUpload';
import { watermarkImage } from '../../lib/watermark';
import { Avatar } from '../common/Avatar';
import { CameraCapture } from '../common/CameraCapture';
import { Image, Camera, Send, Sparkles, Loader2, X, ShieldAlert } from 'lucide-react';

export const CreatePost = () => {
  const { currentUser, setIsAuthModalOpen } = useAuth();
  const { createPost } = useSocial();
  const { showToast } = useToast();

  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef(null);

  const { images, addFiles, removeImage, reset, isUploading, readyUrls } = useMultiImageUpload(
    'media',
    currentUser?.id,
    { watermark: watermarkImage }
  );

  const handleFileChange = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const handleCameraCapture = (files) => {
    setCameraOpen(false);
    addFiles(files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!content.trim() && readyUrls.length === 0) return;
    if (isUploading) return;

    setPosting(true);
    // More than one photo becomes one post per photo — the schema has a
    // single media_url per post, not an array/album. The typed text rides
    // along with only the first one so it doesn't repeat N times.
    const urls = readyUrls.length > 0 ? readyUrls : [null];
    let successCount = 0;
    let lastError = null;
    for (let i = 0; i < urls.length; i++) {
      const res = await createPost({
        type: urls[i] ? 'photo' : 'text',
        content: i === 0 ? content : '',
        mediaUrl: urls[i]
      });
      if (res.success) successCount++;
      else lastError = res.message;
    }
    setPosting(false);

    if (successCount === 0) {
      showToast(lastError || 'Não foi possível publicar. Tente novamente.', 'error');
      return;
    }
    showToast(successCount > 1 ? `${successCount} fotos publicadas!` : 'Publicado com sucesso!', 'success');
    setContent('');
    reset();
  };

  if (!currentUser) {
    return (
      <div className="p-4 bg-gradient-to-r from-rose-950/30 to-purple-950/30 border border-rose-500/20 rounded-3xl text-center space-y-3">
        <p className="text-sm font-semibold text-[var(--c-accent)]">Faça login para compartilhar fotos e interagir no feed!</p>
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition"
        >
          Entrar ou Criar Perfil
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-[var(--c-surface)] border border-rose-500/20 rounded-3xl shadow-xl space-y-3">
      <div className="flex items-start gap-3">
        <Avatar
          src={currentUser.avatar}
          alt={currentUser.name}
          isCouple={currentUser.isCouple}
          className="w-10 h-10 rounded-full object-cover ring-2 ring-rose-500/50"
        />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-[var(--c-text)] flex items-center gap-1.5">
              {currentUser.name}
              {currentUser.isCouple && (
                <span className="text-[10px] bg-rose-500/20 text-[var(--c-accent)] border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                  Casal ❤️
                </span>
              )}
            </span>
            {currentUser.isPro && (
              <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" title="Membro VIP" />
            )}
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              currentUser.isCouple
                ? 'O que você e seu amor estão aprontando hoje? Compartilhem no feed...'
                : 'Compartilhe momentos, fotos ou pensamentos...'
            }
            className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-2xl p-3 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500/50 resize-none h-20 transition"
          ></textarea>
        </div>
      </div>

      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {images.map((img) => (
            <div key={img.id} className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-[var(--c-border)]">
              <img src={img.previewUrl} alt="Pré-visualização" className="w-full h-full object-cover" />
              {img.uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
              )}
              {img.error && (
                <div className="absolute inset-0 bg-red-950/70 flex items-center justify-center text-[9px] text-red-200 font-bold text-center p-1">
                  Falhou
                </div>
              )}
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white rounded-full p-0.5 transition"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />

      <p className="flex items-start gap-1.5 text-[9px] leading-relaxed text-[var(--c-text-faint)]">
        <ShieldAlert className="w-3 h-3 flex-shrink-0 mt-0.5" />
        Não são permitidos conteúdos com menores de idade, crimes sexuais, drogas ou outras ilegalidades. Ao publicar, você é o único responsável pelo conteúdo.
      </p>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--c-border-soft)]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-overlay-5)] transition"
          >
            <Image className="w-4 h-4 text-emerald-400" />
            <span>Galeria</span>
          </button>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-overlay-5)] transition"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Câmera</span>
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={posting || isUploading}
          className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition transform hover:scale-105 active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
        >
          {posting || isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>{posting ? 'Publicando...' : isUploading ? 'Enviando fotos...' : 'Publicar'}</span>
        </button>
      </div>

      {cameraOpen && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setCameraOpen(false)} />
      )}
    </div>
  );
};
