/**
 * Parses bulk MCQ text in format:
 * Question
 * Option A
 * Option B
 * Option C
 * Option D (correct)
 * explanation
 * Explanation text here...
 *
 * (blank line or next "Question" starts next block)
 */
export function parseBulkMcqs(text) {
  const results = [];
  const errors = [];
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 7) {
      errors.push({ blockIndex: i + 1, message: 'Block must have at least question, 4 options, "explanation" line, and explanation text' });
      continue;
    }
    const question = lines[0];
    const optionLines = lines.slice(1, 5);
    let correctIndex = -1;
    const options = optionLines.map((line, idx) => {
      const match = line.match(/^(.*?)\s*\(correct\)\s*$/i);
      if (match) {
        correctIndex = idx;
        return match[1].trim();
      }
      return line;
    });
    if (correctIndex === -1) {
      const lastOpt = optionLines[optionLines.length - 1];
      if (/\(correct\)/i.test(lastOpt)) {
        correctIndex = optionLines.length - 1;
        options[correctIndex] = lastOpt.replace(/\s*\(correct\)\s*$/i, '').trim();
      }
    }
    if (correctIndex === -1) {
      errors.push({ blockIndex: i + 1, message: 'One option must be marked (correct)' });
      continue;
    }
    const explanationLabelIndex = lines.findIndex((l, idx) => idx >= 5 && /^explanation\s*$/i.test(l));
    if (explanationLabelIndex === -1) {
      errors.push({ blockIndex: i + 1, message: '"explanation" line not found after options' });
      continue;
    }
    const explanation = lines.slice(explanationLabelIndex + 1).join(' ').trim() || '';
    results.push({
      question,
      options,
      correctIndex,
      explanation,
    });
  }

  return { mcqs: results, errors };
}
