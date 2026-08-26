import React from 'react';
import { ShieldAlert, Heart } from 'lucide-react';

const STORAGE_KEY = 'lovevibe_age_verified';

export const isAgeVerified = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const AgeGate = ({ onConfirm }) => {
  const handleConfirm = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // localStorage unavailable (private mode, etc.) — allow through for this session only
    }
    onConfirm();
  };

  const handleDeny = () => {
    window.location.href = 'https://www.google.com';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black text-white">
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-[#15111a] border border-rose-500/30 rounded-3xl shadow-2xl shadow-rose-950/50 p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 shadow-lg shadow-rose-600/40 mb-4">
          <Heart className="w-7 h-7 text-white fill-current" />
        </div>

        <h1 className="font-display text-2xl font-semibold italic tracking-tight mb-2">LoveVibe</h1>

        <div className="flex items-center justify-center gap-1.5 text-amber-400 text-xs font-bold mb-3">
          <ShieldAlert className="w-4 h-4" />
          CONTEÚDO EXCLUSIVO PARA ADULTOS
        </div>

        <p className="text-sm text-gray-300 leading-relaxed mb-6">
          O LoveVibe é uma rede social de relacionamentos destinada exclusivamente a pessoas com
          <strong className="text-white"> 18 anos de idade ou mais</strong>. Ao continuar, você declara
          e confirma que possui a idade mínima exigida para acessar este site.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleConfirm}
            className="w-full py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Tenho 18 anos ou mais — Entrar
          </button>
          <button
            onClick={handleDeny}
            className="w-full py-3 bg-transparent border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 font-semibold rounded-xl transition"
          >
            Sou menor de 18 anos — Sair
          </button>
        </div>

        <p className="text-[10px] text-gray-500 mt-5 leading-relaxed">
          Ao acessar, você também concorda com nossos Termos de Uso e confirma que é o único
          responsável pela veracidade das informações que fornecer neste site.
        </p>
      </div>
    </div>
  );
};
