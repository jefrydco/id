import { defaultLocale, getLanguageTag, type Locale } from "@/i18n";

/**
 * Format a date using localized Intl.DateTimeFormat
 * @param date - The date to format
 * @param locale - The locale to use for formatting
 * @returns Formatted date string (e.g., "Jan 15, 2025" for en, "15 Jan 2025" for id)
 */
export function formatDate(date: Date, locale: Locale = defaultLocale): string {
	const languageTag = getLanguageTag(locale);

	const formatter = new Intl.DateTimeFormat(languageTag, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});

	return formatter.format(date);
}
