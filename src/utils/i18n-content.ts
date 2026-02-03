import { type CollectionEntry, getCollection } from "astro:content";
import { defaultLocale, type Locale } from "@/i18n";

type Post = CollectionEntry<"blog">;

interface ParsedPostId {
	locale: Locale;
	slug: string;
}

/**
 * Parse a post ID to extract locale and slug
 * Post IDs are in format: "en/post-slug" or "id/post-slug"
 */
export function parsePostId(id: string): ParsedPostId {
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
 * Get the slug portion of a post (without locale prefix)
 */
export function getPostSlug(post: Post): string {
	return parsePostId(post.id).slug;
}

/**
 * Get the locale of a post
 */
export function getPostLocale(post: Post): Locale {
	return parsePostId(post.id).locale;
}

/**
 * Check if a post is a draft (filename starts with _)
 */
export function isDraft(post: Post): boolean {
	const slug = getPostSlug(post);
	const filename = slug.split("/").pop() || "";
	return filename.startsWith("_");
}

/**
 * Get all posts for a specific locale, with English fallback for missing translations
 */
export async function getPostsByLocale(locale: Locale): Promise<Post[]> {
	const allPosts = await getCollection("blog");

	const postsBySlug = new Map<string, { en?: Post; id?: Post }>();

	for (const post of allPosts) {
		const { locale: postLocale, slug } = parsePostId(post.id);
		if (!postsBySlug.has(slug)) {
			postsBySlug.set(slug, {});
		}
		const slugEntry = postsBySlug.get(slug);
		if (slugEntry) {
			slugEntry[postLocale] = post;
		}
	}

	const result: Post[] = [];
	for (const [, translations] of postsBySlug) {
		const post = translations[locale] ?? translations[defaultLocale];
		if (post) {
			result.push(post);
		}
	}

	return result;
}

/**
 * Get sorted posts by locale (newest first), excluding drafts
 */
export async function getSortedPostsByLocale(locale: Locale): Promise<Post[]> {
	const posts = await getPostsByLocale(locale);
	return posts
		.filter((post) => !isDraft(post))
		.sort(
			(a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf(),
		);
}

/**
 * Get a single post by slug and locale, with English fallback
 */
export async function getPostBySlug(
	slug: string,
	locale: Locale,
): Promise<Post | undefined> {
	const allPosts = await getCollection("blog");

	const exactMatch = allPosts.find((post) => post.id === `${locale}/${slug}`);
	if (exactMatch) {
		return exactMatch;
	}

	if (locale !== defaultLocale) {
		const fallbackMatch = allPosts.find(
			(post) => post.id === `${defaultLocale}/${slug}`,
		);
		if (fallbackMatch) {
			return fallbackMatch;
		}
	}

	return undefined;
}

/**
 * Get all unique post slugs across all locales
 */
export async function getAllPostSlugs(): Promise<string[]> {
	const allPosts = await getCollection("blog");
	const slugs = new Set<string>();

	for (const post of allPosts) {
		if (!isDraft(post)) {
			slugs.add(getPostSlug(post));
		}
	}

	return Array.from(slugs);
}

/**
 * Check if a translation exists for a given slug and locale
 */
export async function hasBlogTranslation(
	slug: string,
	locale: Locale,
): Promise<boolean> {
	const allPosts = await getCollection("blog");
	return allPosts.some((post) => post.id === `${locale}/${slug}`);
}

/**
 * Get available translations for a post slug
 */
export async function getAvailableTranslations(
	slug: string,
): Promise<Locale[]> {
	const allPosts = await getCollection("blog");
	const locales: Locale[] = [];

	for (const post of allPosts) {
		const parsed = parsePostId(post.id);
		if (parsed.slug === slug) {
			locales.push(parsed.locale);
		}
	}

	return locales;
}

export interface AdjacentPosts {
	prevPost: Post | null;
	nextPost: Post | null;
}

/**
 * Get adjacent (previous and next) posts for navigation
 * Posts are sorted by date, so:
 * - prevPost is the older post (index + 1 in sorted array)
 * - nextPost is the newer post (index - 1 in sorted array)
 */
export async function getAdjacentPosts(
	currentSlug: string,
	locale: Locale,
): Promise<AdjacentPosts> {
	const posts = await getSortedPostsByLocale(locale);
	const currentIndex = posts.findIndex((p) => getPostSlug(p) === currentSlug);

	if (currentIndex === -1) {
		return { prevPost: null, nextPost: null };
	}

	return {
		prevPost: posts[currentIndex + 1] || null,
		nextPost: posts[currentIndex - 1] || null,
	};
}

export async function getRelatedPostsByTags(
	currentSlug: string,
	tags: string[],
	locale: Locale,
	limit: number = 3,
): Promise<Post[]> {
	const posts = await getSortedPostsByLocale(locale);
	const currentPost = posts.find((p) => getPostSlug(p) === currentSlug);

	if (!currentPost || tags.length === 0) {
		return posts.filter((p) => getPostSlug(p) !== currentSlug).slice(0, limit);
	}

	const scoredPosts = posts
		.filter((p) => getPostSlug(p) !== currentSlug)
		.map((post) => {
			const postTags = post.data.tags || [];
			const matchingTags = tags.filter((tag) => postTags.includes(tag));
			return { post, score: matchingTags.length };
		})
		.sort((a, b) => {
			if (b.score !== a.score) {
				return b.score - a.score;
			}
			return (
				b.post.data.publishedAt.valueOf() - a.post.data.publishedAt.valueOf()
			);
		});

	const result = scoredPosts.slice(0, limit).map((item) => item.post);

	if (result.length < limit) {
		const remaining = posts
			.filter((p) => getPostSlug(p) !== currentSlug && !result.includes(p))
			.slice(0, limit - result.length);
		result.push(...remaining);
	}

	return result;
}
