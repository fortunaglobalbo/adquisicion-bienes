import mammoth from 'mammoth';

export async function tdrPreview(buffer: Buffer): Promise<string> {
  const {value} = await mammoth.convertToHtml({buffer}, {styleMap: [
    "p[style-name='toc 1'] => p.tdr-index-entry:fresh",
  ]});
  let entry = 0;
  return value.replace(/<p class="tdr-index-entry">([\s\S]*?)<\/p>/g, (paragraph, label: string) => {
    const number = /^\s*([1-9]|1[0-4])\.\s+/.exec(label)?.[1];
    if (!number) return paragraph;
    const heading = label.trim().replace(/^\d+\.\s+/, '');
    const notice = entry++ === 0 ? '<p class="tdr-index-notice">Los números de página se calculan al abrir el Word.</p>' : '';
    return `${notice}<p class="tdr-index-entry"><a href="#section_${number}"><span class="tdr-index-number">${number}.</span> ${heading}</a></p>`;
  });
}
