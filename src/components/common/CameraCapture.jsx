import React, { useEffect, useRef, useState } from 'react';
import { X, Camera as CameraIcon, Check, Trash2, AlertTriangle, Loader2, Image as ImageIcon } from 'lucide-react';

// Full-screen in-app camera (not the OS camera app) so we can offer a
// camera picker when the device has more than one, and let someone shoot
// several photos in a row before handing them all back at once. Built with
// getUserMedia rather than <input capture> — a native capture input only
// ever returns a single photo per invocation and can't list cameras.
//
// `onUseGallery` is optional — pass it to also show a "Galeria" escape
// hatch in the top bar for a flow that opens straight into the camera but
// still lets someone bail out to picking a file instead (e.g. stories).
// Callers that don't pass it (the regular post/chat composers) are
// unaffected.
export const CameraCapture = ({ onCapture, onClose, onUseGallery }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState(null);
  const [captured, setCaptured] = useState([]); // { id, blob, previewUrl }
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startStream = async (targetDeviceId) => {
    setStarting(true);
    setError('');
    stopStream();
    try {
      const constraints = {
        video: targetDeviceId
          ? { deviceId: { exact: targetDeviceId } }
          : { facingMode: { ideal: 'environment' } },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      // Camera labels are only populated once permission has actually
      // been granted, so the device list is (re-)read after the first
      // successful stream rather than before.
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list.filter((d) => d.kind === 'videoinput');
      setDevices(cams);
      const activeId = stream.getVideoTracks()[0]?.getSettings()?.deviceId;
      if (activeId) setDeviceId(activeId);
    } catch (err) {
      setError(
        err?.name === 'NotAllowedError'
          ? 'Permissão da câmera negada. Habilite o acesso à câmera nas configurações do navegador.'
          : err?.name === 'NotFoundError'
          ? 'Nenhuma câmera encontrada neste dispositivo.'
          : 'Não foi possível abrir a câmera. Tente novamente.'
      );
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    startStream(null);
    return () => {
      stopStream();
      captured.forEach((c) => URL.revokeObjectURL(c.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSwitchCamera = (id) => {
    if (id === deviceId) return;
    setDeviceId(id);
    startStream(id);
  };

  const handleShoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setCaptured((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, blob, previewUrl: URL.createObjectURL(blob) }]);
    }, 'image/jpeg', 0.92);
  };

  const handleRemoveCaptured = (id) => {
    setCaptured((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((c) => c.id !== id);
    });
  };

  const handleFinish = () => {
    if (captured.length === 0) return;
    const files = captured.map((c, i) => new File([c.blob], `camera-${Date.now()}-${i}.jpg`, { type: 'image/jpeg' }));
    stopStream();
    onCapture(files);
  };

  const handleClose = () => {
    stopStream();
    captured.forEach((c) => URL.revokeObjectURL(c.previewUrl));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col" style={{ height: '100dvh' }}>
      {/* Live preview */}
      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-400" />
            <p className="text-sm text-white font-semibold max-w-xs">{error}</p>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        )}

        {starting && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-2">
            <button onClick={handleClose} className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition">
              <X className="w-5 h-5" />
            </button>
            {onUseGallery && (
              <button
                onClick={() => { stopStream(); onUseGallery(); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/40 text-white text-xs font-semibold hover:bg-black/60 transition"
              >
                <ImageIcon className="w-4 h-4" /> Galeria
              </button>
            )}
          </div>

          {devices.length > 1 && (
            <select
              value={deviceId || ''}
              onChange={(e) => handleSwitchCamera(e.target.value)}
              className="bg-black/40 text-white text-xs font-semibold rounded-xl px-3 py-2 border border-white/20 max-w-[55%]"
            >
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId} className="text-black">
                  {d.label || `Câmera ${i + 1}`}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Bottom bar: captured thumbnails + shutter + done */}
      <div className="bg-black/90 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 flex flex-col gap-3">
        {captured.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 scrollbar-none">
            {captured.map((c) => (
              <div key={c.id} className="relative flex-shrink-0">
                <img src={c.previewUrl} alt="Foto capturada" className="w-14 h-14 rounded-lg object-cover border border-white/20" />
                <button
                  onClick={() => handleRemoveCaptured(c.id)}
                  className="absolute -top-1.5 -right-1.5 bg-black/80 hover:bg-black text-white rounded-full p-0.5 transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-6 px-4">
          <div className="w-14 h-14 flex items-center justify-center">
            {captured.length > 0 && (
              <span className="text-white text-xs font-bold">{captured.length}</span>
            )}
          </div>

          <button
            onClick={handleShoot}
            disabled={!!error || starting}
            title="Tirar foto"
            className="w-16 h-16 rounded-full bg-white border-4 border-white/40 disabled:opacity-40 transition active:scale-95 flex items-center justify-center"
          >
            <CameraIcon className="w-6 h-6 text-black" />
          </button>

          <button
            onClick={handleFinish}
            disabled={captured.length === 0}
            title="Concluir"
            className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 disabled:bg-white/10 disabled:opacity-40 text-white flex items-center justify-center transition"
          >
            <Check className="w-6 h-6" />
          </button>
        </div>

        <p className="text-center text-[11px] text-white/60">
          {captured.length > 0 ? `${captured.length} foto${captured.length > 1 ? 's' : ''} — toque em ✓ para usar` : 'Toque para tirar uma ou mais fotos'}
        </p>
      </div>
    </div>
  );
};
