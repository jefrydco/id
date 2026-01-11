import { type CollectionEntry, getCollection } from "astro:content";
import { defaultLocale, type Locale } from "@/i18n";

type Note = CollectionEntry<"notes">;

interface ParsedNoteId {
	locale: Locale;
	slug: string;
}

export function parseNoteId(id: string): ParsedNoteId {
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

export function getNoteSlug(note: Note): string {
	return parseNoteId(note.id).slug;
}

export function getNoteLocale(note: Note): Locale {
	return parseNoteId(note.id).locale;
}

export function isNoteDraft(note: Note): boolean {
	const slug = getNoteSlug(note);
	const filename = slug.split("/").pop() || "";
	return filename.startsWith("_");
}

export async function getNotesByLocale(locale: Locale): Promise<Note[]> {
	const allNotes = await getCollection("notes");

	const notesBySlug = new Map<string, { en?: Note; id?: Note }>();

	for (const note of allNotes) {
		const { locale: noteLocale, slug } = parseNoteId(note.id);
		if (!notesBySlug.has(slug)) {
			notesBySlug.set(slug, {});
		}
		const slugEntry = notesBySlug.get(slug);
		if (slugEntry) {
			slugEntry[noteLocale] = note;
		}
	}

	const result: Note[] = [];
	for (const [, translations] of notesBySlug) {
		const note = translations[locale] ?? translations[defaultLocale];
		if (note) {
			result.push(note);
		}
	}

	return result;
}

export async function getSortedNotesByLocale(locale: Locale): Promise<Note[]> {
	const notes = await getNotesByLocale(locale);
	return notes
		.filter((note) => !isNoteDraft(note))
		.sort(
			(a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf(),
		);
}

export async function getNoteBySlug(
	slug: string,
	locale: Locale,
): Promise<Note | undefined> {
	const allNotes = await getCollection("notes");

	const exactMatch = allNotes.find((note) => note.id === `${locale}/${slug}`);
	if (exactMatch) {
		return exactMatch;
	}

	if (locale !== defaultLocale) {
		const fallbackMatch = allNotes.find(
			(note) => note.id === `${defaultLocale}/${slug}`,
		);
		if (fallbackMatch) {
			return fallbackMatch;
		}
	}

	return undefined;
}

export async function getAllNoteSlugs(): Promise<string[]> {
	const allNotes = await getCollection("notes");
	const slugs = new Set<string>();

	for (const note of allNotes) {
		if (!isNoteDraft(note)) {
			slugs.add(getNoteSlug(note));
		}
	}

	return Array.from(slugs);
}

export async function hasNoteTranslation(
	slug: string,
	locale: Locale,
): Promise<boolean> {
	const allNotes = await getCollection("notes");
	return allNotes.some((note) => note.id === `${locale}/${slug}`);
}

export async function getAvailableNoteTranslations(
	slug: string,
): Promise<Locale[]> {
	const allNotes = await getCollection("notes");
	const locales: Locale[] = [];

	for (const note of allNotes) {
		const parsed = parseNoteId(note.id);
		if (parsed.slug === slug) {
			locales.push(parsed.locale);
		}
	}

	return locales;
}

export interface AdjacentNotes {
	prevNote: Note | null;
	nextNote: Note | null;
}

export async function getAdjacentNotes(
	currentSlug: string,
	locale: Locale,
): Promise<AdjacentNotes> {
	const notes = await getSortedNotesByLocale(locale);
	const currentIndex = notes.findIndex((n) => getNoteSlug(n) === currentSlug);

	if (currentIndex === -1) {
		return { prevNote: null, nextNote: null };
	}

	return {
		prevNote: notes[currentIndex + 1] || null,
		nextNote: notes[currentIndex - 1] || null,
	};
}

export async function getRelatedNotesByTags(
	currentSlug: string,
	tags: string[],
	locale: Locale,
	limit: number = 3,
): Promise<Note[]> {
	const notes = await getSortedNotesByLocale(locale);
	const currentNote = notes.find((n) => getNoteSlug(n) === currentSlug);

	if (!currentNote || tags.length === 0) {
		return notes.filter((n) => getNoteSlug(n) !== currentSlug).slice(0, limit);
	}

	const scoredNotes = notes
		.filter((n) => getNoteSlug(n) !== currentSlug)
		.map((note) => {
			const noteTags = note.data.tags || [];
			const matchingTags = tags.filter((tag) => noteTags.includes(tag));
			return { note, score: matchingTags.length };
		})
		.sort((a, b) => {
			if (b.score !== a.score) {
				return b.score - a.score;
			}
			return (
				b.note.data.publishedAt.valueOf() - a.note.data.publishedAt.valueOf()
			);
		});

	const result = scoredNotes.slice(0, limit).map((item) => item.note);

	if (result.length < limit) {
		const remaining = notes
			.filter((n) => getNoteSlug(n) !== currentSlug && !result.includes(n))
			.slice(0, limit - result.length);
		result.push(...remaining);
	}

	return result;
}
