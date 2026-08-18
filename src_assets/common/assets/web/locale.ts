import { createI18n } from 'vue-i18n';

// Import only the fallback language files
import en from '@/public/assets/locale/en.json';
import { http } from '@/http';

interface LocaleResponse {
  locale?: string;
}

export type MessageSchema = typeof en;

export default async function createLocale() {
  const response = await http
    .get<LocaleResponse>('./api/configLocale', { validateStatus: () => true })
    .catch(() => undefined);
  const r = response?.status === 200 ? response.data : {};
  const locale = r.locale ?? 'en';
  document.querySelector('html')?.setAttribute('lang', locale);
  const messages: Record<string, MessageSchema> = {
    en,
  };
  try {
    if (locale !== 'en') {
      const localeResponse = await http.get<MessageSchema>(`/assets/locale/${locale}.json`, {
        validateStatus: () => true,
      });
      if (localeResponse.status === 200 && localeResponse.data) {
        messages[locale] = localeResponse.data;
      }
    }
  } catch (e) {
    console.error('Failed to download translations', e);
  }
  const i18n = createI18n({
    // Use the Composition API and inject global helpers so `$t` works in templates
    legacy: false,
    globalInjection: true,
    locale: locale, // set locale
    fallbackLocale: 'en', // set fallback locale
    messages: messages,
  });
  return i18n;
}
