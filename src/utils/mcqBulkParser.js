/**
 * Parser engine for bulk MCQs with explanations and optional YouTube video links.
 *
 * Supported formats (blocks separated by blank line or numbered 1. 2. 3.):
 *
 * Format A (minimal):
 *   Question text
 *   Option A
 *   Option B (correct)
 *   Option C
 *   Option D
 *   explanation
 *   Explanation text here...
 *   video: https://youtube.com/watch?v=...
 *
 * Format B (numbered):
 *   1. Question text?
 *   A) Option A
 *   B) Option B
 *   C) Option C (correct)
 *   D) Option D
 *   Explanation: Your explanation here.
 *   Video: https://youtu.be/...
 *
 * Format C (label-style):
 *   Q. Question text
 *   a. Option A
 *   b. Option B (c)
 *   c. Option C
 *   d. Option D
 *   Explanation
 *   Explanation paragraph...
 *
 * Format D (medical / checkmark):
 *   Topic 16: Title
 *   61. Question text?
 *   A. Option A
 *   B. Option B
 *   C. Option C   ✓
 *   D. Option D
 *   Explanation:
 *   Explanation text.
 *
 * Rules:
 * - One option must be marked (correct), (c), (right), or ✓ / ✔.
 * - "explanation" / "Explanation:" starts explanation; rest of block or until "video:" is explanation text.
 * - "video:" / "Video:" / "youtube:" line gives videoUrl (optional).
 * - Minimum: question + at least 2 options + one marked correct.
 */

const OPTION_PREFIX = /^[a-dA-D][\.\)]\s*/;
const QUESTION_PREFIX = /^(\d+[\.\)]\s*|Q\.?\s*|Question\s*:?\s*)/i;
const CORRECT_MARKERS = /\s*\((correct|c|right)\)\s*$/i;
const CHECKMARK_MARKERS = /\s*[✓✔]\s*$/;  // Unicode checkmark or heavy checkmark
const EXPLANATION_LABEL = /^(explanation|explanation\s*:)\s*$/im;
const EXPLANATION_LINE = /^Explanation\s*:?\s*/im;
const VIDEO_LABEL = /^(video|youtube)\s*:?\s*(https?:\S+)\s*$/im;
const YOUTUBE_URL = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function extractYouTubeUrl(line) {
  const match = line.match(VIDEO_LABEL) || line.match(/^(https?:\S*youtube\S+)\s*$/im);
  if (match) {
    const url = (match[2] || match[1] || '').trim();
    if (url) return url;
  }
  if (/https?:\S+/.test(line)) {
    const u = line.replace(/^(video|youtube)\s*:?\s*/i, '').trim();
    if (YOUTUBE_URL.test(u) || u.includes('youtube') || u.includes('youtu.be')) return u;
  }
  return null;
}

function normalizeOption(line) {
  let cleaned = line.replace(CORRECT_MARKERS, '').replace(CHECKMARK_MARKERS, '').trim();
  cleaned = cleaned.replace(OPTION_PREFIX, '').trim() || cleaned;
  return cleaned;
}

function isCorrectMarker(line) {
  return /\((correct|c|right)\)\s*$/i.test(line) || /\s*[✓✔]\s*$/.test(line);
}

/**
 * Split raw text into blocks (one per MCQ).
 * Blocks are separated by double newline or by numbered lines "1. " "2. " "61. " etc.
 * Normalize so "  61. " or " 62. " mid-line is treated as block start (e.g. "Topic 16: ...  61. Q" -> newline before 61).
 */
function splitBlocks(text) {
  let trimmed = text.trim();
  if (!trimmed) return [];

  // Normalize: ensure question numbers at line start (e.g. "Topic 16: ...  61. Question" -> "... \n61. Question")
  trimmed = trimmed.replace(/\s+(\d+[\.\)]\s+)/g, '\n$1');

  // Numbered blocks: 1. ... 2. ... 61. ... (number at start of line or after newline)
  const numberedSplit = trimmed.split(/(?:^|\n)\s*(\d+[\.\)]\s*)/).filter(Boolean);
  if (numberedSplit.length > 1) {
    const blocks = [];
    // First segment may be topic header (e.g. "Topic 16: Oogenesis..."); skip until we see "61. " etc.
    for (let i = 1; i < numberedSplit.length; i += 2) {
      const num = numberedSplit[i];
      const rest = (numberedSplit[i + 1] || '').trim();
      const block = (num + rest).trim();
      if (block.length < 10) continue;
      blocks.push(block);
    }
    if (blocks.length > 0) return blocks;
  }

  // Fallback: double-newline blocks
  return trimmed.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
}

/**
 * Split a single-line block into virtual lines by option/explanation boundaries.
 * E.g. "61. Question  A. OptA  B. OptB  C. OptC ✓  D. OptD  Explanation:  Text"
 * -> ["61. Question", "A. OptA", "B. OptB", "C. OptC ✓", "D. OptD", "Explanation:  Text"]
 */
function splitBlockIntoLines(block) {
  const trimmed = block.trim();
  if (!trimmed) return [];
  const byNewline = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  if (byNewline.length >= 3) return byNewline;
  const singleLine = trimmed.replace(/\s*\n\s*/g, ' ').trim();
  const parts = singleLine.split(/\s{2,}(?=[A-D]\.\s|Explanation\s*:)/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return parts;
  return byNewline;
}

/**
 * Parse a single block into { question, options, correctIndex, explanation, videoUrl }.
 */
function parseBlock(block, blockIndex) {
  const lines = splitBlockIntoLines(block);
  if (lines.length < 3) {
    return { error: `Block ${blockIndex + 1}: need at least question and 2 options` };
  }

  // Find question (first line, or after "Q." / "1." etc.)
  let question = lines[0].replace(QUESTION_PREFIX, '').trim() || lines[0];
  let start = 1;

  // Collect option lines (typically next 4 lines; stop at "explanation" / "Explanation:" / "video")
  const optionLines = [];
  let explanationStart = -1;
  let videoUrl = null;

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (/^explanation\s*:?\s*$/i.test(line)) {
      explanationStart = i + 1;
      break;
    }
    if (/^Explanation\s*:?\s*/i.test(line)) {
      explanationStart = i;
      break;
    }
    const video = extractYouTubeUrl(line);
    if (video) {
      videoUrl = video;
      continue;
    }
    if (/^(video|youtube)\s*:/i.test(line)) {
      videoUrl = extractYouTubeUrl(line) || line.replace(/^(video|youtube)\s*:?\s*/i, '').trim();
      continue;
    }
    if (optionLines.length < 6) optionLines.push(line);
  }

  // If we found "Explanation:" on a line, explanation starts from that line (rest of line + next lines)
  if (explanationStart === -1) {
    const explIdx = lines.findIndex((l, idx) => idx >= 1 && /^Explanation\s*:?\s*/i.test(l));
    if (explIdx !== -1) {
      explanationStart = explIdx;
    }
  }

  // Options: take up to 6 lines; one must have (correct). Usually 4 options.
  let correctIndex = -1;
  const options = [];
  for (let i = 0; i < optionLines.length; i++) {
    const line = optionLines[i];
    if (isCorrectMarker(line)) {
      if (correctIndex === -1) correctIndex = i;
      options.push(normalizeOption(line));
    } else {
      options.push(normalizeOption(line));
    }
  }

  // If no (correct) found, check last option or first with (c)
  if (correctIndex === -1) {
    for (let i = 0; i < optionLines.length; i++) {
      if (isCorrectMarker(optionLines[i])) {
        correctIndex = i;
        options[i] = normalizeOption(optionLines[i]);
        break;
      }
    }
  }

  // Prefer exactly 4 options: if we have more, take first 4; if less, pad or use as-is (min 2)
  let finalOptions = options.slice(0, 6).filter(Boolean);
  let partial = false;
  if (finalOptions.length < 2) {
    partial = true;
    finalOptions = ['(No options parsed – edit to add)', '(Add options in edit)'];
    correctIndex = 0;
  } else if (correctIndex < 0 || correctIndex >= finalOptions.length) {
    correctIndex = 0;
  }

  // Explanation: from explanationStart to end (excluding video line)
  let explanation = '';
  if (explanationStart >= 0 && explanationStart < lines.length) {
    const explLines = [];
    for (let j = explanationStart; j < lines.length; j++) {
      const ln = lines[j];
      if (extractYouTubeUrl(ln)) continue;
      if (/^(video|youtube)\s*:/i.test(ln)) continue;
      explLines.push(ln.replace(/^Explanation\s*:?\s*/i, ''));
    }
    explanation = explLines.join(' ').trim();
    // Strip trailing next-question bleed: ".62." or ".62. Oogenesis..." or " 62. O..."
    explanation = explanation.replace(/\s*\d+\.\s+[A-Z].*$/g, '').trim();
    explanation = explanation.replace(/\.\d{2,}\.\s*.*$/g, '.').trim();
    explanation = explanation.replace(/\.\d\.\s+[A-Z].*$/g, '.').trim();
  }

  return {
    question,
    options: finalOptions,
    correctIndex,
    explanation,
    videoUrl: videoUrl || undefined,
    partial,
  };
}

/**
 * Parse bulk MCQ text. Returns { mcqs: [...], errors: [...], partialBlockIndices: [...] }.
 * partialBlockIndices: 1-based block numbers that were parsed without options (placeholder options added).
 */
export function parseBulkMcqs(text) {
  const results = [];
  const errors = [];
  const partialBlockIndices = [];
  const blocks = splitBlocks(text);

  for (let i = 0; i < blocks.length; i++) {
    const parsed = parseBlock(blocks[i], i);
    if (parsed.error) {
      errors.push({ blockIndex: i + 1, message: parsed.error });
      continue;
    }
    if (parsed.partial) partialBlockIndices.push(i + 1);
    results.push({
      question: parsed.question,
      options: parsed.options,
      correctIndex: parsed.correctIndex,
      explanation: parsed.explanation || '',
      videoUrl: parsed.videoUrl || '',
    });
  }

  return { mcqs: results, errors, partialBlockIndices };
}
