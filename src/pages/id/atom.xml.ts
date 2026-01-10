import type { APIContext } from "astro";
import { generateAtom } from "@/utils/feed";

export const GET = (context: APIContext) => generateAtom(context, "id");
