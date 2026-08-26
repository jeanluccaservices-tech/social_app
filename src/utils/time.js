export const timeAgo = (dateInput) => {
  const date = new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Agora mesmo';
  if (diffMin < 60) return `Há ${diffMin} min`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Há ${diffH} ${diffH === 1 ? 'hora' : 'horas'}`;

  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Ontem';
  if (diffD < 7) return `Há ${diffD} dias`;

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatClockTime = (dateInput) =>
  new Date(dateInput).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const formatJoinedDate = (dateInput) => {
  const s = new Date(dateInput).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const formatFullDate = (dateInput) =>
  new Date(dateInput).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatFullDateTime = (dateInput) =>
  new Date(dateInput).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
