/**
 * `fetch` com mensagem amigável quando a rede falha de verdade (sem
 * internet, DNS não resolve, etc.). Erros HTTP (404, 500...) continuam sendo
 * tratados por quem chama, via `res.ok`/`res.status` — isso aqui só evita que
 * a exceção crua do Android (ex.: "UnknownHostException") chegue na tela.
 */
export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error('Não foi possível conectar. Verifique sua internet e tente de novo.');
  }
}
