/** Opens a clean window containing `html` with the app's styles, then shows the print dialog ("Save as PDF"). */
export function printHtmlAsPdf(title: string, html: string) {
  const w = window.open("", "_blank");
  if (!w) return false;
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => n.outerHTML)
    .join("\n");
  const safeTitle = title.replace(/[<>&]/g, "");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>${styles}
<style>@page{size:letter;margin:14mm}html,body{width:auto!important;height:auto!important;overflow:visible!important;background:#fff}
body>*{display:block!important}img,blockquote,figure{break-inside:avoid}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.no-print{display:none!important}</style></head><body><main style="max-width:760px;margin:0 auto;padding:16px">${html}</main></body></html>`);
  w.document.close();
  const go = () => setTimeout(() => { w.focus(); w.print(); }, 400);
  if (w.document.readyState === "complete") go();
  else w.addEventListener("load", go);
  return true;
}
