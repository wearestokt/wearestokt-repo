/**
 * Token stream: parses the user's word/data input into a deterministic,
 * cycling list of whole readable tokens.
 */

export type WordOrder = "random" | "sequential";

export function hashUint(a: number, b: number, seed: number): number {
  let h =
    (Math.imul(a | 0, 374_761_393) +
      Math.imul(b | 0, 668_265_263) +
      Math.imul(seed | 0, 0x9e_37_79_b1)) |
    0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1_274_126_177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_295;
}

export function parseTokens(text: unknown): string[] {
  if (typeof text !== "string") {
    return [];
  }
  return text
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export type TokenStream = {
  next: () => string;
  peek: () => string;
  size: number;
};

/**
 * Sequential order cycles the list in input order; random order picks a
 * seeded shuffled walk so the same seed always produces the same texture.
 */
export function createTokenStream(
  tokens: readonly string[],
  order: WordOrder,
  seed: number,
): TokenStream {
  if (tokens.length === 0) {
    return { next: () => "", peek: () => "", size: 0 };
  }

  let index = 0;
  let draw = 0;

  const pick = (position: number): string => {
    if (order === "random") {
      const roll = hashUint(position, position >> 5, seed + 101);
      return tokens[Math.floor(roll * tokens.length) % tokens.length]!;
    }
    return tokens[position % tokens.length]!;
  };

  return {
    next: () => {
      const token = pick(order === "random" ? draw : index);
      index += 1;
      draw += 1;
      return token;
    },
    peek: () => pick(order === "random" ? draw : index),
    size: tokens.length,
  };
}

export function applyTextCase(
  token: string,
  textCase: "capitalize" | "lowercase" | "original" | "titleCase" | "uppercase",
): string {
  switch (textCase) {
    case "uppercase":
      return token.toUpperCase();
    case "lowercase":
      return token.toLowerCase();
    case "capitalize":
    case "titleCase":
      return token.length > 0
        ? token[0]!.toUpperCase() + token.slice(1).toLowerCase()
        : token;
    case "original":
    default:
      return token;
  }
}
