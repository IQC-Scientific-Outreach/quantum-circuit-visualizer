/**
 * Utility for encoding and decoding student practice packages (.qpkg).
 * 
 * We use Base64 encoding to obfuscate the answers so students don't accidentally
 * see them if they open the file in a text editor.
 */

export function encodeStudentPackage(questions, meta = {}) {
  const payload = {
    version: 1,
    meta: {
      title: meta.title || 'Practice Questions',
      createdAt: new Date().toISOString()
    },
    questions
  };

  const jsonStr = JSON.stringify(payload);
  const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
  return `QPKG\n${encoded}`;
}

export function decodeStudentPackage(fileContent) {
  if (!fileContent || typeof fileContent !== 'string') throw new Error('Invalid package file format.');
  const parts = fileContent.split('\n');
  if (parts[0] !== 'QPKG' || parts.length < 2) throw new Error('Not a valid Quantum Practice Package (.qpkg). Ensure you uploaded the correct file.');
  try {
    const payload = JSON.parse(decodeURIComponent(escape(atob(parts[1]))));
    if (!payload.questions || !Array.isArray(payload.questions)) throw new Error('Package contains no valid questions.');
    return payload;
  } catch (err) { throw new Error('Could not decode the package. The file might be corrupted or modified.'); }
}