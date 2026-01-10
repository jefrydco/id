import { getImage } from "astro:assets";
import path from "node:path";
import type { APIContext, ImageMetadata } from "astro";
import { Feed } from "feed";
import MarkdownIt from "markdown-it";
import { parse as htmlParser } from "node-html-parser";
import sanitizeHtml from "sanitize-html";
import { themeConfig } from "@/config";
import { defaultLocale, getLanguageTag, type Locale } from "@/i18n";
import { getPostSlug, getSortedPostsByLocale } from "@/utils/i18n-content";

const markdownParser = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true,
});

const imagesGlob = import.meta.glob<{ default: ImageMetadata }>(
	"/src/content/blog/_assets/**/*.{jpeg,jpg,png,gif,webp}",
);

/**
 * Fix relative image paths in HTML content and convert them to absolute URLs
 * @param htmlContent - HTML string converted from Markdown
 * @param baseUrl - Base URL of the website
 * @param postPath - Current post path (e.g., 'some-post.md' or 'tech/another-post.md')
 * @returns - HTML string with processed image paths
 */
async function fixRelativeImagePaths(
	htmlContent: string,
	baseUrl: string,
	postPath: string,
): Promise<string> {
	const root = htmlParser(htmlContent);
	const imageTags = root.querySelectorAll("img");
	const postDir = path.dirname(postPath);

	for (const img of imageTags) {
		const src = img.getAttribute("src");
		if (!src) continue;

		if (/^(https?:\/\/|\/\/)/.test(src)) {
			continue;
		}

		if (src.startsWith("./") || src.startsWith("../")) {
			let resolvedPath: string;
			if (src.startsWith("./")) {
				resolvedPath = path.posix.join(
					"/src/content/blog",
					postDir,
					src.slice(2),
				);
			} else {
				resolvedPath = path.posix.resolve("/src/content/blog", postDir, src);
			}

			if (imagesGlob[resolvedPath]) {
				try {
					const imageModule = await imagesGlob[resolvedPath]();
					const metadata = imageModule.default;

					if (import.meta.env.DEV) {
						const relativePath = resolvedPath.replace(
							"/src/content/blog/",
							"/",
						);
						const imageUrl = new URL(relativePath, baseUrl).toString();
						img.setAttribute("src", imageUrl);
					} else {
						const processedImage = await getImage({
							src: metadata,
							format: "webp",
							width: 800,
						});

						img.setAttribute(
							"src",
							new URL(processedImage.src, baseUrl).toString(),
						);
					}
				} catch (error) {
					console.error(
						`[Feed] Image processing failed: ${src} -> ${resolvedPath}`,
						error,
					);
					const relativePath = resolvedPath.replace("/src/content/blog/", "/");
					const imageUrl = new URL(relativePath, baseUrl).toString();
					img.setAttribute("src", imageUrl);
				}
			} else {
				console.warn(`[Feed] Image module not found: ${resolvedPath}`);
				console.warn(
					`[Feed] Available image modules:`,
					Object.keys(imagesGlob),
				);
			}
		} else if (src.startsWith("/")) {
			img.setAttribute("src", new URL(src, baseUrl).toString());
		}
	}

	return root.toString();
}

/**
 * Generate a generic Feed instance
 */
async function generateFeedInstance(
	context: APIContext,
	locale: Locale = defaultLocale,
) {
	const siteUrl = (
		context.site?.toString() || themeConfig.site.website
	).replace(/\/$/, "");
	const { title = "", description = "", author = "" } = themeConfig.site;
	const language = getLanguageTag(locale);

	const localePrefix = locale === defaultLocale ? "" : `/${locale}`;
	const feedUrl = `${siteUrl}${localePrefix}`;

	const feed = new Feed({
		title: title,
		description: description,
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

	const sortedPosts = await getSortedPostsByLocale(locale);

	for (const post of sortedPosts) {
		const slug = getPostSlug(post);
		const postPath =
			locale === defaultLocale ? `/blog/${slug}` : `/${locale}/blog/${slug}`;
		const postUrl = new URL(postPath, siteUrl).toString();
		const rawHtml = markdownParser.render(post.body || "");
		const processedHtml = await fixRelativeImagePaths(
			rawHtml,
			siteUrl,
			post.id,
		);
		const cleanHtml = sanitizeHtml(processedHtml, {
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
			title: post.data.title,
			id: postUrl,
			link: postUrl,
			description: post.data.description || "",
			content: cleanHtml,
			date: post.data.publishedAt,
			published: post.data.publishedAt,
			updated: post.data.updatedAt || post.data.publishedAt,
		});
	}

	return feed;
}

/**
 * Generate RSS 2.0 feed
 */
export async function generateRSS(
	context: APIContext,
	locale: Locale = defaultLocale,
) {
	const feed = await generateFeedInstance(context, locale);
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

/**
 * Generate Atom 1.0 feed
 */
export async function generateAtom(
	context: APIContext,
	locale: Locale = defaultLocale,
) {
	const feed = await generateFeedInstance(context, locale);
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
