"""
Generate Vibepollo installer wizard images from logo-vibepollo.svg.

Outputs:
  installer/images/wizard-sidebar.bmp   164x314  (Welcome + Finish pages)
  installer/images/wizard-header.bmp     55x55   (all inner pages, top-right)

Background: #0F172A (matches Vibelight dark theme)
Logo: white, rendered from src_assets/common/assets/web/public/images/logo-vibepollo.svg
"""

import sys
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPM

# Paths
REPO = Path(__file__).parent.parent
SVG_PATH = REPO / "src_assets/common/assets/web/public/images/logo-vibepollo.svg"
OUT_DIR  = REPO / "installer/images"

BG_COLOR    = (15, 23, 42)    # #0F172A
LOGO_COLOR  = (255, 255, 255) # white (logo paths are white in SVG)

# ── helper: render SVG to PIL Image at target_size ─────────────────────────
def render_svg(svg_path: Path, target_size: int) -> Image.Image:
    drawing = svg2rlg(str(svg_path))
    # Scale drawing to target_size x target_size
    scale = target_size / max(drawing.width, drawing.height)
    drawing.width  = drawing.width  * scale
    drawing.height = drawing.height * scale
    drawing.transform = (scale, 0, 0, scale, 0, 0)
    png_bytes = renderPM.drawToString(drawing, fmt="PNG", bg=0x0F172A)
    import io
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    return img

# ── sidebar: 164 x 314 ─────────────────────────────────────────────────────
def make_sidebar():
    W, H = 164, 314
    img = Image.new("RGB", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Render logo at 110px, center it horizontally, top third vertically
    logo_size = 110
    logo = render_svg(SVG_PATH, logo_size).convert("RGB")

    # Paste logo — centered horizontally, ~60px from top
    lx = (W - logo_size) // 2
    ly = 58
    img.paste(logo, (lx, ly))

    # "Vibepollo" label — use default font (no system font required)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 15)
    except Exception:
        font = ImageFont.load_default()

    text = "Vibepollo"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    tx = (W - tw) // 2
    ty = ly + logo_size + 14
    draw.text((tx, ty), text, fill=(255, 255, 255), font=font)

    # Subtle version line
    try:
        small_font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 10)
    except Exception:
        small_font = font

    ver_text = "Setup"
    vbbox = draw.textbbox((0, 0), ver_text, font=small_font)
    vw = vbbox[2] - vbbox[0]
    draw.text(((W - vw) // 2, ty + 22), ver_text, fill=(100, 116, 139), font=small_font)

    # Thin indigo accent line along top
    draw.rectangle([0, 0, W, 2], fill=(99, 102, 241))  # indigo-500

    out = OUT_DIR / "wizard-sidebar.bmp"
    img.save(str(out), "BMP")
    print(f"Saved {out} ({W}x{H})")

# ── header: 55 x 55 ────────────────────────────────────────────────────────
def make_header():
    W, H = 55, 55
    img = Image.new("RGB", (W, H), BG_COLOR)

    logo_size = 44
    logo = render_svg(SVG_PATH, logo_size).convert("RGB")

    lx = (W - logo_size) // 2
    ly = (H - logo_size) // 2
    img.paste(logo, (lx, ly))

    out = OUT_DIR / "wizard-header.bmp"
    img.save(str(out), "BMP")
    print(f"Saved {out} ({W}x{H})")

if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    make_sidebar()
    make_header()
    print("Done.")
