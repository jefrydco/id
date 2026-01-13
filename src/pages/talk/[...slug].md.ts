import type { APIRoute, GetStaticPaths } from "astro";
import { defaultLocale } from "@/i18n";
import { getAllTalkSlugs, getTalkBySlug } from "@/utils/i18n-talk-content";

export const getStaticPaths: GetStaticPaths = async () => {
	const slugs = await getAllTalkSlugs();
	return slugs.map((slug) => ({
		params: { slug },
		props: { slug },
	}));
};

export const GET: APIRoute = async ({ props }) => {
	const talk = await getTalkBySlug(props.slug as string, defaultLocale);
	if (!talk) {
		return new Response("Not found", { status: 404 });
	}
	return new Response(talk.body, {
		headers: { "Content-Type": "text/markdown; charset=utf-8" },
	});
};
