"""
Generate Vibepollo installer wizard images from logo-vibepollo.svg.

Outputs:
  installer/images/wizard-sidebar.bmp   164x314  (Welcome + Finish pages)
  installer/images/wizard-header.bmp     55x55   (all inner pages, top-right)

These images are VERSION-AGNOSTIC — they contain no version number and never
need to change between releases. The installer ISS file controls the version
shown in wizard text; the images are pure branding.

Aesthetic: matches Vibepollo/Vibelight banner art —
  deep navy-indigo gradient, subtle dot-grid texture, orange glow top-right,
  teal glow bottom-left, white logo, bold title, tagline.
"""

import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPM

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO     = Path(__file__).parent.parent
SVG_PATH = REPO / "src_assets/common/assets/web/public/images/logo-vibepollo.svg"
OUT_DIR  = REPO / "installer/images"

# ── Palette ───────────────────────────────────────────────────────────────────
BG_TOP  = (8,   10,  35)    # Very dark navy
BG_BOT  = (13,  16,  55)    # Deep indigo (slightly lighter than before)
ORANGE  = (255, 140, 40)    # Corner glow — top-right
TEAL    = (30,  200, 180)   # Corner glow — bottom-left
INDIGO  = (99,  102, 241)   # Accent bars (indigo-500)
WHITE   = (255, 255, 255)
TITLE   = (235, 238, 255)   # Slightly blue-white for title
TAGLINE = (100, 112, 160)   # Muted blue-grey tagline
SEP     = (55,  65,  120)   # Separator line color
DOT     = (255, 255, 255)   # Dot grid color (drawn with very low alpha)


# ── Helpers ───────────────────────────────────────────────────────────────────

def gradient_bg(W: int, H: int, top: tuple, bot: tuple) -> Image.Image:
    """Vertical gradient, returns RGBA image."""
    img  = Image.new("RGBA", (W, H))
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / max(H - 1, 1)
        r = int(top[0] + t * (bot[0] - top[0]))
        g = int(top[1] + t * (bot[1] - top[1]))
        b = int(top[2] + t * (bot[2] - top[2]))
        draw.line([(0, y), (W - 1, y)], fill=(r, g, b, 255))
    return img


def dot_grid(img: Image.Image, spacing: int = 14, radius: int = 1,
             alpha: int = 14) -> Image.Image:
    """Overlay a subtle dot-grid texture. Drawn before glows so glows overlay it."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw  = ImageDraw.Draw(layer)
    W, H  = img.size
    for gx in range(spacing // 2, W, spacing):
        for gy in range(spacing // 2, H, spacing):
            draw.ellipse(
                [gx - radius, gy - radius, gx + radius, gy + radius],
                fill=(*DOT, alpha),
            )
    return Image.alpha_composite(img, layer)


def add_glow(base: Image.Image, cx: int, cy: int,
             radius: int, color: tuple, alpha: int = 90) -> Image.Image:
    """Composite a soft glow blob onto an RGBA base image."""
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw  = ImageDraw.Draw(layer)
    for frac, a_scale in [(1.0, 1.0), (0.65, 0.5), (0.35, 0.25)]:
        r = int(radius * frac)
        a = int(alpha * a_scale)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*color, a))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=radius // 2))
    return Image.alpha_composite(base, layer)


def render_logo_alpha(svg_path: Path, target_size: int) -> Image.Image:
    """
    Render SVG as white logo on transparent background.
    Technique: render white-on-black, use luminance as alpha channel.
    This allows the logo to composite cleanly over any background.
    """
    drawing = svg2rlg(str(svg_path))
    scale   = target_size / max(drawing.width, drawing.height)
    drawing.width     = drawing.width  * scale
    drawing.height    = drawing.height * scale
    drawing.transform = (scale, 0, 0, scale, 0, 0)

    png_bytes = renderPM.drawToString(drawing, fmt="PNG", bg=0x000000)
    rendered  = Image.open(io.BytesIO(png_bytes)).convert("L")  # luminance mask

    logo = Image.new("RGBA", rendered.size, (*WHITE, 0))
    logo.putalpha(rendered)
    return logo


def load_font(variant: str, size: int) -> ImageFont.ImageFont:
    """
    variant: "b" = bold, "sl" = semilight, "" = regular
    Falls through to PIL default if no match found.
    """
    candidates = {
        "b":  ["segoeuib", "segoeui"],
        "sl": ["segoeuisl", "segoeui"],
        "":   ["segoeui"],
    }.get(variant, ["segoeui"])
    for name in candidates:
        try:
            return ImageFont.truetype(f"C:/Windows/Fonts/{name}.ttf", size)
        except Exception:
            pass
    return ImageFont.load_default()


def text_centered(draw: ImageDraw.Draw, y: int, text: str, font,
                  fill: tuple, W: int) -> int:
    """Draw text centered horizontally. Returns the bottom y of the text."""
    bbox = draw.textbbox((0, 0), text, font=font)
    tw   = bbox[2] - bbox[0]
    th   = bbox[3] - bbox[1]
    draw.text(((W - tw) // 2, y), text, fill=fill, font=font)
    return y + th


# ── sidebar: 164 × 314 ────────────────────────────────────────────────────────

def make_sidebar():
    W, H = 164, 314

    # 1. Gradient base
    img = gradient_bg(W, H, BG_TOP, BG_BOT)

    # 2. Dot grid (subtle texture, drawn before glows)
    img = dot_grid(img, spacing=14, radius=1, alpha=13)

    # 3. Corner glow blobs — positioned at corners (partially off-canvas)
    img = add_glow(img, W + 8, -8,  80, ORANGE, alpha=90)   # top-right
    img = add_glow(img, -8,  H + 8, 70, TEAL,   alpha=70)   # bottom-left

    draw = ImageDraw.Draw(img)

    # 4. Accent bars — indigo line at top AND bottom
    draw.rectangle([0, 0, W, 4],       fill=(*INDIGO, 255))
    draw.rectangle([0, H - 3, W, H],   fill=(*INDIGO, 160))

    # 5. Logo — composited with transparency
    logo_size = 122
    logo = render_logo_alpha(SVG_PATH, logo_size)
    lx   = (W - logo_size) // 2
    ly   = 48
    img.paste(logo, (lx, ly), logo)

    # Redraw after paste (paste converts to RGB mode internally — re-wrap)
    draw = ImageDraw.Draw(img)

    # 6. Title: "Vibepollo"
    title_font = load_font("b", 17)
    ty = ly + logo_size + 14
    ty = text_centered(draw, ty, "Vibepollo", title_font, TITLE, W) + 10

    # 7. Thin separator line (centered, 40% width)
    sep_w = int(W * 0.4)
    sep_x = (W - sep_w) // 2
    draw.line([(sep_x, ty), (sep_x + sep_w, ty)], fill=SEP, width=1)
    ty += 9

    # 8. Tagline — two lines
    tag_font  = load_font("", 10)
    tag_font2 = load_font("sl", 9)
    ty = text_centered(draw, ty, "Mic Passthrough", tag_font,  TAGLINE, W) + 3
    text_centered(draw, ty, "for Steam Deck",   tag_font2, TAGLINE, W)

    # 9. Export
    rgb = img.convert("RGB")
    out = OUT_DIR / "wizard-sidebar.bmp"
    rgb.save(str(out), "BMP")
    print(f"Saved {out} ({W}x{H})")


# ── header: 55 × 55 ───────────────────────────────────────────────────────────

def make_header():
    W, H = 55, 55

    img = gradient_bg(W, H, BG_TOP, BG_BOT)
    img = add_glow(img, W + 5, -5, 40, ORANGE, alpha=90)   # top-right corner

    logo_size = 40
    logo = render_logo_alpha(SVG_PATH, logo_size)
    lx   = (W - logo_size) // 2
    ly   = (H - logo_size) // 2
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
