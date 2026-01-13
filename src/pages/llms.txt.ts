import type { APIRoute } from "astro";
import { themeConfig } from "@/config";
import { getPostSlug, getSortedPostsByLocale } from "@/utils/i18n-content";
import { getTalkSlug, getSortedTalksByLocale } from "@/utils/i18n-talk-content";
import { getNoteSlug, getSortedNotesByLocale } from "@/utils/i18n-notes";

export const GET: APIRoute = async () => {
	const posts = await getSortedPostsByLocale("en");
	const talks = await getSortedTalksByLocale("en");
	const notes = await getSortedNotesByLocale("en");
	const baseUrl = themeConfig.site.website.replace(/\/$/, "");

	const blogPostsSection = posts
		.map((post) => {
			const slug = getPostSlug(post);
			const description = post.data.description
				? `: ${post.data.description}`
				: "";
			return `- [${post.data.title}](${baseUrl}/blog/${slug}.md)${description}`;
		})
		.join("\n");

	const talksSection = talks
		.map((talk) => {
			const slug = getTalkSlug(talk);
			const description = talk.data.description
				? `: ${talk.data.description}`
				: "";
			return `- [${talk.data.title}](${baseUrl}/talk/${slug}.md)${description}`;
		})
		.join("\n");

	const notesSection = notes
		.map((note) => {
			const slug = getNoteSlug(note);
			const description = note.data.description
				? `: ${note.data.description}`
				: "";
			return `- [${note.data.title}](${baseUrl}/notes/${slug}.md)${description}`;
		})
		.join("\n");

	const content = `# ${themeConfig.site.title}

> ${themeConfig.site.description}

## Main Pages

- [Home](${baseUrl}/): Landing page with about and recent posts
- [Blog](${baseUrl}/blog/): Full blog listing
- [Talks](${baseUrl}/talk/): Conference talks and presentations
- [Notes](${baseUrl}/notes/): Quick notes and tips
- [Search](${baseUrl}/search/): Full-text search

## Blog Posts (Markdown)

${blogPostsSection}

## Talks (Markdown)

${talksSection}

## Notes (Markdown)

${notesSection}

## Feeds

- [Blog RSS Feed](${baseUrl}/blog/rss.xml): Blog RSS 2.0 feed
- [Blog Atom Feed](${baseUrl}/blog/atom.xml): Blog Atom feed
- [Talks RSS Feed](${baseUrl}/talk/rss.xml): Talks RSS 2.0 feed
- [Talks Atom Feed](${baseUrl}/talk/atom.xml): Talks Atom feed
- [Notes RSS Feed](${baseUrl}/notes/rss.xml): Notes RSS 2.0 feed
- [Notes Atom Feed](${baseUrl}/notes/atom.xml): Notes Atom feed

## Optional

- [Indonesian Home](${baseUrl}/id/): Indonesian version
- [Indonesian Blog](${baseUrl}/id/blog/): Indonesian blog posts
- [Indonesian Talks](${baseUrl}/id/talk/): Indonesian talks
- [Indonesian Notes](${baseUrl}/id/notes/): Indonesian notes
`;

	return new Response(content, {
		headers: { "Content-Type": "text/markdown; charset=utf-8" },
	});
};
