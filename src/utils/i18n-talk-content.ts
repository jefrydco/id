import { getCollection, type CollectionEntry } from "astro:content";
import { defaultLocale, type Locale } from "@/i18n";

type Talk = CollectionEntry<"talk">;

interface ParsedTalkId {
	locale: Locale;
	slug: string;
}

export interface TalkYearGroup {
	year: string;
	talks: Talk[];
}

/**
 * Parse a talk ID to extract locale and slug
 * Talk IDs are in format: "en/talk-slug" or "id/talk-slug"
 */
export function parseTalkId(id: string): ParsedTalkId {
	const parts = id.split("/");
	if (parts.length >= 2 && (parts[0] === "en" || parts[0] === "id")) {
		return {
			locale: parts[0] as Locale,
			slug: parts.slice(1).join("/"),
		};
	}
	return {
		locale: defaultLocale,
		slug: id,
	};
}

/**
 * Get the slug portion of a talk (without locale prefix)
 */
export function getTalkSlug(talk: Talk): string {
	return parseTalkId(talk.id).slug;
}

/**
 * Get the locale of a talk
 */
export function getTalkLocale(talk: Talk): Locale {
	return parseTalkId(talk.id).locale;
}

/**
 * Get all talks for a specific locale, with English fallback for missing translations
 */
export async function getTalksByLocale(locale: Locale): Promise<Talk[]> {
	const allTalks = await getCollection("talk");

	const talksBySlug = new Map<string, { en?: Talk; id?: Talk }>();

	for (const talk of allTalks) {
		const { locale: talkLocale, slug } = parseTalkId(talk.id);
		if (!talksBySlug.has(slug)) {
			talksBySlug.set(slug, {});
		}
		const slugEntry = talksBySlug.get(slug);
		if (slugEntry) {
			slugEntry[talkLocale] = talk;
		}
	}

	const result: Talk[] = [];
	for (const [, translations] of talksBySlug) {
		const talk = translations[locale] ?? translations[defaultLocale];
		if (talk) {
			result.push(talk);
		}
	}

	return result;
}

/**
 * Get sorted talks by locale (newest first by startDate)
 */
export async function getSortedTalksByLocale(locale: Locale): Promise<Talk[]> {
	const talks = await getTalksByLocale(locale);
	return talks.sort(
		(a, b) => b.data.startDate.valueOf() - a.data.startDate.valueOf(),
	);
}

/**
 * Get talks grouped by year
 */
export async function getTalksByYear(locale: Locale): Promise<TalkYearGroup[]> {
	const talks = await getSortedTalksByLocale(locale);

	const grouped = new Map<string, Talk[]>();

	for (const talk of talks) {
		const year = talk.data.startDate.getFullYear().toString();
		if (!grouped.has(year)) {
			grouped.set(year, []);
		}
		grouped.get(year)?.push(talk);
	}

	return Array.from(grouped.entries())
		.map(([year, talks]) => ({ year, talks }))
		.sort((a, b) => Number.parseInt(b.year, 10) - Number.parseInt(a.year, 10));
}

/**
 * Get a single talk by slug and locale, with English fallback
 */
export async function getTalkBySlug(
	slug: string,
	locale: Locale,
): Promise<Talk | undefined> {
	const allTalks = await getCollection("talk");

	const exactMatch = allTalks.find((talk) => talk.id === `${locale}/${slug}`);
	if (exactMatch) {
		return exactMatch;
	}

	if (locale !== defaultLocale) {
		const fallbackMatch = allTalks.find(
			(talk) => talk.id === `${defaultLocale}/${slug}`,
		);
		if (fallbackMatch) {
			return fallbackMatch;
		}
	}

	return undefined;
}

/**
 * Get all unique talk slugs across all locales
 */
export async function getAllTalkSlugs(): Promise<string[]> {
	const allTalks = await getCollection("talk");
	const slugs = new Set<string>();

	for (const talk of allTalks) {
		slugs.add(getTalkSlug(talk));
	}

	return Array.from(slugs);
}

/**
 * Check if a translation exists for a given slug and locale
 */
export async function hasTalkTranslation(
	slug: string,
	locale: Locale,
): Promise<boolean> {
	const allTalks = await getCollection("talk");
	return allTalks.some((talk) => talk.id === `${locale}/${slug}`);
}

/**
 * Get available translations for a talk slug
 */
export async function getAvailableTalkTranslations(
	slug: string,
): Promise<Locale[]> {
	const allTalks = await getCollection("talk");
	const locales: Locale[] = [];

	for (const talk of allTalks) {
		const parsed = parseTalkId(talk.id);
		if (parsed.slug === slug) {
			locales.push(parsed.locale);
		}
	}

	return locales;
}

export interface AdjacentTalks {
	prevTalk: Talk | null;
	nextTalk: Talk | null;
}

/**
 * Get adjacent (previous and next) talks for navigation
 * Talks are sorted by date, so:
 * - prevTalk is the older talk (index + 1 in sorted array)
 * - nextTalk is the newer talk (index - 1 in sorted array)
 */
export async function getAdjacentTalks(
	currentSlug: string,
	locale: Locale,
): Promise<AdjacentTalks> {
	const talks = await getSortedTalksByLocale(locale);
	const currentIndex = talks.findIndex((t) => getTalkSlug(t) === currentSlug);

	if (currentIndex === -1) {
		return { prevTalk: null, nextTalk: null };
	}

	return {
		prevTalk: talks[currentIndex + 1] || null,
		nextTalk: talks[currentIndex - 1] || null,
	};
}

/**
 * Get related talks by tags
 */
export async function getRelatedTalksByTags(
	currentSlug: string,
	tags: string[],
	locale: Locale,
	limit: number = 3,
): Promise<Talk[]> {
	const talks = await getSortedTalksByLocale(locale);
	const currentTalk = talks.find((t) => getTalkSlug(t) === currentSlug);

	if (!currentTalk || tags.length === 0) {
		return talks.filter((t) => getTalkSlug(t) !== currentSlug).slice(0, limit);
	}

	const scoredTalks = talks
		.filter((t) => getTalkSlug(t) !== currentSlug)
		.map((talk) => {
			const talkTags = talk.data.tags || [];
			const matchingTags = tags.filter((tag) => talkTags.includes(tag));
			return { talk, score: matchingTags.length };
		})
		.sort((a, b) => {
			if (b.score !== a.score) {
				return b.score - a.score;
			}
			return b.talk.data.startDate.valueOf() - a.talk.data.startDate.valueOf();
		});

	const result = scoredTalks.slice(0, limit).map((item) => item.talk);

	if (result.length < limit) {
		const remaining = talks
			.filter((t) => getTalkSlug(t) !== currentSlug && !result.includes(t))
			.slice(0, limit - result.length);
		result.push(...remaining);
	}

	return result;
}
