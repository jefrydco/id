import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { generateOGImage } from "@/utils/og-image";
import { themeConfig } from "@/config";
import { locales, defaultLocale, type Locale } from "@/i18n";
import { parsePostId, isDraft } from "@/utils/i18n-content";
import { parseTalkId } from "@/utils/i18n-talk-content";

interface OGImageProps {
	title: string;
	publishedAt: Date;
	locale: Locale;
}

export const getStaticPaths: GetStaticPaths = async () => {
	const [posts, talks] = await Promise.all([
		getCollection("blog"),
		getCollection("talk"),
	]);
	const paths: { params: { route: string }; props: OGImageProps }[] = [];

	const postsBySlug = new Map<string, Map<Locale, (typeof posts)[0]>>();

	for (const post of posts) {
		if (isDraft(post)) continue;

		const { locale, slug } = parsePostId(post.id);
		if (!postsBySlug.has(slug)) {
			postsBySlug.set(slug, new Map());
		}
		const slugMap = postsBySlug.get(slug);
		if (slugMap) {
			slugMap.set(locale, post);
		}
	}

	for (const [slug, translations] of postsBySlug) {
		for (const locale of locales) {
			const post = translations.get(locale) ?? translations.get(defaultLocale);
			if (!post) continue;

			const route =
				locale === defaultLocale ? `blog/${slug}` : `${locale}/blog/${slug}`;

			paths.push({
				params: { route },
				props: {
					title: post.data.title,
					publishedAt: post.data.publishedAt,
					locale,
				},
			});
		}
	}

	const talksBySlug = new Map<string, Map<Locale, (typeof talks)[0]>>();

	for (const talk of talks) {
		const { locale, slug } = parseTalkId(talk.id);
		if (!talksBySlug.has(slug)) {
			talksBySlug.set(slug, new Map());
		}
		const slugMap = talksBySlug.get(slug);
		if (slugMap) {
			slugMap.set(locale, talk);
		}
	}

	for (const [slug, translations] of talksBySlug) {
		for (const locale of locales) {
			const talk = translations.get(locale) ?? translations.get(defaultLocale);
			if (!talk) continue;

			const route =
				locale === defaultLocale ? `talk/${slug}` : `${locale}/talk/${slug}`;

			paths.push({
				params: { route },
				props: {
					title: talk.data.title,
					publishedAt: talk.data.startDate,
					locale,
				},
			});
		}
	}

	return paths;
};

export const GET: APIRoute = async ({ props }) => {
	const { title, publishedAt } = props as OGImageProps;

	try {
		const png = await generateOGImage(
			title,
			themeConfig.site.title,
			publishedAt,
		);

		return new Response(png, {
			status: 200,
			headers: {
				"Content-Type": "image/png",
				"Cache-Control": "public, max-age=31536000, immutable",
			},
		});
	} catch (error) {
		console.error("Error generating OG image:", error);
		return new Response("Error generating image", { status: 500 });
	}
};
