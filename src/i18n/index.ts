import { en, type Translations } from "./translations/en";
import { id } from "./translations/id";
import { defaultLocale, languageTags, type Locale } from "./locales";

export {
	locales,
	defaultLocale,
	localeLabels,
	languageTags,
	isValidLocale,
} from "./locales";
export type { Locale } from "./locales";
export type { Translations } from "./translations/en";

const translations: Record<Locale, Translations> = {
	en,
	id,
};

export function getTranslations(locale: Locale = defaultLocale): Translations {
	return translations[locale] ?? translations[defaultLocale];
}

export function getLocaleFromPath(pathname: string): Locale {
	const segments = pathname.split("/").filter(Boolean);
	const firstSegment = segments[0];

	if (firstSegment === "id") {
		return "id";
	}

	return defaultLocale;
}

export function getLocalizedPath(path: string, locale: Locale): string {
	const cleanPath = path.startsWith("/") ? path.slice(1) : path;

	const segments = cleanPath.split("/").filter(Boolean);
	const firstSegment = segments[0];

	let pathWithoutLocale: string;
	if (firstSegment === "id") {
		pathWithoutLocale = segments.slice(1).join("/");
	} else {
		pathWithoutLocale = cleanPath;
	}

	if (locale === defaultLocale) {
		return pathWithoutLocale ? `/${pathWithoutLocale}` : "/";
	}

	return pathWithoutLocale ? `/${locale}/${pathWithoutLocale}` : `/${locale}`;
}

export function getLanguageTag(locale: Locale): string {
	return languageTags[locale];
}

export function getAlternateLocale(locale: Locale): Locale {
	return locale === "en" ? "id" : "en";
}
