/**
 * MedMCQA text contains stray HTML from its web sources (`<p>`, `<img>`, `<a>`…)
 * and a few entities. Strip known tags only, so clinical text such as
 * "age <5 years" or "K+ <3.5" is never mangled.
 */
const TAGS = "p|br|img|a|li|ul|ol|b|i|u|em|strong|span|div|sup|sub|table|tr|td|th|tbody|thead|h[1-6]|hr|font|center";
const TAG_RE = new RegExp(`</?(?:${TAGS})(?:\\s[^<>]*)?/?>`, "gi");

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function cleanText(input: string): string {
  return input
    .replace(/<\/p>|<br\s*\/?>/gi, "\n")
    .replace(TAG_RE, "")
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanOptional(input: string | null): string | null {
  if (input === null) return null;
  const out = cleanText(input);
  return out === "" ? null : out;
}
