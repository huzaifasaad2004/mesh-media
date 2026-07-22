/**
 * Mesh Media — branded A4 letterhead template.
 * Branding lives in the header/footer so the body stays free for typing.
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Header, Footer,
  BorderStyle, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom,
  TextWrappingType, TextWrappingSide, PageNumber, TabStopType,
} = require("docx");

const path = require("path");
const A = path.join(__dirname, "assets");
const img = (n) => fs.readFileSync(`${A}/${n}`);

// ---- units -------------------------------------------------------------
const DXA = (mm) => Math.round(mm * 1440 / 25.4);   // twips
const EMU = (mm) => Math.round(mm * 36000);          // english metric units
const PX  = (mm) => mm * 96 / 25.4;                  // docx image px (96dpi)

// ---- brand -------------------------------------------------------------
const MAROON = "6E1318", TAUPE = "9C9384", SAND = "C8BCA8", INK = "151312";
const SANS = "Avenir Next";

// ---- page geometry -----------------------------------------------------
const PAGE_W = 210, M_LEFT = 30, M_RIGHT = 22;
const CONTENT_W = PAGE_W - M_LEFT - M_RIGHT;         // 158mm

/** Tracked micro-caps run — the recurring typographic motif. */
const caps = (text, { color = TAUPE, size = 13, track = 25, bold = false } = {}) =>
  new TextRun({ text, font: SANS, size, color, bold, characterSpacing: track });

const body = (text, opts = {}) =>
  new Paragraph({
    spacing: { line: 320, after: opts.after ?? 160 },
    alignment: opts.align,
    children: [new TextRun({
      text, font: SANS, size: opts.size ?? 21,
      color: opts.color ?? INK, bold: opts.bold, characterSpacing: opts.track,
    })],
  });

const spacer = (pts) => new Paragraph({ spacing: { after: pts * 20 }, children: [] });

// ---- floating decoration (first page only) -----------------------------
const float = (file, wMM, hMM, xMM, yMM) => new ImageRun({
  type: "png",
  data: img(file),
  transformation: { width: PX(wMM), height: PX(hMM) },
  floating: {
    horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: EMU(xMM) },
    verticalPosition:   { relative: VerticalPositionRelativeFrom.PAGE,   offset: EMU(yMM) },
    behindDocument: true,
    allowOverlap: true,
    wrap: { type: TextWrappingType.NONE, side: TextWrappingSide.BOTH_SIDES },
  },
});

// ======================================================== FIRST PAGE HEADER
// Logo left, tagline right. Laid out on tab stops rather than a table —
// tables inside headers are the first thing other word processors mangle.
const RIGHT_TAB = [{ type: TabStopType.RIGHT, position: DXA(CONTENT_W) }];

const firstHeader = new Header({
  children: [
    new Paragraph({
      spacing: { after: 40 }, tabStops: RIGHT_TAB,
      children: [
        new ImageRun({
          type: "png", data: img("logo_lockup.png"),
          transformation: { width: PX(52), height: PX(52 * 259 / 926) },
        }),
        new TextRun({ text: "\t", font: SANS, size: 13 }),
        caps("MARKETING & PUBLIC RELATIONS", { color: MAROON, bold: true, track: 18 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 0 }, tabStops: RIGHT_TAB,
      children: [
        new TextRun({ text: "\t", font: SANS, size: 13 }),
        caps("ABU DHABI  ·  UNITED ARAB EMIRATES", { track: 18 }),
      ],
    }),
    spacer(7),
    // Rule + the two floating decorations ride in one paragraph so they
    // consume no extra vertical space.
    new Paragraph({
      spacing: { after: 0 },
      children: [
        new ImageRun({
          type: "png", data: img("rule.png"),
          transformation: { width: PX(CONTENT_W), height: PX(1.2) },
        }),
        float("ghost_mark.png", 140 * 524 / 572, 140, 95, 120),
        float("edge_type.png", 4, 32.9, 13, 168),
      ],
    }),
  ],
});

// ================================================= CONTINUATION PAGE HEADER
const contHeader = new Header({
  children: [
    new Paragraph({
      spacing: { after: 0 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: SAND, space: 6 } },
      tabStops: [{ type: TabStopType.RIGHT, position: DXA(CONTENT_W) }],
      children: [
        new ImageRun({
          type: "png", data: img("mark_small.png"),
          transformation: { width: PX(6 * 524 / 572), height: PX(6) },
        }),
        new TextRun({ text: "  ", font: SANS, size: 13 }),
        caps("MESHMEDIA", { color: MAROON, bold: true }),
        new TextRun({ text: "\t", font: SANS, size: 13 }),
        caps("PAGE ", { color: TAUPE }),
        new TextRun({ children: [PageNumber.CURRENT], font: SANS, size: 13, color: TAUPE }),
      ],
    }),
  ],
});

// ================================================================= FOOTER
// Three columns of micro-type on centre/right tab stops.
const FOOT_TABS = [
  { type: TabStopType.CENTER, position: DXA(CONTENT_W / 2) },
  { type: TabStopType.RIGHT,  position: DXA(CONTENT_W) },
];

const footLine = (left, centre, right, after) => new Paragraph({
  spacing: { after, line: 200 }, tabStops: FOOT_TABS,
  children: [
    caps(left, { track: 12, size: 12 }),
    new TextRun({ text: "\t", font: SANS, size: 12 }),
    caps(centre, { track: 12, size: 12 }),
    new TextRun({ text: "\t", font: SANS, size: 12 }),
    caps(right, { track: 12, size: 12 }),
  ],
});

const makeFooter = () => new Footer({
  children: [
    new Paragraph({
      spacing: { after: 90 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: SAND, space: 2 } },
      children: [],
    }),
    footLine("MAZYAD MALL, TOWER 2, OFFICE 619", "+971 50 950 1326", "THEMESHMEDIA.COM", 20),
    footLine("MBZ · ABU DHABI · U.A.E.", "HELLO@M3M.AE", "TRADE LICENCE 1594410", 0),
  ],
});

// =================================================================== BODY
const bodyChildren = [
  new Paragraph({
    spacing: { after: 420 },
    children: [caps("[ DATE ]", { color: TAUPE, track: 20 })],
  }),

  body("[Recipient Name]", { bold: true, after: 40 }),
  body("[Title / Position]", { color: "6E655B", size: 19, after: 40 }),
  body("[Company Name]", { color: "6E655B", size: 19, after: 40 }),
  body("[Address Line]", { color: "6E655B", size: 19, after: 380 }),

  new Paragraph({
    spacing: { after: 300 },
    children: [caps("SUBJECT:  [WRITE YOUR SUBJECT LINE HERE]", { color: MAROON, bold: true, size: 17, track: 20 })],
  }),

  body("Dear [Name],", { after: 240 }),

  body(
    "This is your MeshMedia letterhead. Replace this text with your letter, proposal, " +
    "or any document you need to send under the agency's name — everything you type here " +
    "flows normally, and the branding above and below stays locked in place.",
  ),
  body(
    "The header, footer, watermark and margin lettering all live in the document's header " +
    "and footer layers, so they repeat automatically on every page and can't be knocked out " +
    "of alignment while you write. Page two onward switches to a slimmer header with a page " +
    "number, keeping long proposals clean and readable.",
  ),
  body(
    "Add as many paragraphs as you need. To start a new document, duplicate this file rather " +
    "than editing it, so the original template stays intact.",
    { after: 420 },
  ),

  body("Warm regards,", { after: 0 }),
  spacer(38),  // room for a wet or pasted signature

  new Paragraph({
    spacing: { after: 30 },
    border: { top: { style: BorderStyle.SINGLE, size: 8, color: MAROON, space: 8 } },
    indent: { right: DXA(CONTENT_W - 58) },   // short rule above the name
    children: [],
  }),
  body("Huzaifa Bin Saad", { bold: true, after: 30 }),
  new Paragraph({
    spacing: { after: 0 },
    children: [caps("FOUNDER  ·  MESHMEDIA FOR MARKETING AND PR", { color: TAUPE, track: 18 })],
  }),
];

// ================================================================ ASSEMBLE
const doc = new Document({
  creator: "MeshMedia For Marketing and PR",
  title: "MeshMedia Letterhead",
  description: "Branded A4 letterhead template",
  styles: {
    default: {
      document: { run: { font: SANS, size: 21, color: INK } },
    },
  },
  sections: [{
    properties: {
      titlePage: true,
      page: {
        size: { width: DXA(210), height: DXA(297) },
        margin: {
          top: DXA(44), bottom: DXA(26), left: DXA(M_LEFT), right: DXA(M_RIGHT),
          header: DXA(13), footer: DXA(12),
        },
      },
    },
    headers: { first: firstHeader, default: contHeader },
    footers: { first: makeFooter(), default: makeFooter() },
    children: bodyChildren,
  }],
});

const out = process.argv[2];
Packer.toBuffer(doc).then((b) => {
  fs.writeFileSync(out, b);
  console.log("Wrote", out, (b.length / 1024).toFixed(1) + " KB");
});
