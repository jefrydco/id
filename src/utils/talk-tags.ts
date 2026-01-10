import type { CollectionEntry } from "astro:content";
import type { Locale } from "@/i18n";
import { defaultLocale } from "@/i18n";
import {
	getSortedTalksByLocale,
	type TalkYearGroup,
} from "@/utils/i18n-talk-content";

type Talk = CollectionEntry<"talk">;

export interface TalkTagInfo {
	tag: string;
	count: number;
}

/**
 * Normalize a tag for URL usage (lowercase, replace spaces with hyphens)
 */
export function normalizeTalkTag(tag: string): string {
	return tag.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Get all unique tags with their talk counts for a specific locale
 */
export async function getAllTalkTags(locale: Locale): Promise<TalkTagInfo[]> {
	const talks = await getSortedTalksByLocale(locale);
	const tagCounts = new Map<string, number>();

	for (const talk of talks) {
		const tags = talk.data.tags || [];
		for (const tag of tags) {
			const normalized = normalizeTalkTag(tag);
			tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
		}
	}

	return Array.from(tagCounts.entries())
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * Get all talks that have a specific tag
 */
export async function getTalksByTag(
	tag: string,
	locale: Locale,
): Promise<Talk[]> {
	const talks = await getSortedTalksByLocale(locale);
	const normalizedTag = normalizeTalkTag(tag);

	return talks.filter((talk) => {
		const tags = talk.data.tags || [];
		return tags.some((t) => normalizeTalkTag(t) === normalizedTag);
	});
}

/**
 * Generate the URL for a talk tag page
 */
export function getTalkTagUrl(tag: string, locale: Locale): string {
	const normalizedTag = normalizeTalkTag(tag);
	return locale === defaultLocale
		? `/talk/tags/${normalizedTag}/`
		: `/${locale}/talk/tags/${normalizedTag}/`;
}

/**
 * Get all unique normalized tags across all locales (for static path generation)
 */
export async function getAllUniqueTalkTags(): Promise<string[]> {
	const [enTalks, idTalks] = await Promise.all([
		getSortedTalksByLocale("en"),
		getSortedTalksByLocale("id"),
	]);

	const allTags = new Set<string>();

	for (const talk of [...enTalks, ...idTalks]) {
		const tags = talk.data.tags || [];
		for (const tag of tags) {
			allTags.add(normalizeTalkTag(tag));
		}
	}

	return Array.from(allTags).sort();
}

/**
 * Get talks for a specific tag grouped by year
 */
export async function getTalksByTagGroupedByYear(
	tag: string,
	locale: Locale,
): Promise<TalkYearGroup[]> {
	const talks = await getTalksByTag(tag, locale);

	const grouped = new Map<string, Talk[]>();

	for (const talk of talks) {
		const year = talk.data.startDate.getFullYear().toString();
		if (!grouped.has(year)) {
			grouped.set(year, []);
		}
		grouped.get(year)!.push(talk);
	}

	return Array.from(grouped.entries())
		.map(([year, talks]) => ({ year, talks }))
		.sort((a, b) => parseInt(b.year) - parseInt(a.year));
}
