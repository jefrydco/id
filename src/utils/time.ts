import type { Locale } from "@/i18n";

/**
 * Format a date's time in HH:MM format
 */
export function formatTime(date: Date, locale: Locale = "en"): string {
	return date.toLocaleTimeString(locale === "id" ? "id-ID" : "en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}
