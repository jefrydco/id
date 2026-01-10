import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
	loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
	schema: () =>
		z.object({
			title: z.string(),
			description: z.string().optional(),
			publishedAt: z.coerce.date(),
			updatedAt: z.coerce.date().optional(),
			image: z.string().optional(),
			tags: z.array(z.string()),
		}),
});

const about = defineCollection({
	loader: glob({ base: "./src/content/about", pattern: "**/*.md" }),
	schema: z.object({}),
});

const talk = defineCollection({
	loader: glob({ base: "./src/content/talk", pattern: "**/*.{md,mdx}" }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			poster: image(),
			slide: z.string().optional(),
			playback: z.string().optional(),
			sourceCode: z.string().optional(),
			writeUp: z.string().optional(),
			startDate: z.coerce.date(),
			endDate: z.coerce.date(),
			organizer: z.string(),
			organizerUrl: z.string().optional(),
			tags: z.array(z.string()),
		}),
});

export const collections = { blog, about, talk };
