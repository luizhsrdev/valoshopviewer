# Minha Loja — documento do projeto

> Documento vivo: tudo sobre o app, o ambiente, as decisões tomadas, ideias arquivadas e ideias futuras.
> Última atualização: 2026-10-29 (preparação do ambiente — o app em si ainda não foi especificado).

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

Requisitos já conhecidos: **notificações** e **tarefas em segundo plano** (por isso usamos development build, não Expo Go — veja a seção 5).

Funcionalidades do app: _a definir nos próximos prompts._

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

Verificações: `expo-doctor` passou nas 20/20 checagens; `expo config` confirma o nome, o package e o scheme corretos nas duas variantes.
Pendência conhecida: `tsc --noEmit` acusa **1 erro em `src/components/app-tabs.web.tsx`**, que vem do próprio template (componente só para web). Deve sumir quando trocarmos as telas de exemplo com `npm run reset-project`.

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

### 6.3 Emulador
O AVD `Pixel_3_API_35` já existe. Sem o Android Studio:
```sh
~/Library/Android/sdk/emulator/emulator -avd Pixel_3_API_35
```
Com o Metro rodando, aperte `a`. Na primeira vez, instale o APK de dev no emulador arrastando o `.apk` para a janela dele (ou com `adb install arquivo.apk`). Para gerenciar AVDs pela interface gráfica, reinstale o Android Studio (`brew install --cask android-studio`), que é opcional.

---

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

### Depreciadas / arquivadas
- **Expo Go** como ambiente de teste: descartado (seção 5).
- **Node 26**: descartado por não ser LTS; trocado pelo Node 24 LTS.
- **Perfil `preview`** (variante intermediária `.preview`): não criado por enquanto. O perfil `apk` cobre a distribuição.
- **AAB / Google Play**: fora do escopo. A distribuição é só por APK.
- **Build local** (`expo run:android`): só como plano B; o padrão é o EAS na nuvem.

### Futuras (a avaliar)
- Definir as funcionalidades da "Minha Loja" (próximos prompts).
- Armazenamento local: `expo-sqlite` (dados relacionais) e/ou `expo-secure-store` (dados sensíveis); backup/exportação manual (arquivo JSON via `expo-sharing`/`expo-file-system`).
- Notificações locais com `expo-notifications` e tarefas periódicas com `expo-background-task`.
- Ícones e splash próprios, separando dev e release (ex.: ícone com selo "DEV" no `app.config.ts`).
- Perfil `preview` se surgir a necessidade de testadores.
- Pequeno fluxo de CI (lint/typecheck) no GitHub Actions.
- Rodar `npm run reset-project` para limpar as telas de exemplo do template.

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

### ⏳ Falta você fazer
- [ ] Rodar o primeiro build de dev: `npx eas-cli@latest build -p android --profile development` (responda **Yes** para gerar a keystore)
- [ ] Instalar o APK no celular e ativar a depuração USB, se for usar cabo
- [ ] `npm run start:dev` e conectar o celular (seção 6.2)
- [ ] (Opcional) Corrigir `JAVA_HOME`/`ANDROID_HOME` no `~/.zshrc` (seção 2)
- [ ] (Opcional) Reinstalar o Android Studio para ter a interface gráfica
- [ ] **GitHub:** o remote `origin` aponta para `luizhsrdev/valoshopviewer`, que hoje está **PÚBLICO** e vazio (e o nome é diferente da pasta, `valshopviewer`). Se quiser privado: `gh repo edit luizhsrdev/valoshopviewer --visibility private --accept-visibility-change-consequences`
- [ ] Decidir sobre o `LICENSE` (MIT) que veio do template, num app privado
- [ ] Primeiro commit, quando você quiser (nada foi commitado)
