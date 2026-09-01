import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { useToast } from '../../context/ToastContext';
import { useMultiImageUpload } from '../../lib/useMultiImageUpload';
import { watermarkImage } from '../../lib/watermark';
import { Avatar } from '../common/Avatar';
import { CameraCapture } from '../common/CameraCapture';
import { Image, Camera, Send, Sparkles, Loader2, X, ShieldAlert, BarChart3, Plus } from 'lucide-react';

const MAX_POLL_OPTIONS = 4;

export const CreatePost = () => {
  const { currentUser, setIsAuthModalOpen } = useAuth();
  const { createPost, createPoll } = useSocial();
  const { showToast } = useToast();

  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef(null);

  const [pollMode, setPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);

  const { images, addFiles, removeImage, reset, isUploading, readyUrls } = useMultiImageUpload(
    'media',
    currentUser?.id,
    { watermark: watermarkImage }
  );

  const handleFileChange = (e) => {
    // A poll post only has one media_url, so at most one photo makes
    // sense there — picking a new one while in poll mode replaces
    // whatever was attached instead of adding a second.
    if (pollMode) {
      if (e.target.files[0]) {
        reset();
        addFiles([e.target.files[0]]);
      }
    } else {
      addFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleCameraCapture = (files) => {
    setCameraOpen(false);
    if (pollMode) {
      if (files[0]) {
        reset();
        addFiles([files[0]]);
      }
    } else {
      addFiles(files);
    }
  };

  const togglePollMode = () => {
    setPollMode(prev => {
      const next = !prev;
      // A poll post only carries one media_url — trim down to the first
      // photo if more than one was already attached before switching in.
      if (next && images.length > 1) {
        images.slice(1).forEach(img => removeImage(img.id));
      }
      return next;
    });
    setPollOptions(['', '']);
  };

  const updatePollOption = (index, value) => {
    setPollOptions(prev => prev.map((o, i) => (i === index ? value : o)));
  };

  const addPollOption = () => {
    setPollOptions(prev => (prev.length >= MAX_POLL_OPTIONS ? prev : [...prev, '']));
  };

  const removePollOption = (index) => {
    setPollOptions(prev => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }

    if (pollMode) {
      if (!content.trim()) return;
      if (isUploading) return;
      setPosting(true);
      const res = await createPoll(content, pollOptions, readyUrls[0] || null);
      setPosting(false);
      if (!res.success) {
        showToast(res.message, 'error');
        return;
      }
      showToast('Enquete publicada!', 'success');
      setContent('');
      setPollMode(false);
      setPollOptions(['', '']);
      reset();
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
              pollMode
                ? 'Faça sua pergunta...'
                : currentUser.isCouple
                  ? 'O que você e seu amor estão aprontando hoje? Compartilhem no feed...'
                  : 'Compartilhe momentos, fotos ou pensamentos...'
            }
            className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-2xl p-3 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500/50 resize-none h-20 transition"
          ></textarea>

          {pollMode && (
            <div className="space-y-1.5 mt-2">
              {pollOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updatePollOption(index, e.target.value)}
                    placeholder={`Opção ${index + 1}`}
                    className="flex-1 bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl px-3 py-2 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500/50"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removePollOption(index)}
                      className="p-1.5 text-[var(--c-text-faint)] hover:text-red-400 rounded-lg transition flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < MAX_POLL_OPTIONS && (
                <button
                  type="button"
                  onClick={addPollOption}
                  className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar opção
                </button>
              )}
              <p className="text-[10px] text-[var(--c-text-faint)]">Enquete de escolha única e voto anônimo.</p>
            </div>
          )}
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

      <input ref={fileInputRef} type="file" accept="image/*" multiple={!pollMode} className="hidden" onChange={handleFileChange} />

      <p className="flex items-start gap-1.5 text-[9px] leading-relaxed text-[var(--c-text-faint)]">
        <ShieldAlert className="w-3 h-3 flex-shrink-0 mt-0.5" />
        Não são permitidos conteúdos com menores de idade, crimes sexuais, drogas, venda de conteúdos ou outras ilegalidades. Ao publicar, você é o único responsável pelo conteúdo.
      </p>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--c-border-soft)]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title={pollMode ? 'Anexar uma foto à enquete' : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-overlay-5)] transition"
          >
            <Image className="w-4 h-4 text-emerald-400" />
            <span>Galeria</span>
          </button>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            title={pollMode ? 'Anexar uma foto à enquete' : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-overlay-5)] transition"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Câmera</span>
          </button>
          <button
            type="button"
            onClick={togglePollMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              pollMode ? 'bg-rose-500/15 text-rose-400' : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-overlay-5)]'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <span>Enquete</span>
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
