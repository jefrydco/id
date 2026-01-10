import type { APIRoute, GetStaticPaths } from "astro";
import { getAllPostSlugs, getPostBySlug } from "@/utils/i18n-content";
import { defaultLocale } from "@/i18n";

export const getStaticPaths: GetStaticPaths = async () => {
	const slugs = await getAllPostSlugs();
	return slugs.map((slug) => ({
		params: { slug },
		props: { slug },
	}));
};

export const GET: APIRoute = async ({ props }) => {
	const post = await getPostBySlug(props.slug as string, defaultLocale);
	if (!post) {
		return new Response("Not found", { status: 404 });
	}
	return new Response(post.body, {
		headers: { "Content-Type": "text/markdown; charset=utf-8" },
	});
};
