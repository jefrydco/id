import type { CollectionEntry } from "astro:content";

type Post = CollectionEntry<"blog">;

export const POSTS_PER_PAGE = 10;

export interface PaginationResult {
	posts: Post[];
	currentPage: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

/**
 * Paginate an array of posts
 */
export function paginatePosts(
	posts: Post[],
	page: number,
	perPage: number = POSTS_PER_PAGE,
): PaginationResult {
	const totalPages = Math.ceil(posts.length / perPage);
	const currentPage = Math.max(1, Math.min(page, totalPages));
	const startIndex = (currentPage - 1) * perPage;

	return {
		posts: posts.slice(startIndex, startIndex + perPage),
		currentPage,
		totalPages,
		hasNextPage: currentPage < totalPages,
		hasPrevPage: currentPage > 1,
	};
}

export type PageNumber = number | "ellipsis";

/**
 * Generate page numbers with ellipsis for pagination UI
 * Returns an array like [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]
 */
export function getPageNumbers(
	currentPage: number,
	totalPages: number,
	maxVisible: number = 5,
): PageNumber[] {
	if (totalPages <= maxVisible) {
		return Array.from({ length: totalPages }, (_, i) => i + 1);
	}

	const pages: PageNumber[] = [];
	const halfVisible = Math.floor(maxVisible / 2);

	pages.push(1);

	let start = Math.max(2, currentPage - halfVisible);
	let end = Math.min(totalPages - 1, currentPage + halfVisible);

	const visibleMiddle = maxVisible - 2;
	if (end - start + 1 < visibleMiddle) {
		if (start === 2) {
			end = Math.min(totalPages - 1, start + visibleMiddle - 1);
		} else if (end === totalPages - 1) {
			start = Math.max(2, end - visibleMiddle + 1);
		}
	}

	if (start > 2) {
		pages.push("ellipsis");
	}

	for (let i = start; i <= end; i++) {
		pages.push(i);
	}

	if (end < totalPages - 1) {
		pages.push("ellipsis");
	}

	if (totalPages > 1) {
		pages.push(totalPages);
	}

	return pages;
}
