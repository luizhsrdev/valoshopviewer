import { NativeModule, requireNativeModule } from 'expo';

declare class RiotCookiesModule extends NativeModule<{}> {
  /** Cookies aplicáveis à URL, no formato "a=1; b=2", ou null. */
  getAsync(url: string): Promise<string | null>;
  /** Grava cada string como um cabeçalho Set-Cookie para a URL. */
  setAsync(url: string, cookies: string[]): Promise<void>;
  /** Apaga todos os cookies do app (WebView e fetch). */
  clearAllAsync(): Promise<void>;
}

export default requireNativeModule<RiotCookiesModule>('RiotCookies');
