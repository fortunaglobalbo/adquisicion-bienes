import mammoth from 'mammoth';
import JSZip from 'jszip';

function alignDateLine(html: string): string {
  return html.replace(/<p class="(payment-date|conformity-date)">([\s\S]*?)<\/p>/, (original, className, text: string) => {
    const parts = text.replace(/<\/?strong>/g, '').split('\t');
    return parts.length === 2 ? `<p class="${className}"><span>${parts[0]}</span><span>${parts[1]}</span></p>` : original;
  });
}

export async function paymentPreview(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const image = zip.file('word/media/image2.png');
  const logo = image ? `<img class="payment-header-logo" alt="ENDE DEORURO S.A." src="data:image/png;base64,${await image.async('base64')}">` : '';
  const { value } = await mammoth.convertToHtml({ buffer }, { styleMap: [
    "p[style-name='Payment Title'] => p.payment-title:fresh",
    "p[style-name='Payment Date'] => p.payment-date:fresh",
    "p[style-name='Payment Reference'] => p.payment-reference:fresh",
    "p[style-name='Payment Subject'] => p.payment-subject:fresh",
    "p[style-name='Payment Body Logo'] => p.payment-body-logo:fresh",
    "p[style-name='Payment Body'] => p.payment-body:fresh",
  ] });
  const arranged = alignDateLine(value)
    .replace(/(<p class="payment-body-logo">[\s\S]*?<\/p>)(<p class="payment-body">[\s\S]*?<\/p>)/, '<div class="payment-intro">$1$2</div>');
  return `<div class="payment-preview">${logo}${arranged}</div>`;
}

/** The institutional reference block uses native Word styles also mapped in the preview. */
export async function evaluationPreview(buffer: Buffer): Promise<string> {
  // Mammoth omits running headers. Read the logo from this generated Word, not an external URL.
  const zip=await JSZip.loadAsync(buffer);
  const image=Object.keys(zip.files).find(name=>/^word\/media\/[^/]+\.png$/i.test(name));
  const logo=image ? `<p><img alt="ENDE DEORURO" src="data:image/png;base64,${await zip.file(image)!.async('base64')}"></p>` : '';
  const {value} = await mammoth.convertToHtml({buffer}, {styleMap: [
    "p[style-name='Evaluation Title'] => p.evaluation-title:fresh",
    "p[style-name='Evaluation Form'] => p.evaluation-form:fresh",
    "p[style-name='Evaluation Name'] => p.evaluation-name:fresh",
    "p[style-name='Evaluation Role'] => p.evaluation-role:fresh",
    "p[style-name='Evaluation Process'] => p.evaluation-process:fresh",
    "p[style-name='Evaluation Rule'] => p.evaluation-rule:fresh",
    "p[style-name='Evaluation Section'] => p.evaluation-section:fresh",
  ], ignoreEmptyParagraphs: false});
  return `<style>
    .evaluation-preview{font:11pt Tahoma,sans-serif;line-height:1.2}
    .evaluation-preview img{width:140px;max-width:140px;max-height:none;margin:0 0 28px 0}
    .evaluation-preview .evaluation-title{text-align:center;font-weight:bold;margin:0}
    .evaluation-preview .evaluation-form{text-align:center;margin:0 0 22px}
    .evaluation-preview table:nth-of-type(1){background:#eee;margin:0 0 20px}
    .evaluation-preview table:nth-of-type(1) td{border:0;padding:0 2px;width:50%;font-weight:bold}
    .evaluation-preview table:nth-of-type(1) td:last-child{text-align:right}
    .evaluation-preview table:nth-of-type(1) p{margin:0}
    .evaluation-preview table:nth-of-type(2){margin:0 0 24px;border-bottom:5px double #000}
    .evaluation-preview table:nth-of-type(2) td{border:0;padding:0;vertical-align:top}
    .evaluation-preview table:nth-of-type(2) td:first-child{width:14.2%;white-space:nowrap}
    .evaluation-preview table:nth-of-type(2) p{margin:0}
    .evaluation-preview table:nth-of-type(2) .evaluation-name{font-weight:bold}
    .evaluation-preview table:nth-of-type(2) .evaluation-role{font-weight:bold;color:#808080;margin:0}
    .evaluation-preview table:nth-of-type(2) tr:not(:last-child) td{padding-bottom:6px}
    .evaluation-preview table:nth-of-type(2) tr:last-child td{padding-top:20px;padding-bottom:24px}
    .evaluation-preview .evaluation-process{font-weight:bold;text-align:justify}
    .evaluation-preview .evaluation-section{font-weight:bold;margin-top:20px}
    .evaluation-preview .evaluation-rule{margin:0}
  </style><div class="evaluation-preview">${logo}${value}</div>`;
}

/** The attached Word formats carry their logo in the header, which Mammoth skips. */
export async function institutionalReportPreview(buffer: Buffer, model: number): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const image = [5,7,9].includes(model) ? zip.file('word/media/image1.png') : null;
  const logo = image ? `<img class="report-logo${model === 7 ? ' conformity-logo' : ''}" alt="ENDE DEORURO" src="data:image/png;base64,${await image.async('base64')}">` : '';
  const {value} = await mammoth.convertToHtml({buffer}, model === 7 ? {styleMap: [
    "p[style-name='Conformity Date'] => p.conformity-date:fresh",
    "p[style-name='Conformity Reference'] => p.conformity-reference:fresh",
  ]} : model === 9 ? {styleMap:[
    "p[style-name='Technical Date'] => p.conformity-date:fresh",
  ]} : undefined);
  return `<style>
    .institutional-report{font-family:Tahoma,sans-serif;line-height:1.3}
    .institutional-report .report-logo{width:160px;margin-bottom:14px}
    .institutional-report table:first-of-type{margin:12px 0}
    .institutional-report table:first-of-type p{margin:0}
  </style><div class="institutional-report">${logo}${[7,9].includes(model) ? alignDateLine(value) : value}</div>`;
}
