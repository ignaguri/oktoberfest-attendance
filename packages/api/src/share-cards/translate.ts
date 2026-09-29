import type { ShareLang } from "@prostcounter/shared";
import { defaultNS, resources } from "@prostcounter/shared/i18n/core";
import type { CopyRef } from "@prostcounter/shared/wrapped";
import i18next from "i18next";

export type CardTranslate = (ref: CopyRef) => string;

const translators = new Map<ShareLang, Promise<CardTranslate>>();

/** A server-side i18next per language, built once; CopyRefs resolve like they do in the apps. */
export function cardTranslator(lang: ShareLang): Promise<CardTranslate> {
  let translator = translators.get(lang);
  if (!translator) {
    translator = (async () => {
      const instance = i18next.createInstance();
      await instance.init({
        resources,
        lng: lang,
        fallbackLng: "en",
        defaultNS,
        interpolation: { escapeValue: false },
      });
      const t = instance.t as unknown as (
        key: string,
        options?: Record<string, unknown>,
      ) => string;
      return (ref: CopyRef) => t(ref.key, ref.params);
    })();
    translators.set(lang, translator);
  }
  return translator;
}
