import type { APIContext } from "astro";
import { generateTalkAtom } from "@/utils/talk-feed";

export const GET = (context: APIContext) => generateTalkAtom(context);
