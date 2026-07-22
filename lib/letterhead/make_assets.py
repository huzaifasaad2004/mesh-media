"""Generate Mesh Media letterhead artwork assets at print resolution."""
import re, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
BRAND = ROOT / "public" / "brand"
OUT = HERE / "assets"
os.makedirs(OUT, exist_ok=True)

MAROON = (110, 19, 24)      # #6E1318
SAND   = (200, 188, 168)    # #C8BCA8
TAUPE  = (156, 147, 132)    # #9C9384

DPI = 300.0
def mm2px(mm): return int(round(mm * DPI / 25.4))

AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
def avenir(size, index=0):
    return ImageFont.truetype(AVENIR, size, index=index)

# ---------------------------------------------------------------- 1. lockup
# mm_logo_a is the white-on-transparent lockup: swap RGB to maroon, keep alpha.
src = Image.open(BRAND / "mm_logo_a.png").convert("RGBA")
a = src.getchannel("A")
lockup = Image.merge("RGBA", (
    Image.new("L", src.size, MAROON[0]),
    Image.new("L", src.size, MAROON[1]),
    Image.new("L", src.size, MAROON[2]),
    a,
))
lockup = lockup.crop(a.getbbox())          # trim transparent padding
lockup.save(f"{OUT}/logo_lockup.png", dpi=(DPI, DPI))
print("logo_lockup", lockup.size)

# ------------------------------------------------- 2. mark from the SVG path
# mark.svg is a single closed subpath of straight L segments -> fill as polygon.
svg = open(BRAND / "mark.svg").read()
d = re.search(r'\sd="([^"]+)"', svg).group(1)
pts = [(float(x), float(y)) for x, y in re.findall(r'(-?\d+\.?\d*),(-?\d+\.?\d*)', d)]
VB_W, VB_H = 524.0, 572.0
print("mark path points:", len(pts))

def render_mark(height_px, colour, alpha=255, ss=4):
    """Render the wave mark at arbitrary size via supersampled polygon fill."""
    h = int(height_px * ss)
    w = int(round(h * VB_W / VB_H))
    img = Image.new("L", (w, h), 0)
    ImageDraw.Draw(img).polygon(
        [(x / VB_W * w, y / VB_H * h) for x, y in pts], fill=255
    )
    img = img.resize((int(w / ss), int(h / ss)), Image.LANCZOS)
    img = img.point(lambda v: int(v * alpha / 255))
    out = Image.new("RGBA", img.size, colour + (0,))
    out.putalpha(img)
    return out

# Giant ghost watermark. Opacity is baked into the alpha channel: ~4% is faint
# enough to sit behind text, but still dark enough to survive a laser printer.
ghost = render_mark(mm2px(140), MAROON, alpha=10)
ghost.save(f"{OUT}/ghost_mark.png", dpi=(DPI, DPI))
print("ghost_mark", ghost.size)

# Small solid mark for the footer / continuation header.
render_mark(mm2px(6), MAROON).save(f"{OUT}/mark_small.png", dpi=(DPI, DPI))

# ------------------------------------------------------- 3. two-tone rule
RULE_W_MM, RULE_H_MM = 160.0, 1.2
rw, rh = mm2px(RULE_W_MM), mm2px(RULE_H_MM)
rule = Image.new("RGBA", (rw, rh), (0, 0, 0, 0))
rd = ImageDraw.Draw(rule)
thick_w = mm2px(26)                                  # short heavy maroon run
rd.rectangle([0, 0, thick_w, rh - 1], fill=MAROON + (255,))
hair_y = rh - max(1, mm2px(0.25))                    # long sand hairline
rd.rectangle([thick_w + mm2px(2), hair_y, rw - 1, rh - 1], fill=SAND + (255,))
rule.save(f"{OUT}/rule.png", dpi=(DPI, DPI))
print("rule", rule.size)

# ------------------------------------------- 4. vertical edge micro-lettering
def tracked(draw, xy, text, font, fill, track):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + track
    return x - xy[0]

EDGE = "MESHMEDIA  ·  ABU DHABI"
ef = avenir(mm2px(1.9), index=4)                     # Avenir Next Medium
tmp = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
track = mm2px(0.55)
width = int(tracked(tmp, (0, 0), EDGE, ef, (0, 0, 0), track)) + mm2px(2)
strip = Image.new("RGBA", (width, mm2px(4)), (0, 0, 0, 0))
tracked(ImageDraw.Draw(strip), (0, 0), EDGE, ef, TAUPE + (255,), track)
strip.rotate(90, expand=True).save(f"{OUT}/edge_type.png", dpi=(DPI, DPI))
print("edge_type", strip.rotate(90, expand=True).size)

print("\nAll assets written to", OUT)
