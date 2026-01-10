import type { APIContext } from "astro";
import { generateRSS } from "@/utils/feed";

export const GET = (context: APIContext) => generateRSS(context);
