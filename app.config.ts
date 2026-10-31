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
  plugins: [
    ...(config.plugins ?? []),
    [
      'expo-build-properties',
      {
        android: {
          // minify já vem true por padrão no SDK 58; deixamos explícito.
          enableProguardInReleaseBuilds: true,
          enableMinifyInReleaseBuilds: true,
          // Resources (drawables/strings não usados) não eram removidos por padrão.
          enableShrinkResourcesInReleaseBuilds: true,
          // No APK final (fora da Play Store), x86/x86_64 só servem para
          // emulador: tirá-los corta as libs nativas praticamente pela
          // metade. No build de dev deixamos todos, porque o emulador pode
          // precisar de x86_64.
          buildArchs: IS_DEV ? undefined : ['armeabi-v7a', 'arm64-v8a'],
        },
      },
    ],
  ],
});
