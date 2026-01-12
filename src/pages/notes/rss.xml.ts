import type { APIContext } from "astro";
import { generateNotesRSS } from "@/utils/notes-feed";

export const GET = (context: APIContext) => generateNotesRSS(context);
