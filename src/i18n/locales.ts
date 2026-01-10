export const locales = ["en", "id"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
	en: "EN",
	id: "ID",
};

export const languageTags: Record<Locale, string> = {
	en: "en-US",
	id: "id-ID",
};

export function isValidLocale(locale: string): locale is Locale {
	return locales.includes(locale as Locale);
}
