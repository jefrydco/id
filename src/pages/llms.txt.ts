import type { APIRoute } from "astro";
import { themeConfig } from "@/config";
import { getPostSlug, getSortedPostsByLocale } from "@/utils/i18n-content";
import { getNoteSlug, getSortedNotesByLocale } from "@/utils/i18n-notes";
import { getSortedTalksByLocale, getTalkSlug } from "@/utils/i18n-talk-content";

export const GET: APIRoute = async () => {
	const postsEn = await getSortedPostsByLocale("en");
	const postsId = await getSortedPostsByLocale("id");
	const talksEn = await getSortedTalksByLocale("en");
	const talksId = await getSortedTalksByLocale("id");
	const notesEn = await getSortedNotesByLocale("en");
	const notesId = await getSortedNotesByLocale("id");
	const baseUrl = themeConfig.site.website.replace(/\/$/, "");

	const blogPostsEnSection = postsEn
		.map((post) => {
			const slug = getPostSlug(post);
			const description = post.data.description
				? `: ${post.data.description}`
				: "";
			return `- [${post.data.title}](${baseUrl}/blog/${slug}.md)${description}`;
		})
		.join("\n");

	const blogPostsIdSection = postsId
		.map((post) => {
			const slug = getPostSlug(post);
			const description = post.data.description
				? `: ${post.data.description}`
				: "";
			return `- [${post.data.title}](${baseUrl}/id/blog/${slug}.md)${description}`;
		})
		.join("\n");

	const talksEnSection = talksEn
		.map((talk) => {
			const slug = getTalkSlug(talk);
			const description = talk.data.description
				? `: ${talk.data.description}`
				: "";
			return `- [${talk.data.title}](${baseUrl}/talk/${slug}.md)${description}`;
		})
		.join("\n");

	const talksIdSection = talksId
		.map((talk) => {
			const slug = getTalkSlug(talk);
			const description = talk.data.description
				? `: ${talk.data.description}`
				: "";
			return `- [${talk.data.title}](${baseUrl}/id/talk/${slug}.md)${description}`;
		})
		.join("\n");

	const notesEnSection = notesEn
		.map((note) => {
			const slug = getNoteSlug(note);
			const description = note.data.description
				? `: ${note.data.description}`
				: "";
			return `- [${note.data.title}](${baseUrl}/notes/${slug}.md)${description}`;
		})
		.join("\n");

	const notesIdSection = notesId
		.map((note) => {
			const slug = getNoteSlug(note);
			const description = note.data.description
				? `: ${note.data.description}`
				: "";
			return `- [${note.data.title}](${baseUrl}/id/notes/${slug}.md)${description}`;
		})
		.join("\n");

	const blogTagsEn = [
		...new Set(postsEn.flatMap((post) => post.data.tags)),
	].sort();
	const blogTagsId = [
		...new Set(postsId.flatMap((post) => post.data.tags)),
	].sort();
	const talkTagsEn = [
		...new Set(talksEn.flatMap((talk) => talk.data.tags)),
	].sort();
	const talkTagsId = [
		...new Set(talksId.flatMap((talk) => talk.data.tags)),
	].sort();
	const notesTagsEn = [
		...new Set(notesEn.flatMap((note) => note.data.tags)),
	].sort();
	const notesTagsId = [
		...new Set(notesId.flatMap((note) => note.data.tags)),
	].sort();

	const blogTagsEnSection = blogTagsEn
		.map((tag) => `- [${tag}](${baseUrl}/blog/tags/${tag}/)`)
		.join("\n");

	const blogTagsIdSection = blogTagsId
		.map((tag) => `- [${tag}](${baseUrl}/id/blog/tags/${tag}/)`)
		.join("\n");

	const talkTagsEnSection = talkTagsEn
		.map((tag) => `- [${tag}](${baseUrl}/talk/tags/${tag}/)`)
		.join("\n");

	const talkTagsIdSection = talkTagsId
		.map((tag) => `- [${tag}](${baseUrl}/id/talk/tags/${tag}/)`)
		.join("\n");

	const notesTagsEnSection = notesTagsEn
		.map((tag) => `- [${tag}](${baseUrl}/notes/tags/${tag}/)`)
		.join("\n");

	const notesTagsIdSection = notesTagsId
		.map((tag) => `- [${tag}](${baseUrl}/id/notes/tags/${tag}/)`)
		.join("\n");

	const content = `# ${themeConfig.site.title}

> ${themeConfig.site.description}

## Main Pages

- [Home](${baseUrl}/): Landing page with about and recent posts
- [Blog](${baseUrl}/blog/): Full blog listing
- [Talks](${baseUrl}/talk/): Conference talks and presentations
- [Notes](${baseUrl}/notes/): Quick notes and tips
- [Search](${baseUrl}/search/): Full-text search

## Blog Posts

### English

${blogPostsEnSection}

### Indonesian

${blogPostsIdSection}

## Talks

### English

${talksEnSection}

### Indonesian

${talksIdSection}

## Notes

### English

${notesEnSection}

### Indonesian

${notesIdSection}

## Tags

### Blog Tags

#### English

${blogTagsEnSection}

#### Indonesian

${blogTagsIdSection}

### Talk Tags

#### English

${talkTagsEnSection}

#### Indonesian

${talkTagsIdSection}

### Notes Tags

#### English

${notesTagsEnSection}

#### Indonesian

${notesTagsIdSection}

## Feeds

### Blog

- [RSS](${baseUrl}/blog/rss.xml)
- [Atom](${baseUrl}/blog/atom.xml)
- [RSS Indonesian](${baseUrl}/id/blog/rss.xml)
- [Atom Indonesian](${baseUrl}/id/blog/atom.xml)

### Talks

- [RSS](${baseUrl}/talk/rss.xml)
- [Atom](${baseUrl}/talk/atom.xml)
- [RSS Indonesian](${baseUrl}/id/talk/rss.xml)
- [Atom Indonesian](${baseUrl}/id/talk/atom.xml)

### Notes

- [RSS](${baseUrl}/notes/rss.xml)
- [Atom](${baseUrl}/notes/atom.xml)
- [RSS Indonesian](${baseUrl}/id/notes/rss.xml)
- [Atom Indonesian](${baseUrl}/id/notes/atom.xml)
`;

	return new Response(content, {
		headers: { "Content-Type": "text/markdown; charset=utf-8" },
	});
};
