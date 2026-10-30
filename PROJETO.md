# Minha Loja — documento do projeto

> Documento vivo: tudo sobre o app, o ambiente, as decisões tomadas, ideias arquivadas e ideias futuras.
> Última atualização: 2026-10-29. Fase 1 (loja) e mercado noturno implementados.

---

## 1. Visão geral

| Item | Valor |
|---|---|
| Nome (release) | **Minha Loja** — `com.luiz.minhaloja` |
| Nome (dev) | **Minha Loja (dev)** — `com.luiz.minhaloja.dev` |
| Plataforma | Android (teste no celular físico; emulador opcional) |
| Stack | Expo SDK 58 · React Native 0.88 · React 19.3 · TypeScript 6 · expo-router |
| Distribuição | APK via **EAS Build** + atualizações OTA via **EAS Update** |
| Backend | **Nenhum.** Sem servidor e sem banco remoto: todos os dados ficam no celular |
| Conta Expo | `luizhsnn` — projeto `@luizhsnn/minha-loja` (ID `d92bd695-e76d-4c1d-8618-91cd5c84fd89`) |
| Pasta local | `~/development/GitHub/valshopviewer` |

**Objetivo:** um app Android para mim e alguns amigos vermos a loja do Valorant sem abrir o jogo. Rápido, prático, intuitivo, todo em pt-BR. Distribuição por APK entre amigos (sem Play Store). Não é afiliado à Riot.

**Escopo da fase 1 (tela única, Loja):**
- Boas-vindas com aviso e aceite, guardando a versão do texto aceito. Inclui o aviso de fã da Riot em pt-BR e em inglês.
- Login pela página oficial da Riot numa WebView. O app nunca vê a senha.
- Renovação silenciosa da sessão (cookie `ssid`) e botão "Sair" que apaga tudo.
- Loja: pacote(s) em destaque grande(s), em carrossel quando houver mais de um; grid 2x2 com as 4 ofertas do dia; contagem até a troca; saldo de VP, Radianita e KC; puxar para atualizar; atualização automática; skeleton, estado de erro e cache.

Requisitos técnicos: **notificações** e **tarefas em segundo plano** (por isso usamos development build, não Expo Go — veja a seção 5).

---

## 2. Ambiente (verificado em 2026-10-29)

| Ferramenta | Versão | Obrigatório? | Situação |
|---|---|---|---|
| Node.js | **24.22.2 LTS (Krypton)** | Sim | ✅ Instalado via Homebrew (`node@24`) e ativado |
| npm | 11.19.1 | Sim | ✅ |
| git | 2.56.0 | Sim | ✅ |
| EAS CLI | 27.x via `npx eas-cli@latest` | Sim | ✅ Sem instalação global; logado como `luizhsnn` |
| Java (JDK) | 21 (JetBrains JBR) e 17 (Temurin) | Opcional | ✅ Só para build local (`expo run:android`). ⚠️ veja abaixo |
| Android SDK | platforms 33/34/35, emulador, platform-tools | Opcional | ✅ em `~/Library/Android/sdk` |
| adb | 1.0.41 | Opcional | ✅ |
| AVD (emulador) | `Pixel_3_API_35` | Opcional | ✅ existe |
| Android Studio (app) | — | Opcional | ⚠️ Não encontrado em `/Applications` (o SDK está lá; o app parece ter sido removido) |
| gh (GitHub CLI) | 2.96.0 | Opcional | ✅ |
| Watchman | — | Não | Não instalado; o Metro funciona sem ele |

### Pontos de atenção no ambiente

- **Node 26 → Node 24.** O Node 26.10 que estava ativo ainda não era LTS. Instalei o `node@24` pelo Homebrew. Isso atualizou a biblioteca `simdjson` e **quebrou o Node 26** (erro `Library not loaded: libsimdjson.33.dylib`). Para consertar, desvinculei o `node` (26) e vinculei o `node@24`:
  ```sh
  brew unlink node && brew link --overwrite node@24
  ```
  Para voltar ao 26 algum dia: `brew unlink node@24 && brew reinstall node && brew link node`.
- **`JAVA_HOME` quebrado no `~/.zshrc`.** Ele aponta para `/opt/homebrew/opt/openjdk@11`, que não existe (e o Java 11 é antigo demais para o Gradle do Android). Hoje isso não atrapalha, porque o build roda na nuvem pelo EAS. Se um dia você for compilar localmente, troque as duas linhas por:
  ```sh
  export JAVA_HOME="$HOME/Library/Java/JavaVirtualMachines/jbr-21.0.11/Contents/Home"
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
  ```
- **`ANDROID_HOME` não está definido.** Só é necessário para build local ou para o emulador via CLI (veja o trecho acima).

---

## 3. O que foi feito (log de alterações)

### 2026-10-29 — preparação do ambiente
1. Criei o projeto com `create-expo-app@latest --template default` (TypeScript + expo-router, com as rotas em `src/app/`).
2. Instalei o `expo-dev-client` e o `expo-updates` (com `npx expo install`, que escolhe versões compatíveis com o SDK).
3. **`app.json`**: name `Minha Loja`, slug `minha-loja`, scheme `minhaloja`, `android.package` `com.luiz.minhaloja`, `runtimeVersion: { policy: "appVersion" }`, `updates.url`, `owner` e `extra.eas.projectId` (os três últimos gravados pelo EAS).
4. **`app.config.ts`** (novo): quando `APP_VARIANT=development`, troca o nome para `Minha Loja (dev)`, o package para `com.luiz.minhaloja.dev` e o scheme para `minhaloja-dev`. Assim as duas versões convivem no celular sem conflito de deep link.
5. **`eas.json`** (novo): perfis `development` e `apk` (seção 4).
6. **`package.json`**: name `minha-loja`; novos scripts `start:dev`, `android:dev` e `typecheck`.
7. **`.gitignore`**: acrescentei `.env`, `.env.*` (exceto `.env.example`), `credentials.json`, `credentials/`, `*.keystore`, `google-services.json` e `service-account*.json`. O template já ignorava `*.jks`, `*.p8`, `*.p12`, `*.key`, `*.pem`, `/android` e `/ios`.
8. Gerei o `expo-env.d.ts` (tipos do Expo; ignorado pelo git).
9. **EAS**: rodei `eas init` (criou `@luizhsnn/minha-loja`, com sua autorização) e `eas update:configure --platform android`.
10. **Git**: o repositório já existia (branch `master`, sem commits, remote `origin` → `github.com/luizhsrdev/valoshopviewer`). **Nada foi commitado**, por pedido seu.

### 2026-10-29 — fase 1, etapa 1 (pesquisa + tema)
11. Baixei o `DESIGN.md` (Raycast) de VoltAgent/awesome-design-md para a raiz.
12. Criei o `src/theme/index.ts` (cores, raridade, tipografia, espaço, raios, elevação, brilho, movimento).
13. Instalei a `@expo-google-fonts/inter`.
14. Confirmei o estado atual da API (seção 6.5).

### 2026-10-29 — fase 1 completa + mercado noturno
15. Removi as telas e os componentes de exemplo do template (e o `scripts/reset-project.js`). Com isso sumiu o erro de tipos do template.
16. Instalei `react-native-webview`, `expo-secure-store`, `expo-notifications`, `expo-background-task`, `expo-task-manager`, `@react-native-async-storage/async-storage` e `expo-linear-gradient`. O `npx expo lint` instalou `eslint` e `eslint-config-expo`.
17. Criei o módulo nativo local **`modules/riot-cookies`** (Kotlin, só Android). Ele lê, grava e apaga cookies do `CookieManager`, inclusive os HttpOnly. Substitui a `@react-native-cookies/cookies`, que não é mantida.
18. `app.json`: tudo escuro (splash, fundo, ícone adaptativo), `platforms: ["android"]` e plugins `expo-secure-store`, `expo-notifications` (ícone monocromático, cor `#FF4655`, canal `loja`), `expo-background-task` e `expo-font`.
19. Escrevi as telas de boas-vindas, login, Loja e mercado noturno, e as camadas de sessão, API, catálogo, cache, notificações, tarefa em segundo plano e demo (seção 6.7).
20. **Ainda não testado em aparelho.** O build local de debug foi interrompido: o React Native 0.88 exige o NDK 27.1.12297006 e o compileSdk 37, e o Gradle começou a baixar o NDK sozinho (~2-3 GB) sem autorização. Ficou uma pasta parcial vazia em `~/Library/Android/sdk/ndk/27.1.12297006` (pode ser apagada).

### 2026-10-29 — primeiro teste no celular + ajustes
21. **Testado no celular** (development build do EAS, Metro pelo QR code na mesma rede), em modo demonstração. Boas-vindas, aceite, banner do mercado e revelação uma a uma funcionando. Login real ainda não testado.
22. Pedidos do teste, já atendidos:
    - O verso das cartas agora mostra a cor da raridade antes de revelar, como no jogo.
    - O brilho da revelação estava fora do centro; agora fica centralizado na carta.
    - Removi o ripple do toque do Android, que nascia no ponto tocado.
    - Removi os nomes de raridade (Select, Exclusive etc.) da tela. A cor continua indicando a raridade.
    - **Nova tela de detalhes da skin** (seção 6.9).
24. **Ícone com "X":** em algumas skins (ex.: Guardian Soberania), o `displayIcon` da valorant-api.com é um marcador "X" de arte faltando. Agora a imagem vem do render da primeira variante (`chromas[0].fullRender`), que existe nas 1.391 skins com raridade. A ordem é `fullRender` → ícone do nível 1 → `displayIcon`. O cache do catálogo foi para `content:v3`.
25. Cartas reveladas do mercado redesenhadas no layout do jogo (seção 6.8).
23. Os caches mudaram de formato (`content:v2`, `shop:v2`). As chaves antigas são apagadas sozinhas.

Verificações: `expo-doctor` passou nas 20/20 checagens; `npm run typecheck` e `npm run lint` passam sem erros; o bundle Android compila no Metro.

---

## 4. Perfis do EAS (`eas.json`)

| Perfil | Para quê | Saída | Canal (EAS Update) | Variante |
|---|---|---|---|---|
| `development` | Desenvolvimento diário; carrega o JS do seu Mac via Metro | APK com `expo-dev-client` | `development` | `Minha Loja (dev)` / `.dev` |
| `apk` | Versão final para instalar e distribuir | APK release, `versionCode` auto-incrementado (versão gerenciada no EAS) | `apk` | `Minha Loja` |

- `runtimeVersion` segue a política `appVersion`: um update OTA só chega a APKs com o mesmo `version` (hoje `1.0.0`). **Sempre que mudar algo nativo** (adicionar uma lib nativa, mudar permissões ou plugins), suba o `version` no `app.json` e gere um APK novo.
- Comandos:
  ```sh
  npx eas-cli@latest build -p android --profile development   # build de dev
  npx eas-cli@latest build -p android --profile apk           # APK final
  npx eas-cli@latest update --channel apk --message "texto"   # OTA para quem tem o APK final
  ```
- No primeiro build de cada package, o EAS pergunta se pode **gerar uma keystore Android**. Responda **Yes**: ela fica guardada no EAS, nunca no repositório. Cada package (`.dev` e o final) tem a sua.

---

## 5. Por que não basta o Expo Go

O Expo Go é um app pronto, com um conjunto fixo de módulos nativos e configuração nativa fixa. Para este app isso não serve:

- **Tarefas em segundo plano** (`expo-background-task` / `expo-task-manager`) precisam registrar serviços e workers no Android nativo do *seu* app. No Expo Go isso não funciona, ou funciona de forma limitada, sem dar para confiar.
- **Notificações**: desde o SDK 53, notificações **push** não existem mais no Expo Go para Android. As locais até funcionam, mas os canais, ícones, sons e permissões (`POST_NOTIFICATIONS`, alarmes exatos) dependem do `app.json` e de config plugins, que o Expo Go ignora.
- **Identidade própria**: nome, ícone e package (`com.luiz.minhaloja.dev`) são seus, então as permissões e notificações aparecem como "Minha Loja (dev)" e não como "Expo Go".
- **Fidelidade**: o development build é o mesmo binário nativo da versão final, só que carrega o JS do Metro. O que funciona nele funciona no APK.
- **EAS Update**: dá para testar updates OTA no próprio build.

---

## 6. Rodando no celular

### 6.1 Instalar o development build
1. `npx eas-cli@latest build -p android --profile development` (de 10 a 20 min na nuvem).
2. No final aparecem um **link e um QR code**. Abra no celular, baixe o `.apk` e instale. O Android vai pedir para "permitir instalar apps desta fonte" (Chrome/Arquivos); permita.
3. O ícone **Minha Loja (dev)** aparece no celular. Ele só precisa ser reconstruído quando mudar algo nativo.

### 6.2 Conectar ao servidor de desenvolvimento
Inicie o Metro com a variante dev:
```sh
npm run start:dev
```

**Opção A — mesma rede Wi-Fi (mais simples):** Mac e celular na mesma rede. Abra o Minha Loja (dev): ele lista o servidor encontrado na rede. Se não listar, leia o QR code do terminal com a câmera, ou digite `http://<IP-do-Mac>:8081` (o IP aparece no terminal). Redes de empresa ou hotel com "isolamento de clientes" bloqueiam isso; nesse caso, use USB ou `npm run start:dev -- --tunnel`.

**Opção B — cabo USB com adb (mais estável):**
1. No celular: Configurações → Sobre o telefone → toque 7× em "Número da versão" → Opções do desenvolvedor → ative a **Depuração USB**.
2. Conecte o cabo e aceite a chave RSA no celular.
3. No Mac: `adb devices` (o aparelho deve aparecer como `device`).
4. `adb reverse tcp:8081 tcp:8081` (o `localhost:8081` do celular passa a ser o Mac).
5. No app dev, conecte em `http://localhost:8081`, ou aperte `a` no terminal do Metro.

**Erro "Unable to load script" (2026-10-29):** o app instalou e abriu, mas não alcançou o Metro. Diagnóstico no Mac:
- O Metro não estava rodando.
- O Mac está na rede pela `en6` (cabo, IP `192.168.3.236`), então o celular precisa estar no Wi-Fi da mesma rede `192.168.3.x`.
- Firewall desligado, sem VPN. Com o Metro de pé, ele responde em `http://192.168.3.236:8081/status` e o bundle Android compila sem erros (HTTP 200).

Para resolver: deixe o `npm run start:dev` aberto no terminal e conecte digitando a URL no app. Se ainda falhar, use `--tunnel` ou o cabo USB com `adb reverse`.

### 6.3 Emulador
O AVD `Pixel_3_API_35` já existe. Sem o Android Studio:
```sh
~/Library/Android/sdk/emulator/emulator -avd Pixel_3_API_35
```
Com o Metro rodando, aperte `a`. Na primeira vez, instale o APK de dev no emulador arrastando o `.apk` para a janela dele (ou com `adb install arquivo.apk`). Para gerenciar AVDs pela interface gráfica, reinstale o Android Studio (`brew install --cask android-studio`), que é opcional.

---

## 6.5 API — estado confirmado em 2026-10-29

A documentação de referência mudou de endereço. `valapidocs.techchair.io` não resolve mais (DNS). A atual é **https://valapidocs.techchrism.me**, mas o repositório dela não recebe commits desde abril de 2024, então confirmei o comportamento atual por testes diretos e por apps da comunidade que estão ativos em 2026.

| Etapa | Endpoint | Situação |
|---|---|---|
| Login | WebView em `https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid` | ✅ Funciona. Sem cookie, responde **303** para `authenticate.riotgames.com/login` (o doc antigo dizia 301). Depois do login, redireciona para `playvalorant.com/opt_in#access_token=…&id_token=…&expires_in=3600` |
| Reautenticação | O mesmo `GET /authorize`, enviando os cookies | ✅ Em uso em set./out. de 2026. Só com `ssid`, dura cerca de 1 semana; com todos os cookies de auth (`ssid`, `clid`, `csid`, `tdid`, `sub`), cerca de 3 semanas. **A Riot rotaciona os cookies a cada reauth, então é preciso salvar os novos.** O `ssid` é HttpOnly |
| Entitlements | `POST https://entitlements.auth.riotgames.com/api/token/v1` (Bearer, body `{}`) | ✅ Inalterado |
| Userinfo | `GET https://auth.riotgames.com/userinfo` (Bearer) → `sub` = PUUID, `acct.game_name`/`tag_line` | ✅ Inalterado. O PUUID também sai do `sub` do JWT |
| Riot-geo | `PUT https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant`, body `{id_token}`, Bearer → `affinities.live` | ✅ Responde (401 sem token). Para BR, `live` = `br`, mas o **shard é `na`** (mapear `br`/`latam` → `na`) |
| Loja | **`POST https://pd.{shard}.a.pvp.net/store/v3/storefront/{puuid}`**, body `{}` | ⚠️ **Mudou:** a v2 (GET) da documentação foi substituída pela v3 (POST). A resposta mantém `FeaturedBundle`, `SkinsPanelLayout` (`SingleItemStoreOffers[].Cost`), `BonusStore?` e `AccessoryStore` |
| Carteira | `GET https://pd.{shard}.a.pvp.net/store/v1/wallet/{puuid}` → `Balances` | ✅ Inalterado |

Cabeçalhos dos endpoints `pd.*`: `Authorization: Bearer`, `X-Riot-Entitlements-JWT`, `X-Riot-ClientVersion` (= `riotClientVersion` de `valorant-api.com/v1/version`, hoje `release-13.09-shipping-11-5777412`) e `X-Riot-ClientPlatform` (JSON de plataforma PC em base64).

IDs das moedas: VP `85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741` · Radianita `e59aa87c-4cbf-517a-5983-6e81511be9b7` · Kingdom Credits `85ca954a-41f2-ce94-9b45-8ca3dd39a00d`.

Dados estáticos (valorant-api.com): `/v1/version`, `/v1/contenttiers`, `/v1/weapons/skins` (a oferta usa o UUID de `levels[0]`), `/v1/bundles`, `/v1/currencies`.

**Plano para a renovação da sessão (a validar no development build):** no Android, o `fetch` do React Native usa o mesmo cookie jar da WebView (CookieManager). O plano:
1. Depois do login, ler os cookies de `auth.riotgames.com` com `@react-native-cookies/cookies`, que enxerga HttpOnly, e salvar no `expo-secure-store`.
2. Na renovação (inclusive em segundo plano), restaurar os cookies no jar e chamar `/authorize`.
3. Ler o token na URL final e salvar os cookies rotacionados.

Se o `fetch` perder o fragmento `#access_token` ao seguir o redirect, o plano B é uma WebView invisível (só em primeiro plano). Se a renovação falhar, o app volta para o login.

## 6.6 Tema

O arquivo é `src/theme/index.ts`, traduzido do `DESIGN.md` do Raycast (que está na raiz do projeto). A prévia visual está em https://claude.ai/artifact/D6rRMPsdswa91z4L3KAYfm (privada).
- Só modo escuro, com a escada de superfícies `#07080A → #0D0D0D → #101111 → #121212`, borda hairline `#242728` e nenhuma sombra.
- Acento único `#FF4655`: contagem regressiva, indicador do carrossel e botão de login/aceite. O botão primário comum continua branco, como no Raycast.
- Raridade (contenttiers): Select `#5A9FE2`, Deluxe `#009587`, Premium `#D1548D`, Exclusive `#F5955B`, Ultra `#FAD663`. No card, vira borda de 1px a 55% e brilho de 16px a 18%.
- Fonte Inter (`@expo-google-fonts/inter`), sem o `ss03`, que o RN não suporta no Android. Números com `tabular-nums`.
- Nenhum logo, fonte ou arte da Riot. As únicas imagens são de skins e pacotes da valorant-api.com, e as moedas aparecem como texto (VP/RAD/KC).

## 6.7 Arquitetura do app

```
src/
  app/                    rotas (expo-router)
    _layout.tsx           fontes, splash, providers, rotas protegidas, deep link da notificação
    boas-vindas.tsx       aviso + aceite (versão do texto em lib/consent.ts)
    login.tsx             WebView oficial da Riot; botão de demo só em dev
    index.tsx             Loja (tela principal)
    mercado.tsx           mercado noturno (tela separada)
  components/             UI (text, button, countdown, skeleton, store/*, night-market/*)
  lib/
    riot/                 constants, types, session (tokens/cookies/reauth), api (storefront v3, wallet)
    content.ts            catálogo valorant-api.com (pt-BR), cache compacto por versão do jogo
    shop.ts               modelo da loja + cache
    night-market.ts       cartas reveladas + "já avisei deste mercado"
    notifications.ts      canal, permissão, aviso do mercado (data.url = /mercado)
    background.ts         tarefa periódica (30 min, WorkManager)
    demo.ts               loja falsa (somente __DEV__)
    consent.ts, format.ts, storage.ts
  providers/              session (estado de login) e shop (dados, refresh, timers)
  theme/                  tokens do tema
modules/riot-cookies/     módulo nativo Kotlin (CookieManager)
```

**Fluxo de sessão:**
1. O app abre e confere o aceite. Se a versão aceita for antiga, mostra as boas-vindas.
2. Sem sessão salva, vai para o login.
3. No login, a WebView da Riot redireciona para `playvalorant.com/opt_in#access_token=…`. O app intercepta esse redirecionamento, pega os entitlements, a conta (userinfo) e o shard (riot-geo), e copia os cookies do CookieManager para o SecureStore.
4. Nas aberturas seguintes, o `fetch` vai em `/authorize`: o cookie jar do Android é o mesmo da WebView, e a URL final traz os tokens. Depois de cada renovação, os cookies rotacionados são salvos de novo.
5. Se a renovação cair no login da Riot, a sessão é apagada e o app volta para o login com o aviso "Sua sessão expirou". Falta de internet **não** desloga.
6. **Sair** apaga cookies (SecureStore e CookieManager), conta, cache, cartas e a tarefa em segundo plano.
- Tokens só em memória. Nada de `console.log` com token, cookie ou URL de redirecionamento.

**Loja:** abre na hora com o cache (AsyncStorage) e atualiza por trás. Também atualiza ao puxar a tela, quando qualquer contagem zera (diária, pacote ou mercado) e ao voltar para o primeiro plano depois de uma troca. O skeleton aparece só sem cache. Com cache e erro, aparece uma faixa "Mostrando a loja das HH:MM" com "Tentar de novo".

## 6.8 Mercado noturno

- **Nunca** aparece na tela da loja. Na loja fica só o banner "Mercado noturno disponível" com o tempo restante, que abre a rota `/mercado`.
- **Notificação:** a tarefa em segundo plano (a cada ~30 min) e o refresh em primeiro plano detectam o `BonusStore`. Cada mercado é avisado uma vez, identificado pelos IDs das ofertas. Em primeiro plano não notifica, porque o banner já aparece. Ao tocar, `data.url = "/mercado"` abre a tela direto, inclusive com o app fechado.
- **Cartas:** são 6. O verso é uma **grade de losangos** (~80 por carta) na cor da raridade, escurecida, com linhas finas entre eles. Por cima, enfeites próprios: dois losangos concêntricos. Tudo desenhado no app, sem arte da Riot. Como no jogo, a cor da raridade já aparece antes de revelar.
- **Revelação (a pedido, fiel ao jogo; substituiu o flip 3D)**, em `card-back.tsx`. Um único relógio por carta (0 → 1 em 1,45 s) move todos os losangos na thread de UI:
  1. **0–140 ms:** os enfeites somem.
  2. **0–360 ms, o X sai na frente:** os losangos das diagonais (|Δi| = |Δj| a partir do central) acendem do centro às pontas. **Os vizinhos não esperam o X terminar.** Cada um sobe um tom quando o X passa pelo seu anel e acende logo depois (70 ms + 70 ms por losango de distância do X). Aos ~300 ms, o X chega às bordas com o miolo já aceso, como no jogo. Tudo aceso por volta de 670 ms. A borda acende junto.
  3. **~560–920 ms:** clarão branco quando a carta inteira acende. O pico vai de 6% (Select) a 34% (Ultra).
  4. **740–1450 ms:** os losangos somem e encolhem do centro para os cantos. A capa **não tem fundo próprio** (os losangos se sobrepõem 6% e cobrem tudo), então a skin, já pronta por baixo, aparece no primeiro losango que some. O selo de desconto entra aos ~1190 ms e o preço final aos ~1290 ms.
- **Fluidez:**
  - Os losangos animados são preparados 350 ms depois que a tela abre, uma carta a cada 90 ms. O toque só dispara o relógio.
  - Cada losango é uma base fixa mais uma camada clara por cima, e só se animam **opacidade e escala**. A cor não é mais interpolada a cada quadro, o que custava caro com ~80 losangos.
  - A capa é desmontada quando termina.
  - O modo de desenvolvimento é mais lento; o APK final fica mais fluido.
- A dica "Toque nas cartas para revelar · 2 de 6" fica no cabeçalho, no lugar do contador, e não mais em cada carta.
- **Carta revelada, no layout do jogo:**
  - Fundo em degradê na cor da raridade, com dois anéis sutis.
  - **Arma inclinada a 55°** (cano para cima, à esquerda), **no centro da carta**, onde a capa abre o buraco, e o maior possível sem encostar no texto.
  - **Desconto em vermelho** (`#FF4655`) no canto superior esquerdo, com a ponta cortada em diagonal.
  - **Preço final e preço original riscado** no canto superior direito ("VP" em texto, sem o ícone oficial).
  - **Nome em caixa-alta, centralizado embaixo**, sem a barra escura.
  - Sem o nome da raridade. Tocar na carta abre os detalhes da skin.
- **Persistência:** os `BonusOfferID` revelados ficam no AsyncStorage com o `endsAt` do mercado e expiram com ele. Ao reabrir, as cartas já reveladas aparecem sem animação.
- **"Remover animações"** do Android (`useReducedMotion`): revela na hora, sem losangos nem clarão, e os skeletons e o banner param de pulsar.
- As imagens são pré-carregadas (`Image.prefetch`) ao abrir a tela, para a revelação não esperar a rede.
- **Modo demonstração (só `__DEV__`):** botão "Entrar no modo demonstração (dev)" no login, mais o painel "Ferramentas de desenvolvimento" no fim da loja. O painel tem: ligar/desligar a demo, gerar um novo mercado, abrir/fechar o mercado, resetar as cartas, notificação em 5 s (para testar o deep link) e rodar a tarefa em segundo plano. A demo usa skins reais do catálogo, uma de cada raridade mais uma extra, e não toca na API da Riot.

## 6.9 Detalhes da skin

- Abre ao tocar num card da loja diária ou numa carta revelada do mercado. Fica na rota `/skin/[id]`, num modal que sobe de baixo. O preço vem da tela de origem (no mercado: preço final, original riscado e desconto).
- Os dados são baixados sob demanda de `valorant-api.com/v1/weapons/skins/{uuid}?language=pt-BR` e guardados em memória.
- **Imagem grande com zoom:** pinça até 4x, arrastar quando ampliada e toque duplo para 2,5x. O fundo leva um gradiente na cor da raridade.
- **Variantes (chromas):** miniaturas que trocam a imagem, mais o botão "Ver vídeo" quando a variante tem vídeo.
- **Níveis:** "Nível N · o que desbloqueia", com os rótulos traduzidos (efeitos visuais, animação, efeitos sonoros, finalização, banner de abate…). Tocar abre o vídeo de demonstração do nível.
- **Vídeos (player próprio):** a WebView serve só de superfície: um `<video>` sem controles, que conversa com o app por mensagens (`video-surface.tsx`). Toda a interface é em React Native, no tema do app:
  - play/pausa central;
  - barra de progresso arrastável na cor da raridade, mostrando também a parte já carregada;
  - tempo atual e duração com números tabulares;
  - botão de som;
  - "carregando" e "não foi possível tocar · Tentar de novo";
  - controles que somem após 2,5 s tocando e voltam ao toque.
- **Tela cheia:** gira o player em 90° num modal, sem barra de status e continuando do mesmo ponto. O app é travado em retrato, e girar a tela de verdade exigiria o `expo-screen-orientation`, que é nativo. O botão voltar do Android sai da tela cheia.
- Os ícones são desenhados com Views (`player-icons.tsx`), sem fonte de ícones nem SVG, para não exigir build novo.
- Com "Remover animações" ativo, os controles aparecem e somem sem fade.
- Os pacotes ainda não abrem detalhes, porque os itens do pacote não são guardados no modelo.

## 7. Regras do projeto

- Instalar dependências **sempre** com `npx expo install <pacote>`.
- Não criar nem editar `android/` e `ios/` à mão (CNG): configurar pelo `app.json`/`app.config.ts` e por plugins.
- Nunca versionar `.env`, keystores, `credentials.json` ou chaves de service account. Segredos ficam nas variáveis de ambiente do EAS (`eas env:create`).
- Antes de concluir uma tarefa: `npm run lint` e `npm run typecheck`.
- Dados apenas locais. Nada sai do aparelho sem decisão explícita.

---

## 8. Ideias e decisões

### Adotadas
- Development build (`expo-dev-client`) em vez do Expo Go (seção 5).
- Duas variantes com package diferente via `APP_VARIANT`.
- `runtimeVersion` com política `appVersion`.
- `appVersionSource: remote` + `autoIncrement` no perfil `apk`.
- EAS CLI via `npx eas-cli@latest`, sem instalação global.

- Storefront **v3 (POST)** no lugar da v2.
- Mapear `br`/`latam` → shard `na`.
- Tema Raycast + acento `#FF4655` + raridade como destaque.
- Módulo nativo próprio (`modules/riot-cookies`) para ler e gravar os cookies HttpOnly.
- Reautenticação por `fetch` no `/authorize`, usando o cookie jar compartilhado com a WebView. Se o `fetch` perder o fragmento, o plano B é a própria tela de login, que passa sozinha quando o cookie é válido.
- Estado (sessão, loja) com Context simples, sem biblioteca de estado.
- Mercado noturno numa rota própria (`/mercado`), com deep link pela notificação.
- Cache do catálogo compacto (~400 KB), por causa do limite por item do AsyncStorage no Android.
- Verso da carta na cor da raridade (fiel ao jogo).
- Raridade só pela cor, sem o nome.
- Vídeos de skin pela WebView (sem build nativo novo).

### Depreciadas / arquivadas
- **Storefront v2 (GET)**: substituída pela v3.
- **Login com usuário e senha via API (`PUT /api/v1/authorization`)**: descartado. É inseguro e hoje é bloqueado por captcha. O login é pela WebView oficial.
- **Ícones oficiais das moedas e fontes da Riot**: descartados por regra de marca. As moedas aparecem como texto.
- **ss03 da Inter**: sem suporte no RN Android.
- **Expo Go** como ambiente de teste: descartado (seção 5).
- **Node 26**: descartado por não ser LTS; trocado pelo Node 24 LTS.
- **Perfil `preview`** (variante intermediária `.preview`): não criado por enquanto. O perfil `apk` cobre a distribuição.
- **AAB / Google Play**: fora do escopo. A distribuição é só por APK.
- **Build local** (`expo run:android`): usado só para testar no emulador; a distribuição continua pelo EAS na nuvem.
- **`@react-native-cookies/cookies`**: sem manutenção desde 2022 e sem garantia na New Architecture. Trocado pelo módulo local.
- **`backfaceVisibility` no flip**: instável no Android. Trocado pela troca de opacidade em 90°.
- **Flip 3D + brilho circular na revelação**: substituídos pela capa de losangos que acende e se desfaz, como no jogo (a pedido).
- **Verso com moldura e cantos marcados**: substituído pela grade de losangos.
- **X totalmente formado antes dos demais (com pausa)**: lento demais. Agora os vizinhos começam logo atrás do X.
- **Interpolar a cor de cada losango a cada quadro**: causava engasgos. Trocado por uma camada clara com opacidade.
- **"TOQUE PARA REVELAR" em cada carta**: movido para o cabeçalho.
- **Controles padrão do `<video>` da WebView**: descartados, porque destoavam do app. Trocados por controles próprios.
- **Brilho com `boxShadow` animado**: pesado demais para 60 fps. Trocado por círculos concêntricos com transform/opacity.
- **Mercado noturno na mesma tela da loja**: proibido por regra do produto. Só o banner.
- **Telas de exemplo do template (tabs, explore)**: removidas.
- **Verso neutro, sem cor**: trocado pelo verso na cor da raridade, a pedido, porque o jogo mostra a cor antes de revelar.
- **Rótulos com o nome da raridade** (SELECT, EXCLUSIVE…) nos cards: removidos a pedido.
- **Ripple do Android nas cartas**: removido (nascia no ponto tocado, parecia descentralizado).

### Futuras (a avaliar)
- Loja de acessórios (`AccessoryStore`): os dados já vêm na v3.
- Lista de desejos + notificação quando uma skin desejada aparecer na loja diária.
- Notificação opcional na troca da loja diária (21:00 de Brasília).
- Botão "Revelar todas" no mercado.
- Trocar a superfície da WebView pelo `expo-video` (exige build novo), mantendo os controles próprios: decodificação nativa, PiP e cache de vídeo. Junto, o `expo-screen-orientation` para uma tela cheia com rotação de verdade.
- Detalhes do pacote (lista das skins do pacote, cada uma abrindo a tela de detalhes).
- Toque leve (haptics) na revelação, mais forte para Exclusive e Ultra.
- Aviso de "otimização de bateria" para a tarefa em segundo plano em celulares agressivos (Xiaomi, Samsung).
- Ícones e splash próprios, separando dev e release (ex.: ícone com selo "DEV" no `app.config.ts`).
- Perfil `preview` se surgir a necessidade de testadores.
- Pequeno fluxo de CI (lint/typecheck) no GitHub Actions.

---

## 9. Checklist

### ✅ Pronto
- [x] Node 24 LTS ativo, npm, git, adb, SDK Android e AVD conferidos
- [x] Projeto Expo (TS + expo-router) criado, `expo-doctor` 20/20
- [x] `expo-dev-client` e `expo-updates` instalados
- [x] Variantes dev/release configuradas (nome, package, scheme)
- [x] `eas.json` com os perfis `development` e `apk` e seus canais
- [x] `.gitignore` reforçado para segredos
- [x] Logado no Expo (`luizhsnn`); projeto EAS criado e vinculado; EAS Update configurado
- [x] Tema, boas-vindas, login, Loja, mercado noturno, notificação com deep link, tarefa em segundo plano e modo demo

### ⏳ Falta você fazer
- [ ] Rodar o primeiro build de dev: `npx eas-cli@latest build -p android --profile development` (responda **Yes** para gerar a keystore)
- [ ] Instalar o APK no celular e ativar a depuração USB, se for usar cabo
- [ ] `npm run start:dev` e conectar o celular (seção 6.2)
- [ ] (Opcional) Corrigir `JAVA_HOME`/`ANDROID_HOME` no `~/.zshrc` (seção 2)
- [ ] (Opcional) Reinstalar o Android Studio para ter a interface gráfica
- [ ] **GitHub:** o remote `origin` aponta para `luizhsrdev/valoshopviewer`, que hoje está **PÚBLICO** e vazio (e o nome é diferente da pasta, `valshopviewer`). Se quiser privado: `gh repo edit luizhsrdev/valoshopviewer --visibility private --accept-visibility-change-consequences`
- [ ] Decidir sobre o `LICENSE` (MIT) que veio do template, num app privado
- [ ] Testar o login real com sua conta no celular (a reautenticação por cookie só se confirma com uma conta de verdade)
- [ ] Commits: você faz quando quiser (eu não commito)
