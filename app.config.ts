import type { ConfigContext, ExpoConfig } from 'expo/config';

// APP_VARIANT é definido por perfil no eas.json (e no script "start:dev").
// Assim o development build convive no celular com a versão final.
const IS_DEV = process.env.APP_VARIANT === 'development';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? 'Minha Loja (dev)' : 'Minha Loja',
  slug: config.slug ?? 'minha-loja',
  scheme: IS_DEV ? 'minhaloja-dev' : 'minhaloja',
  android: {
    ...config.android,
    package: IS_DEV ? 'com.luiz.minhaloja.dev' : 'com.luiz.minhaloja',
  },
});
