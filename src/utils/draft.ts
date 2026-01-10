import { type CollectionEntry, getCollection } from "astro:content";

/**
 * Get all posts, filtering out posts whose filenames start with _
 */
export async function getFilteredPosts() {
	const posts = await getCollection("blog");
	return posts.filter(
		(post: CollectionEntry<"blog">) => !post.id.startsWith("_"),
	);
}

/**
 * Get all posts sorted by publication date, filtering out posts whose filenames start with _
 */
export async function getSortedFilteredPosts() {
	const posts = await getFilteredPosts();
	return posts.sort(
		(a: CollectionEntry<"blog">, b: CollectionEntry<"blog">) =>
			b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf(),
	);
}
