"""
Generate Vibepollo installer wizard images from logo-vibepollo.svg.

Outputs:
  installer/images/wizard-sidebar.bmp   164x314  (Welcome + Finish pages)
  installer/images/wizard-header.bmp     55x55   (all inner pages, top-right)

Aesthetic: matches Vibepollo/Vibelight banner art —
  deep navy-indigo gradient background, orange glow top-right,
  teal glow bottom-left, white logo, bold title, version badge pill.
"""

import io
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPM

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO    = Path(__file__).parent.parent
SVG_PATH = REPO / "src_assets/common/assets/web/public/images/logo-vibepollo.svg"
OUT_DIR  = REPO / "installer/images"

# ── Palette (matches banner art) ──────────────────────────────────────────────
BG_TOP    = (8,   10,  35)    # Very dark navy
BG_BOT    = (15,  18,  62)    # Deep indigo
ORANGE    = (255, 130, 30)    # Corner glow — top-right
TEAL      = (30,  200, 180)   # Corner glow — bottom-left
INDIGO    = (99,  102, 241)   # Accent line (indigo-500)
WHITE     = (255, 255, 255)
BADGE_FG  = (140, 150, 200)   # Badge text / subtle grey-blue
BADGE_BD  = (70,  80,  140)   # Badge border

VERSION   = "v1.15.11"


# ── Helpers ───────────────────────────────────────────────────────────────────

def gradient_bg(W: int, H: int, top: tuple, bot: tuple) -> Image.Image:
    """Vertical gradient, returns RGBA image."""
    img = Image.new("RGBA", (W, H))
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / max(H - 1, 1)
        r = int(top[0] + t * (bot[0] - top[0]))
        g = int(top[1] + t * (bot[1] - top[1]))
        b = int(top[2] + t * (bot[2] - top[2]))
        draw.line([(0, y), (W - 1, y)], fill=(r, g, b, 255))
    return img


def add_glow(base: Image.Image, cx: int, cy: int,
             radius: int, color: tuple, alpha: int = 90) -> Image.Image:
    """Composite a soft glow blob onto an RGBA base image."""
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw  = ImageDraw.Draw(layer)
    # Three concentric ellipses, decreasing alpha outward
    for i, (frac, a_scale) in enumerate([(1.0, 1.0), (0.7, 0.55), (0.4, 0.3)]):
        r = int(radius * frac)
        a = int(alpha * a_scale)
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=(*color, a),
        )
    layer = layer.filter(ImageFilter.GaussianBlur(radius=radius // 2))
    return Image.alpha_composite(base, layer)


def render_logo_alpha(svg_path: Path, target_size: int) -> Image.Image:
    """
    Render SVG as white logo on transparent background.
    Technique: render white-on-black, use luminance as alpha.
    """
    drawing = svg2rlg(str(svg_path))
    scale = target_size / max(drawing.width, drawing.height)
    drawing.width  = drawing.width  * scale
    drawing.height = drawing.height * scale
    drawing.transform = (scale, 0, 0, scale, 0, 0)

    # Render white logo on pure black
    png_bytes = renderPM.drawToString(drawing, fmt="PNG", bg=0x000000)
    rendered  = Image.open(io.BytesIO(png_bytes)).convert("L")  # luminance

    # Build RGBA: white everywhere, alpha = luminance (black bg → transparent)
    logo = Image.new("RGBA", rendered.size, (*WHITE, 0))
    logo.putalpha(rendered)
    return logo


def load_font(face: str, size: int) -> ImageFont.ImageFont:
    """Try to load a Windows font by face name, fall back to default."""
    for suffix in ("b", ""):           # try Bold, then Regular
        try:
            return ImageFont.truetype(
                f"C:/Windows/Fonts/segoeui{suffix}.ttf", size
            )
        except Exception:
            pass
    return ImageFont.load_default()


def badge_pill(draw: ImageDraw.Draw, text: str, font, cx: int, y: int) -> int:
    """Draw a rounded-rectangle badge pill centered at cx, top at y. Returns bottom y."""
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad_x, pad_y = 10, 5
    bw, bh = tw + pad_x * 2, th + pad_y * 2
    bx = cx - bw // 2
    try:
        draw.rounded_rectangle([bx, y, bx + bw, y + bh], radius=5,
                               outline=BADGE_BD, width=1)
    except AttributeError:
        draw.rectangle([bx, y, bx + bw, y + bh], outline=BADGE_BD)
    draw.text((bx + pad_x, y + pad_y), text, fill=BADGE_FG, font=font)
    return y + bh


# ── sidebar: 164 × 314 ────────────────────────────────────────────────────────

def make_sidebar():
    W, H = 164, 314

    # Background gradient
    img = gradient_bg(W, H, BG_TOP, BG_BOT)

    # Corner glow blobs
    img = add_glow(img, W, 0,  90, ORANGE, alpha=110)   # top-right orange
    img = add_glow(img, 0, H,  80, TEAL,   alpha=85)    # bottom-left teal

    # Thin indigo accent line at very top
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, W, 3], fill=(*INDIGO, 255))

    # Logo — white on transparent, composited over gradient
    logo_size = 120
    logo = render_logo_alpha(SVG_PATH, logo_size)
    lx   = (W - logo_size) // 2
    ly   = 52
    img.paste(logo, (lx, ly), logo)

    # Title: "Vibepollo"
    title_font = load_font("b", 17)
    draw = ImageDraw.Draw(img)
    text  = "Vibepollo"
    tbbox = draw.textbbox((0, 0), text, font=title_font)
    tw    = tbbox[2] - tbbox[0]
    ty    = ly + logo_size + 10
    draw.text(((W - tw) // 2, ty), text, fill=WHITE, font=title_font)

    # Badge pill: version
    small_font = load_font("", 10)
    badge_y = ty + (tbbox[3] - tbbox[1]) + 10
    badge_pill(draw, VERSION, small_font, W // 2, badge_y)

    # Convert to RGB for BMP
    rgb = img.convert("RGB")
    out = OUT_DIR / "wizard-sidebar.bmp"
    rgb.save(str(out), "BMP")
    print(f"Saved {out} ({W}x{H})")


# ── header: 55 × 55 ───────────────────────────────────────────────────────────

def make_header():
    W, H = 55, 55

    img = gradient_bg(W, H, BG_TOP, BG_BOT)
    img = add_glow(img, W, 0, 45, ORANGE, alpha=110)   # top-right orange tint

    logo_size = 42
    logo = render_logo_alpha(SVG_PATH, logo_size)
    lx = (W - logo_size) // 2
    ly = (H - logo_size) // 2
    img.paste(logo, (lx, ly), logo)

    rgb = img.convert("RGB")
    out = OUT_DIR / "wizard-header.bmp"
    rgb.save(str(out), "BMP")
    print(f"Saved {out} ({W}x{H})")


# ── entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    make_sidebar()
    make_header()
    print("Done.")
