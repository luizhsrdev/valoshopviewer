const number = new Intl.NumberFormat('pt-BR');

export const formatNumber = (n: number) => number.format(n);

const pad = (n: number) => String(n).padStart(2, '0');

/** "07:42:19" (abaixo de 1 dia) ou "3d 06h". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${pad(h)}h`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function formatTime(epoch: number): string {
  return new Date(epoch).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** "31/10/26" (dia/mês/ano com 2 dígitos), no fuso do celular. Sem Intl, de propósito. */
export function formatDate(epoch: number): string {
  const d = new Date(epoch);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${pad(d.getFullYear() % 100)}`;
}
