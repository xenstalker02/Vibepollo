import { http } from '@/http';
import type createLocale from '@/locale';
import type { MessageSchema } from '@/locale';

const NULL_VALUE = null;
type NullValue = typeof NULL_VALUE;
type AppI18n = Awaited<ReturnType<typeof createLocale>>;

let _i18n: AppI18n | NullValue = null;

export function setI18nGlobal(i18n: AppI18n): void {
  _i18n = i18n;
}

export function getI18nGlobal(): AppI18n | NullValue {
  return _i18n;
}

export async function ensureLocaleLoaded(locale: string): Promise<void> {
  if (!_i18n) return;
  try {
    // Short-circuit if we already have messages for this locale
    const has = _i18n.global.availableLocales?.includes(locale);
    if (!has) {
      const response = await http.get<MessageSchema>(`/assets/locale/${locale}.json`, {
        validateStatus: () => true,
      });
      if (response.status === 200 && response.data) {
        _i18n.global.setLocaleMessage(locale, response.data);
      }
    }
    Reflect.set(_i18n.global, 'locale', locale);
    document.querySelector('html')?.setAttribute('lang', locale);
  } catch (e) {
    console.error('ensureLocaleLoaded failed', e);
  }
}
