import type { CollectionEntry } from "astro:content";
import type { Locale } from "@/i18n";
import { defaultLocale } from "@/i18n";
import { getSortedPostsByLocale } from "@/utils/i18n-content";

type Post = CollectionEntry<"blog">;

export interface TagInfo {
	tag: string;
	count: number;
}

/**
 * Normalize a tag for URL usage (lowercase, replace spaces with hyphens)
 */
export function normalizeTag(tag: string): string {
	return tag.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Get all unique tags with their post counts for a specific locale
 */
export async function getAllTags(locale: Locale): Promise<TagInfo[]> {
	const posts = await getSortedPostsByLocale(locale);
	const tagCounts = new Map<string, number>();

	for (const post of posts) {
		const tags = post.data.tags || [];
		for (const tag of tags) {
			const normalized = normalizeTag(tag);
			tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
		}
	}

	return Array.from(tagCounts.entries())
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * Get all posts that have a specific tag
 */
export async function getPostsByTag(
	tag: string,
	locale: Locale,
): Promise<Post[]> {
	const posts = await getSortedPostsByLocale(locale);
	const normalizedTag = normalizeTag(tag);

	return posts.filter((post) => {
		const tags = post.data.tags || [];
		return tags.some((t) => normalizeTag(t) === normalizedTag);
	});
}

/**
 * Generate the URL for a tag page
 */
export function getTagUrl(tag: string, locale: Locale): string {
	const normalizedTag = normalizeTag(tag);
	return locale === defaultLocale
		? `/blog/tags/${normalizedTag}/`
		: `/${locale}/blog/tags/${normalizedTag}/`;
}

/**
 * Get all unique normalized tags across all locales (for static path generation)
 */
export async function getAllUniqueTags(): Promise<string[]> {
	const [enPosts, idPosts] = await Promise.all([
		getSortedPostsByLocale("en"),
		getSortedPostsByLocale("id"),
	]);

	const allTags = new Set<string>();

	for (const post of [...enPosts, ...idPosts]) {
		const tags = post.data.tags || [];
		for (const tag of tags) {
			allTags.add(normalizeTag(tag));
		}
	}

	return Array.from(allTags).sort();
}
