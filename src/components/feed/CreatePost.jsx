import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { uploadImage } from '../../lib/storage';
import { Avatar } from '../common/Avatar';
import { Image, Send, Sparkles, Loader2, X } from 'lucide-react';

export const CreatePost = () => {
  const { currentUser, setIsAuthModalOpen } = useAuth();
  const { createPost } = useSocial();

  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setUploading(true);
    try {
      const url = await uploadImage('media', currentUser.id, file);
      setMediaUrl(url);
    } catch {
      // upload failed silently; user can retry
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!content.trim() && !mediaUrl) return;

    setPosting(true);
    await createPost({
      type: mediaUrl ? 'photo' : 'text',
      content,
      mediaUrl
    });
    setPosting(false);

    setContent('');
    setMediaUrl('');
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
              <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" title="Membro PRÓ" />
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

      {mediaUrl && (
        <div className="relative w-full max-h-48 overflow-hidden rounded-xl">
          <img src={mediaUrl} alt="Pré-visualização" className="w-full max-h-48 object-cover" />
          <button
            type="button"
            onClick={() => setMediaUrl('')}
            className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white rounded-full p-1 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--c-border-soft)]">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-overlay-5)] transition disabled:opacity-60"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Image className="w-4 h-4 text-emerald-400" />}
          <span>{uploading ? 'Enviando...' : mediaUrl ? 'Trocar Foto' : 'Adicionar Foto'}</span>
        </button>

        <button
          onClick={handleSubmit}
          disabled={posting}
          className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition transform hover:scale-105 active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
        >
          {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>{posting ? 'Publicando...' : 'Publicar'}</span>
        </button>
      </div>
    </div>
  );
};
