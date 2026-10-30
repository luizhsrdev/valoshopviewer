package expo.modules.riotcookies

import android.webkit.CookieManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Acesso ao CookieManager do Android, que é compartilhado entre a WebView e o
 * fetch do React Native. Precisamos dele porque os cookies de sessão da Riot
 * (ssid etc.) são HttpOnly e não aparecem para o JavaScript.
 */
class RiotCookiesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RiotCookies")

    // Retorna "nome=valor; nome2=valor2" (sem atributos) ou null.
    AsyncFunction("getAsync") { url: String ->
      CookieManager.getInstance().getCookie(url)
    }.runOnQueue(Queues.MAIN)

    // Cada item é um Set-Cookie completo, ex.: "ssid=...; Path=/; Secure; HttpOnly".
    AsyncFunction("setAsync") { url: String, cookies: List<String>, promise: Promise ->
      val manager = CookieManager.getInstance()
      if (cookies.isEmpty()) {
        promise.resolve(null)
        return@AsyncFunction
      }
      var pending = cookies.size
      for (cookie in cookies) {
        manager.setCookie(url, cookie) {
          pending -= 1
          if (pending == 0) {
            manager.flush()
            promise.resolve(null)
          }
        }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("clearAllAsync") { promise: Promise ->
      val manager = CookieManager.getInstance()
      manager.removeAllCookies {
        manager.flush()
        promise.resolve(null)
      }
    }.runOnQueue(Queues.MAIN)
  }
}
