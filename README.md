# Minha Loja

App Android para ver a loja do Valorant sem abrir o jogo: ofertas do dia, pacotes, mercado noturno, lista de desejos e avisos quando a loja troca. Distribuído por APK, sem Play Store e sem servidor: os dados ficam no celular de cada pessoa.

> Projeto de fã, sem fins comerciais. **Minha Loja não é endossado pela Riot Games** e usa uma API não oficial do jogo. Use por sua conta e risco.

Detalhes técnicos, decisões e histórico estão no [`PROJETO.md`](PROJETO.md).

---

## Gerar o APK

Os builds rodam na nuvem do EAS; o Mac não precisa de Android Studio nem de JDK.

```sh
npx eas-cli@latest build -p android --profile apk
```

- No primeiro build, responda **Yes** quando o EAS perguntar se pode gerar uma keystore. Ela fica guardada no EAS, nunca no repositório. **Não apague essa keystore**: sem ela, um APK novo não instala por cima do antigo.
- No fim, o EAS mostra um **link e um QR code** do APK. É esse link que vai para os amigos.
- O `versionCode` sobe sozinho a cada build (`autoIncrement`).

Para o app de desenvolvimento ("Minha Loja (dev)"), troque o perfil: `--profile development`.

## Publicar uma atualização (sem reinstalar)

Correções que mexem **só no JavaScript** (telas, textos, lógica, imagens em `assets/`) chegam pelo próprio app:

```sh
npx eas-cli@latest update --channel production --message "o que mudou"
```

- O app **checa ao abrir** e baixa a atualização em segundo plano; ela é **aplicada na próxima abertura**.
- Em **Configurações › Sobre** aparece a data da atualização em uso.

### Quando é obrigatório um APK novo?

O app usa `runtimeVersion` com a política **`fingerprint`**: uma impressão digital de tudo que é nativo (bibliotecas nativas, `app.json`/`app.config.ts`, ícone, splash, permissões, o módulo `modules/riot-cookies`). Uma atualização só chega a APKs com a **mesma** impressão digital.

| Mudou | O que fazer |
|---|---|
| Código em `src/`, imagens usadas pelas telas | `eas update` |
| `npx expo install` de uma biblioteca **nativa** (ou atualização do Expo SDK) | **APK novo** |
| `app.json` / `app.config.ts`, ícone, splash, permissões, plugins | **APK novo** |
| Código em `modules/riot-cookies` | **APK novo** |

Na dúvida, compare a impressão digital antes e depois da mudança:

```sh
npx expo-updates runtimeversion:resolve --platform android
```

Se o valor mudou desde o último APK, gere um APK novo. Se publicar um `eas update` mesmo assim, ele simplesmente não chega aos APKs antigos (não quebra nada).

## Desenvolvimento

```sh
npm install
npm run start:dev      # Metro para o app "Minha Loja (dev)"
npm run lint && npm run typecheck
```

Conecte o celular pela mesma rede Wi-Fi (QR code do terminal) ou por USB (`adb reverse tcp:8081 tcp:8081`). No app de desenvolvimento há um **modo demonstração** (loja falsa, sem conta) e um painel de ferramentas no fim da loja.

---

## Guia para os amigos

Mande o link do APK junto com este texto:

> **Como instalar o Minha Loja**
>
> 1. **Baixe o APK** pelo link que eu te mandei (abra no Chrome do celular).
> 2. **Permita a instalação:** ao abrir o arquivo, o Android avisa que a instalação de fontes desconhecidas está bloqueada. Toque em **Configurações** e ative **"Permitir desta fonte"** para o Chrome (ou para o app de Arquivos). Depois volte e toque em **Instalar**.
>    - Se aparecer o **Play Protect** dizendo que o app não é conhecido, toque em **Mais detalhes › Instalar mesmo assim**. É normal para apps fora da Play Store.
> 3. **Abra o Minha Loja** e leia o aviso: o app não é da Riot e usa uma API não oficial (o risco é seu). Marque a caixa e toque em **Aceitar e continuar**.
> 4. **Entre com a sua conta Riot:** o login abre a **página oficial da Riot** dentro do app. Use **Riot ID e senha** (o login com Google costuma não funcionar ali). O app nunca vê a sua senha.
> 5. **Permita as notificações** quando o Android pedir, para saber quando a loja trocar, quando o mercado noturno abrir ou quando uma skin da sua lista de desejos aparecer.
> 6. Em celulares com economia de bateria agressiva (Xiaomi, Samsung, Motorola…), tire o Minha Loja da **otimização de bateria** para os avisos chegarem na hora.
>
> Atualizações chegam sozinhas: é só abrir o app de vez em quando. Se um dia eu mandar um APK novo, é só instalar por cima, sem desinstalar.
