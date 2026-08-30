export function normalizeMatchingText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[¿?¡!,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

export function isCloseWord(input: string, candidate: string) {
  if (input.length < 4 || Math.abs(input.length - candidate.length) > 2) return false;
  const maxDistance = Math.max(input.length, candidate.length) >= 7 ? 2 : 1;
  return levenshteinDistance(input, candidate) <= maxDistance;
}

export function normalizeCommandText(text: string, knownWords: string[]) {
  const normalized = normalizeMatchingText(text);
  return normalized
    .split(" ")
    .map((word) => {
      const match = knownWords.find((candidate) => isCloseWord(word, candidate));
      return match ?? word;
    })
    .join(" ");
}
