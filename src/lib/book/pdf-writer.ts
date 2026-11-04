/**
 * Incremental PDF writer for Book Builder exports.
 *
 * A book can contain hundreds of high-resolution scans, far more than fits in
 * one server request's memory. The file is therefore written in independent
 * "parts" (page structure + fonts first, then batches of scan images, then the
 * cross-reference table). Each part is stored separately and the download
 * streams them back-to-back as one standards-conforming PDF. JPEG scans are
 * embedded byte-for-byte (no re-compression), and fonts are embedded whole.
 */
import type { BookFonts } from "./fonts";
import type { BookPlan, FontKey } from "./types";

const enc = new TextEncoder();
const FONT_KEYS: FontKey[] = ["regular", "italic", "bold", "boldItalic"];
const FONT_RES: Record<FontKey, string> = { regular: "F1", italic: "F2", bold: "F3", boldItalic: "F4" };
const TONES = { ink: "0.11 0.10 0.09 rg", muted: "0.40 0.37 0.34 rg", note: "0.36 0.25 0.16 rg" } as const;

const n = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0+$/, "");
};

export class PartBuilder {
  private chunks: Uint8Array[] = [];
  size = 0;
  objects: Array<[number, number]> = [];
  write(s: string | Uint8Array) {
    const b = typeof s === "string" ? enc.encode(s) : s;
    this.chunks.push(b);
    this.size += b.length;
  }
  beginObject(num: number) {
    this.objects.push([num, this.size]);
    this.write(`${num} 0 obj\n`);
  }
  stream(num: number, dict: string, data: Uint8Array) {
    this.beginObject(num);
    this.write(`<< ${dict} /Length ${data.length} >>\nstream\n`);
    this.write(data);
    this.write("\nendstream\nendobj\n");
  }
  object(num: number, body: string) {
    this.beginObject(num);
    this.write(`${body}\nendobj\n`);
  }
  bytes(): Uint8Array {
    const out = new Uint8Array(this.size);
    let o = 0;
    for (const c of this.chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }
}

export async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export type JpegInfo = { width: number; height: number; components: number; adobe: boolean };

export function readJpegInfo(b: Uint8Array): JpegInfo | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  let adobe = false;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (marker === 0xee) adobe = true;
    if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8], components: b[i + 9], adobe };
    }
    i += 2 + len;
  }
  return null;
}

export function imageObjectDict(info: JpegInfo) {
  const cs = info.components === 1 ? "/DeviceGray" : info.components === 4 ? "/DeviceCMYK" : "/DeviceRGB";
  const decode = info.components === 4 && info.adobe ? " /Decode [1 0 1 0 1 0 1 0]" : "";
  return `/Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace ${cs} /BitsPerComponent 8 /Filter /DCTDecode${decode}`;
}

function utf16Hex(s: string) {
  let h = "FEFF";
  for (let i = 0; i < s.length; i++) h += s.charCodeAt(i).toString(16).padStart(4, "0");
  return `<${h}>`;
}

export type ImageSlot = { num: number; path: string; bucket?: "scans" | "book-images" };

export type HeadResult = {
  bytes: Uint8Array;
  objects: Array<[number, number]>;
  images: ImageSlot[];
  totalObjects: number;
  rootNum: number;
  infoNum: number;
};

/** Writes the header, catalog, fonts, pages and content streams (everything but image data). */
export async function writeHead(plan: BookPlan, fonts: BookFonts, info: { title: string; subtitle?: string | null }): Promise<HeadResult> {
  let next = 1;
  const rootNum = next++;
  const pagesNum = next++;
  const infoNum = next++;
  const fontNums = {} as Record<FontKey, { type0: number; cid: number; desc: number; file: number; cmap: number }>;
  for (const k of FONT_KEYS) fontNums[k] = { type0: next++, cid: next++, desc: next++, file: next++, cmap: next++ };

  const images: ImageSlot[] = [];
  const imageByPath = new Map<string, ImageSlot>();
  const pageNums = plan.pages.map(() => ({ page: next++, content: next++ }));
  for (const p of plan.pages)
    for (const el of p.elements)
      if (el.t === "image" && !imageByPath.has(`${el.image.bucket ?? "scans"}:${el.image.path}`)) {
        const slot: ImageSlot = { num: next++, path: el.image.path, bucket: el.image.bucket ?? "scans" };
        imageByPath.set(`${slot.bucket}:${el.image.path}`, slot);
        images.push(slot);
      }

  const used = {} as Record<FontKey, Map<number, string>>;
  for (const k of FONT_KEYS) used[k] = new Map();

  const part = new PartBuilder();
  part.write("%PDF-1.7\n%\u00e2\u00e3\u00cf\u00d3\n".replace(/[\u0080-\u00ff]/g, (c) => c));
  part.object(rootNum, `<< /Type /Catalog /Pages ${pagesNum} 0 R /PageLayout /TwoPageRight >>`);
  part.object(pagesNum, `<< /Type /Pages /Count ${plan.pages.length} /Kids [${pageNums.map((p) => `${p.page} 0 R`).join(" ")}] >>`);
  const now = new Date();
  const d = `D:${now.toISOString().replace(/[-:T]/g, "").slice(0, 14)}Z`;
  part.object(
    infoNum,
    `<< /Title ${utf16Hex(info.title)}${info.subtitle ? ` /Subject ${utf16Hex(info.subtitle)}` : ""} /Creator ${utf16Hex("The Francis Files — Book Builder")} /Producer ${utf16Hex("Francis Files Book Builder 1.0")} /CreationDate (${d}) >>`,
  );

  const W = plan.widthPt;
  const H = plan.heightPt;
  for (let pi = 0; pi < plan.pages.length; pi++) {
    const p = plan.pages[pi];
    const ops: string[] = [];
    const xobjects = new Set<ImageSlot>();
    const fontsUsed = new Set<FontKey>();
    for (const el of p.elements) {
      if (el.t === "image") {
        const slot = imageByPath.get(`${el.image.bucket ?? "scans"}:${el.image.path}`)!;
        xobjects.add(slot);
        const clip = el.clip ? `${n(el.clip.x)} ${n(H - el.clip.y - el.clip.h)} ${n(el.clip.w)} ${n(el.clip.h)} re W n ` : "";
        ops.push(`q ${clip}${n(el.w)} 0 0 ${n(el.h)} ${n(el.x)} ${n(H - el.y - el.h)} cm /Im${slot.num} Do Q`);
      } else if (el.t === "rule") {
        ops.push(`q 0.55 0.5 0.45 RG 0.5 w ${n(el.x)} ${n(H - el.y)} m ${n(el.x + el.w)} ${n(H - el.y)} l S Q`);
      } else {
        const f = fonts[el.font];
        let hex = "";
        for (const ch of el.text) {
          const g = f.glyph(ch.codePointAt(0)!);
          hex += g.gid.toString(16).padStart(4, "0");
          if (!used[el.font].has(g.gid)) used[el.font].set(g.gid, g.missing ? "?" : ch);
        }
        if (!hex) continue;
        fontsUsed.add(el.font);
        ops.push(`BT ${TONES[el.tone]} /${FONT_RES[el.font]} ${n(el.size)} Tf 1 0 0 1 ${n(el.x)} ${n(H - el.y)} Tm <${hex}> Tj ET`);
      }
    }
    const fontDict = [...fontsUsed].map((k) => `/${FONT_RES[k]} ${fontNums[k].type0} 0 R`).join(" ");
    const xoDict = [...xobjects].map((s) => `/Im${s.num} ${s.num} 0 R`).join(" ");
    const box = `[0 0 ${n(W)} ${n(H)}]`;
    part.object(
      pageNums[pi].page,
      `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox ${box} /TrimBox ${box} /Resources << /Font << ${fontDict} >> /XObject << ${xoDict} >> >> /Contents ${pageNums[pi].content} 0 R >>`,
    );
    const content = await deflate(enc.encode(ops.join("\n")));
    part.stream(pageNums[pi].content, "/Filter /FlateDecode", content);
  }

  for (const k of FONT_KEYS) {
    const f = fonts[k];
    const nums = fontNums[k];
    const scale = 1000 / f.unitsPerEm;
    const glyphs = [...used[k].keys()].sort((a, b) => a - b);
    const widths = glyphs
      .map((gid) => {
        const cp = used[k].get(gid)!.codePointAt(0)!;
        return `${gid} [${Math.round(f.glyph(cp).adv * scale)}]`;
      })
      .join(" ");
    const name = (f.font.postscriptName || `EBGaramond-${k}`).replace(/[^A-Za-z0-9-]/g, "");
    part.object(nums.type0, `<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${nums.cid} 0 R] /ToUnicode ${nums.cmap} 0 R >>`);
    part.object(
      nums.cid,
      `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${nums.desc} 0 R /DW 500 /W [${widths}] /CIDToGIDMap /Identity >>`,
    );
    const bb = f.font.bbox;
    const italic = k === "italic" || k === "boldItalic";
    part.object(
      nums.desc,
      `<< /Type /FontDescriptor /FontName /${name} /Flags ${34 + (italic ? 64 : 0)} /FontBBox [${[bb.minX, bb.minY, bb.maxX, bb.maxY].map((v) => Math.round(v * scale)).join(" ")}] /ItalicAngle ${n(f.font.italicAngle || 0)} /Ascent ${Math.round(f.ascent * scale)} /Descent ${Math.round(f.descent * scale)} /CapHeight ${Math.round((f.font.capHeight || f.ascent * 0.7) * scale)} /StemV ${k.startsWith("bold") ? 110 : 80} /FontFile2 ${nums.file} 0 R >>`,
    );
    part.stream(nums.file, `/Filter /FlateDecode /Length1 ${f.bytes.length}`, await deflate(f.bytes));
    const entries = glyphs.map((gid) => {
      const s = used[k].get(gid)!;
      let h = "";
      for (let i = 0; i < s.length; i++) h += s.charCodeAt(i).toString(16).padStart(4, "0");
      return `<${gid.toString(16).padStart(4, "0")}> <${h}>`;
    });
    let cmap = "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n";
    for (let i = 0; i < entries.length; i += 100) {
      const chunk = entries.slice(i, i + 100);
      cmap += `${chunk.length} beginbfchar\n${chunk.join("\n")}\nendbfchar\n`;
    }
    cmap += "endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend";
    part.stream(nums.cmap, "/Filter /FlateDecode", await deflate(enc.encode(cmap)));
  }

  return { bytes: part.bytes(), objects: part.objects, images, totalObjects: next - 1, rootNum, infoNum };
}

/** Final part: the cross-reference table and trailer, given every object's absolute offset. */
export function writeXref(totalObjects: number, offsets: Map<number, number>, startOffset: number, rootNum: number, infoNum: number, id: string) {
  let s = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= totalObjects; i++) {
    const off = offsets.get(i);
    if (off === undefined) throw new Error(`PDF object ${i} was never written`);
    s += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  s += `trailer\n<< /Size ${totalObjects + 1} /Root ${rootNum} 0 R /Info ${infoNum} 0 R /ID [<${id}> <${id}>] >>\nstartxref\n${startOffset}\n%%EOF\n`;
  return enc.encode(s);
}
