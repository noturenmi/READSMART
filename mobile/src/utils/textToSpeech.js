const htmlEntities = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

function decodeHtmlEntities(text) {
  return text
    .replace(/&([a-z]+);/giu, (match, name) => htmlEntities[name.toLowerCase()] ?? match)
    .replace(/&#(?:x([\da-f]+)|(\d+));?/giu, (match, hex, decimal) => {
      const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : '';
    });
}

function cleanSpeechText(value) {
  if (typeof value !== 'string') return '';
  return decodeHtmlEntities(value
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/giu, ' ')
    .replace(/<\/?[a-z][^>]*>/giu, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/!?\[([^\]]*)\]\[[^\]]*\]/gu, '$1')
    .replace(/https?:\/\/\S+|www\.\S+/giu, ' ')
    .replace(/\b[a-f\d]{24}\b/giu, ' ')
    .replace(/\b[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}\b/giu, ' ')
    .replace(/```|~~~|`/gu, '')
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/gu, '$1$2')
    .replace(/\*([^*\n]+)\*|_([^_\n]+)_/gu, '$1$2')
    .replace(/^\s{0,3}#{1,6}\s*/gmu, '')
    .replace(/^\s*>\s?/gmu, '')
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/gmu, '')
    .replace(/^\s*[•▪◦‣]\s*/gmu, '')
    .replace(/[|~^]/gu, ' ')
    .replace(/[\t ]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim());
}

function lessonToSpeechText(lesson) {
  if (!lesson || typeof lesson !== 'object') return '';
  const sections = [];
  const addSection = (heading, content) => {
    const clean = cleanSpeechText(content);
    if (clean) sections.push(`${heading}\n${clean}`);
  };

  addSection('', lesson.title);
  addSection('Overview', lesson.overview);
  addSection('Lesson', lesson.lesson);
  addSection('Discussion', lesson.discussion);
  addSection('Example', lesson.example);
  if (Array.isArray(lesson.keyConcepts)) {
    addSection('Key Concepts', lesson.keyConcepts.map(cleanSpeechText).filter(Boolean).join('. '));
  }
  addSection('Key Takeaway', lesson.keyTakeaway);
  return sections.join('\n\n').replace(/^\n/u, '').trim();
}

function splitSpeechText(text, maxLength = 3000) {
  const safeMax = Number.isInteger(maxLength) && maxLength > 100 ? maxLength : 3000;
  const remainingText = cleanSpeechText(text);
  if (!remainingText) return [];
  const chunks = [];
  let remaining = remainingText;

  while (remaining.length > safeMax) {
    const window = remaining.slice(0, safeMax + 1);
    const floor = Math.floor(safeMax * 0.55);
    const sentenceBreaks = [
      window.lastIndexOf('. ', safeMax),
      window.lastIndexOf('! ', safeMax),
      window.lastIndexOf('? ', safeMax),
      window.lastIndexOf('\n', safeMax),
    ].map((index) => index < 0 ? -1 : index + 1).filter((index) => index >= floor);
    const whitespaceBreak = window.lastIndexOf(' ', safeMax);
    const cut = sentenceBreaks.length
      ? Math.max(...sentenceBreaks)
      : whitespaceBreak >= floor ? whitespaceBreak : safeMax;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trimStart();
  }

  if (remaining) chunks.push(remaining);
  return chunks.filter(Boolean);
}

module.exports = { cleanSpeechText, lessonToSpeechText, splitSpeechText };
