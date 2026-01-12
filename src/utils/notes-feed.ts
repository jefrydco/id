import type { APIContext } from "astro";
import { Feed } from "feed";
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { themeConfig } from "@/config";
import { defaultLocale, getLanguageTag, type Locale } from "@/i18n";
import { getSortedNotesByLocale, getNoteSlug } from "@/utils/i18n-notes";

const markdownParser = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true,
});

async function generateNotesFeedInstance(
	context: APIContext,
	locale: Locale = defaultLocale,
) {
	const siteUrl = (
		context.site?.toString() || themeConfig.site.website
	).replace(/\/$/, "");
	const { title = "", author = "" } = themeConfig.site;
	const language = getLanguageTag(locale);

	const localePrefix = locale === defaultLocale ? "" : `/${locale}`;
	const feedUrl = `${siteUrl}${localePrefix}/notes`;

	const feed = new Feed({
		title: `${title} - Notes`,
		description: "Quick notes and thoughts",
		id: feedUrl,
		link: feedUrl,
		language: language,
		copyright: `Copyright © ${new Date().getFullYear()} ${author}`,
		updated: new Date(),
		generator: "Astro Chiri Feed Generator",
		feedLinks: {
			rss: `${feedUrl}/rss.xml`,
			atom: `${feedUrl}/atom.xml`,
		},
		author: {
			name: author,
			link: siteUrl,
		},
	});

	const sortedNotes = await getSortedNotesByLocale(locale);

	for (const note of sortedNotes) {
		const slug = getNoteSlug(note);
		const notePath =
			locale === defaultLocale ? `/notes/${slug}` : `/${locale}/notes/${slug}`;
		const noteUrl = new URL(notePath, siteUrl).toString();
		const rawHtml = markdownParser.render(note.body || "");
		const cleanHtml = sanitizeHtml(rawHtml, {
			allowedTags: sanitizeHtml.defaults.allowedTags.concat([
				"img",
				"div",
				"span",
			]),
			allowedAttributes: {
				...sanitizeHtml.defaults.allowedAttributes,
				"*": ["class", "id"],
				a: ["href", "title", "target", "rel"],
				img: ["src", "alt", "title", "width", "height"],
			},
		});

		feed.addItem({
			title: note.data.title,
			id: noteUrl,
			link: noteUrl,
			description: note.data.description || "",
			content: cleanHtml,
			date: note.data.publishedAt,
			published: note.data.publishedAt,
			updated: note.data.updatedAt || note.data.publishedAt,
		});
	}

	return feed;
}

export async function generateNotesRSS(
	context: APIContext,
	locale: Locale = defaultLocale,
) {
	const feed = await generateNotesFeedInstance(context, locale);
	const rssXml = feed
		.rss2()
		.replace(
			'<?xml version="1.0" encoding="utf-8"?>',
			'<?xml version="1.0" encoding="utf-8"?>\n<?xml-stylesheet type="text/xsl" href="/feeds/rss-style.xsl"?>',
		);
	return new Response(rssXml, {
		headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
	});
}

export async function generateNotesAtom(
	context: APIContext,
	locale: Locale = defaultLocale,
) {
	const feed = await generateNotesFeedInstance(context, locale);
	const atomXml = feed
		.atom1()
		.replace(
			'<?xml version="1.0" encoding="utf-8"?>',
			'<?xml version="1.0" encoding="utf-8"?>\n<?xml-stylesheet type="text/xsl" href="/feeds/atom-style.xsl"?>',
		);
	return new Response(atomXml, {
		headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
	});
}
