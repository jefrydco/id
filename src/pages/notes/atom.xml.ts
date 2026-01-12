import type { APIContext } from "astro";
import { generateNotesAtom } from "@/utils/notes-feed";

export const GET = (context: APIContext) => generateNotesAtom(context);
