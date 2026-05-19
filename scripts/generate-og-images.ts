#!/usr/bin/env node

/**
 * Pre-generate OG images for all blog posts and talks at build time.
 * Runs in Node before astro build, so sharp + satori work normally.
 * Output: public/open-graph/{[locale/]blog|talk}/{slug}.png
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { themeConfig } from "../src/config.ts";
import { generateOGImage } from "../src/utils/og-image.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const locales = ["en", "id"] as const;
type Locale = (typeof locales)[number];
const defaultLocale: Locale = "en";

interface ContentEntry {
	locale: Locale;
	slug: string;
	title: string;
	date: Date;
}

async function walkFiles(dir: string): Promise<string[]> {
	const results: string[] = [];
	const items = await fs.readdir(dir, { withFileTypes: true });
	for (const item of items) {
		const itemPath = path.join(dir, item.name);
		if (item.isDirectory()) {
			results.push(...(await walkFiles(itemPath)));
		} else {
			results.push(itemPath);
		}
	}
	return results;
}

async function collectEntries(
	collectionDir: string,
	dateField: "publishedAt" | "startDate",
): Promise<ContentEntry[]> {
	const entries: ContentEntry[] = [];

	for (const locale of locales) {
		const localeDir = path.join(collectionDir, locale);
		try {
			await fs.access(localeDir);
		} catch {
			continue;
		}

		const files = await walkFiles(localeDir);
		for (const file of files) {
			const ext = path.extname(file);
			if (ext !== ".md" && ext !== ".mdx") continue;

			const filename = path.basename(file);
			if (filename.startsWith("_")) continue;

			const relPath = path.relative(localeDir, file);
			const slug = relPath.slice(0, relPath.length - ext.length);

			const raw = await fs.readFile(file, "utf8");
			const { data } = matter(raw);

			const title = data.title;
			const rawDate = data[dateField];

			if (!title || !rawDate) {
				console.warn(`⚠ Skipping ${file}: missing title or ${dateField}`);
				continue;
			}

			entries.push({
				locale,
				slug,
				title,
				date: new Date(rawDate),
			});
		}
	}

	return entries;
}

async function generateForSection(
	entries: ContentEntry[],
	section: "blog" | "talk",
): Promise<number> {
	const bySlug = new Map<string, Map<Locale, ContentEntry>>();
	for (const entry of entries) {
		if (!bySlug.has(entry.slug)) {
			bySlug.set(entry.slug, new Map());
		}
		bySlug.get(entry.slug)?.set(entry.locale, entry);
	}

	let count = 0;
	for (const [slug, translations] of bySlug) {
		for (const locale of locales) {
			const entry = translations.get(locale) ?? translations.get(defaultLocale);
			if (!entry) continue;

			const subPath =
				locale === defaultLocale
					? `${section}/${slug}`
					: `${locale}/${section}/${slug}`;
			const outPath = path.join(
				projectRoot,
				"public/open-graph",
				`${subPath}.png`,
			);

			const png = await generateOGImage(
				entry.title,
				themeConfig.site.title,
				entry.date,
			);

			await fs.mkdir(path.dirname(outPath), { recursive: true });
			await fs.writeFile(outPath, png);
			count++;
		}
	}
	return count;
}

async function main(): Promise<void> {
	const blogEntries = await collectEntries(
		path.join(projectRoot, "src/content/blog"),
		"publishedAt",
	);
	const talkEntries = await collectEntries(
		path.join(projectRoot, "src/content/talk"),
		"startDate",
	);

	console.log(
		`🎨 Generating OG images (${blogEntries.length} blog source entries, ${talkEntries.length} talk source entries)...`,
	);

	const blogCount = await generateForSection(blogEntries, "blog");
	const talkCount = await generateForSection(talkEntries, "talk");

	console.log(`✨ Wrote ${blogCount} blog + ${talkCount} talk OG images`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
