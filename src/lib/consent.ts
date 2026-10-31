import { keys, readJson, writeJson } from './storage';

/** Mude a versão sempre que o texto do aviso mudar: o aceite é pedido de novo. */
export const CONSENT_VERSION = '2026-10-30';

export const CONSENT_POINTS = [
  'Este app não é afiliado, patrocinado nem aprovado pela Riot Games.',
  'Ele usa uma API não oficial do jogo. Isso vai contra os termos da Riot, e o risco (inclusive para a sua conta) é seu.',
  'O login acontece na página oficial da Riot. O app nunca vê a sua senha.',
  'Seus dados ficam só neste celular. O app só se conecta aos servidores da Riot (login, loja e vídeos), da valorant-api.com (imagens e nomes das skins) e da Expo (para baixar atualizações do próprio app, sem dados seus).',
];

export const FAN_NOTICE_PT =
  'Minha Loja não é endossado pela Riot Games e não reflete as opiniões da Riot Games nem de ninguém oficialmente envolvido na produção ou no gerenciamento das propriedades da Riot Games. Riot Games e todas as propriedades associadas são marcas comerciais ou marcas registradas da Riot Games, Inc.';

export const FAN_NOTICE_EN =
  "Minha Loja isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

type Consent = { version: string; acceptedAt: number };

export async function hasCurrentConsent(): Promise<boolean> {
  return (await readJson<Consent>(keys.consent))?.version === CONSENT_VERSION;
}

export async function acceptConsent(): Promise<void> {
  await writeJson(keys.consent, { version: CONSENT_VERSION, acceptedAt: Date.now() } satisfies Consent);
}
