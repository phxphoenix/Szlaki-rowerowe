const POLISH_CHAR_MAP: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
  Ą: "a",
  Ć: "c",
  Ę: "e",
  Ł: "l",
  Ń: "n",
  Ó: "o",
  Ś: "s",
  Ź: "z",
  Ż: "z",
};

const MAX_SLUG_LENGTH = 160;

export function slugify(input: string): string {
  const mapped = Array.from(input, (char) => POLISH_CHAR_MAP[char] ?? char).join("");

  return mapped
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateUniqueSlug(
  title: string,
  existingSlugs: Iterable<string>,
): string {
  const existingSet = new Set(existingSlugs);
  const rawBase = slugify(title) || "szlak";
  const base = rawBase.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "") || "szlak";

  if (!existingSet.has(base)) {
    return base;
  }

  let counter = 2;
  while (true) {
    const suffix = `-${counter}`;
    const trimmedBase =
      base.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/g, "") || "szlak";
    const candidate = `${trimmedBase}${suffix}`;
    if (!existingSet.has(candidate)) {
      return candidate;
    }
    counter += 1;
  }
}
