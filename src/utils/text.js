// Strips emoji and other pictographic symbols from user-entered names.
// \p{Extended_Pictographic} covers the vast majority of emoji; the variation
// selector (️) and zero-width joiner (‍) are stripped too so
// multi-codepoint emoji (flags, skin-tone variants, etc.) don't leave stray
// artifacts behind.
const EMOJI_PATTERN = /[\p{Extended_Pictographic}️‍]/gu;

export const stripEmojis = (value) => value.replace(EMOJI_PATTERN, '');
