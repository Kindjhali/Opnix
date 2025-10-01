export function stripHtmlToText(html = '') {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = div.textContent || div.innerText || '';
  return text.replace(/\n{2,}/g, '\n\n').trim();
}

export function downloadMarkdownFile(filename, content) {
  const safeName = filename && filename.trim() ? filename : 'opnix-export.md';
  const blob = new Blob([content], { type: 'text/markdown' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = safeName;
  link.click();
  URL.revokeObjectURL(link.href);
}
