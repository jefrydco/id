import type { APIRoute, GetStaticPaths } from "astro";
import { defaultLocale } from "@/i18n";
import { getAllNoteSlugs, getNoteBySlug } from "@/utils/i18n-notes";

export const getStaticPaths: GetStaticPaths = async () => {
	const slugs = await getAllNoteSlugs();
	return slugs.map((slug) => ({
		params: { slug },
		props: { slug },
	}));
};

export const GET: APIRoute = async ({ props }) => {
	const note = await getNoteBySlug(props.slug as string, defaultLocale);
	if (!note) {
		return new Response("Not found", { status: 404 });
	}
	return new Response(note.body, {
		headers: { "Content-Type": "text/markdown; charset=utf-8" },
	});
};
