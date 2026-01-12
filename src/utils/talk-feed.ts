import type { APIContext } from "astro";
import { Feed } from "feed";
import { themeConfig } from "@/config";
import { defaultLocale, getLanguageTag, type Locale } from "@/i18n";
import { getSortedTalksByLocale, getTalkSlug } from "@/utils/i18n-talk-content";

async function generateTalkFeedInstance(
	context: APIContext,
	locale: Locale = defaultLocale,
) {
	const siteUrl = (
		context.site?.toString() || themeConfig.site.website
	).replace(/\/$/, "");
	const { title = "", author = "" } = themeConfig.site;
	const language = getLanguageTag(locale);

	const localePrefix = locale === defaultLocale ? "" : `/${locale}`;
	const feedUrl = `${siteUrl}${localePrefix}/talk`;

	const feed = new Feed({
		title: `${title} - Talks`,
		description: "Speaking engagements and presentations",
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

	const sortedTalks = await getSortedTalksByLocale(locale);

	for (const talk of sortedTalks) {
		const slug = getTalkSlug(talk);
		const talkPath =
			locale === defaultLocale ? `/talk/${slug}` : `/${locale}/talk/${slug}`;
		const talkUrl = new URL(talkPath, siteUrl).toString();

		const description = [
			talk.data.description,
			`Organizer: ${talk.data.organizer}`,
			`Date: ${talk.data.startDate.toLocaleDateString(language)}`,
		].join("\n\n");

		feed.addItem({
			title: talk.data.title,
			id: talkUrl,
			link: talkUrl,
			description: talk.data.description,
			content: description,
			date: talk.data.startDate,
			published: talk.data.startDate,
		});
	}

	return feed;
}

export async function generateTalkRSS(
	context: APIContext,
	locale: Locale = defaultLocale,
) {
	const feed = await generateTalkFeedInstance(context, locale);
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

export async function generateTalkAtom(
	context: APIContext,
	locale: Locale = defaultLocale,
) {
	const feed = await generateTalkFeedInstance(context, locale);
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
