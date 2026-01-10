import type { CollectionEntry } from "astro:content";
import type { Locale } from "@/i18n";

// Reading time interface
export interface ReadingTime {
	text: string;
	minutes: number;
	time: number;
	words: number;
}

// TOC item interface
export interface TOCItem {
	level: number;
	text: string;
	id: string;
	index: number;
}

// PostList component props interface
export interface PostListProps {
	posts: CollectionEntry<"blog">[];
	locale?: Locale;
}
