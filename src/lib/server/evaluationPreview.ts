import mammoth from 'mammoth';
import JSZip from 'jszip';

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
    .evaluation-preview{font:11pt Arial;line-height:1.2}
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
    .evaluation-preview table:nth-of-type(2) .evaluation-role{font-weight:bold;color:#808080;margin-top:16px}
    .evaluation-preview table:nth-of-type(2) tr:last-child td{padding-top:20px;padding-bottom:24px}
    .evaluation-preview .evaluation-process{font-weight:bold;text-align:justify}
    .evaluation-preview .evaluation-section{font-weight:bold;margin-top:20px}
    .evaluation-preview .evaluation-rule{margin:0}
  </style><div class="evaluation-preview">${logo}${value}</div>`;
}
