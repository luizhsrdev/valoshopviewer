/**
 * Comparação e busca de texto em JavaScript puro.
 *
 * Não use `localeCompare(…, 'pt-BR')` nem `normalize()` em listas grandes: no
 * Android, o Hermes implementa essas funções chamando o Java (e o
 * localeCompare com idioma recria o comparador a cada chamada). Ordenar as
 * ~1.400 skins assim travava a thread do JavaScript por minutos.
 */

const ACCENTS: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n',
};

/** Minúsculas e sem acentos: "Vingança" → "vinganca". */
export function fold(text: string): string {
  return text.toLowerCase().replace(/[áàâãäéèêëíìîïóòôõöúùûüçñ]/g, (c) => ACCENTS[c] ?? c);
}

/** Ordem alfabética ignorando acentos e maiúsculas (desempate pelo texto original). */
export function compareText(a: string, b: string): number {
  const fa = fold(a);
  const fb = fold(b);
  if (fa !== fb) return fa < fb ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}
