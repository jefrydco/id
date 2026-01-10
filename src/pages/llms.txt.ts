import type { APIRoute } from "astro";
import { themeConfig } from "@/config";
import { getPostSlug, getSortedPostsByLocale } from "@/utils/i18n-content";

export const GET: APIRoute = async () => {
	const posts = await getSortedPostsByLocale("en");
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

	const content = `# ${themeConfig.site.title}

> ${themeConfig.site.description}

## Main Pages

- [Home](${baseUrl}/): Landing page with about and recent posts
- [Blog](${baseUrl}/blog/): Full blog listing
- [Search](${baseUrl}/search/): Full-text search
- [Tags](${baseUrl}/blog/tags/): Browse by tags

## Blog Posts (Markdown)

${blogPostsSection}

## Feeds

- [RSS Feed](${baseUrl}/rss.xml): RSS 2.0 feed
- [Atom Feed](${baseUrl}/atom.xml): Atom feed

## Optional

- [Indonesian Home](${baseUrl}/id/): Indonesian version
- [Indonesian Blog](${baseUrl}/id/blog/): Indonesian blog posts
`;

	return new Response(content, {
		headers: { "Content-Type": "text/markdown; charset=utf-8" },
	});
};
