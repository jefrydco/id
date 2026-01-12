import type { APIContext } from "astro";
import { generateTalkRSS } from "@/utils/talk-feed";

export const GET = (context: APIContext) => generateTalkRSS(context);
