import type { CollectionEntry } from "astro:content";
import type { Locale } from "@/i18n";
import { defaultLocale } from "@/i18n";
import { getSortedNotesByLocale } from "@/utils/i18n-notes";

type Note = CollectionEntry<"notes">;

export interface NoteTagInfo {
	tag: string;
	count: number;
}

export function normalizeNoteTag(tag: string): string {
	return tag.toLowerCase().replace(/\s+/g, "-");
}

export async function getAllNoteTags(locale: Locale): Promise<NoteTagInfo[]> {
	const notes = await getSortedNotesByLocale(locale);
	const tagCounts = new Map<string, number>();

	for (const note of notes) {
		const tags = note.data.tags || [];
		for (const tag of tags) {
			const normalized = normalizeNoteTag(tag);
			tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
		}
	}

	return Array.from(tagCounts.entries())
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export async function getNotesByTag(
	tag: string,
	locale: Locale,
): Promise<Note[]> {
	const notes = await getSortedNotesByLocale(locale);
	const normalizedTag = normalizeNoteTag(tag);

	return notes.filter((note) => {
		const tags = note.data.tags || [];
		return tags.some((t) => normalizeNoteTag(t) === normalizedTag);
	});
}

export function getNoteTagUrl(tag: string, locale: Locale): string {
	const normalizedTag = normalizeNoteTag(tag);
	return locale === defaultLocale
		? `/notes/tags/${normalizedTag}/`
		: `/${locale}/notes/tags/${normalizedTag}/`;
}

export async function getAllUniqueNoteTags(): Promise<string[]> {
	const [enNotes, idNotes] = await Promise.all([
		getSortedNotesByLocale("en"),
		getSortedNotesByLocale("id"),
	]);

	const allTags = new Set<string>();

	for (const note of [...enNotes, ...idNotes]) {
		const tags = note.data.tags || [];
		for (const tag of tags) {
			allTags.add(normalizeNoteTag(tag));
		}
	}

	return Array.from(allTags).sort();
}
