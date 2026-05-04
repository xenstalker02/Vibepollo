"""
Generate Vibepollo installer wizard images from logo-vibepollo.svg.

Outputs:
  installer/images/wizard-sidebar.bmp   328x628  (2x — HiDPI crisp)
  installer/images/wizard-header.bmp   110x110  (2x — HiDPI crisp)

Images are rendered at 2x (328x628 / 110x110) so they scale DOWN rather than
UP on HiDPI displays. Inno Setup scales them proportionally to fill the 164x314
and 55x55 sidebar/header areas — downscaling produces clean results at all DPI
levels. 1x-only images looked blurry on 125%/150% Windows display scaling.

These images are VERSION-AGNOSTIC — no version string is embedded.
They only need to change if the branding changes.

Aesthetic: matches Vibepollo/Vibelight banner art —
  deep navy-indigo gradient, dot-grid texture, orange glow top-right,
  teal glow bottom-left, Bahnschrift bold title, tagline.
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

# ── Render scale — images are generated at SCALE × logical size ───────────────
# Logical sizes: sidebar 164×314, header 55×55
# Rendered at 2× so Inno Setup scales DOWN (crisp) rather than UP (blurry).
SCALE = 2

# ── Palette ───────────────────────────────────────────────────────────────────
BG_TOP  = (6,   8,   28)    # Very dark navy
BG_BOT  = (14,  17,  58)    # Deep indigo
ORANGE  = (255, 145, 40)    # Corner glow — top-right
TEAL    = (30,  205, 185)   # Corner glow — bottom-left
INDIGO  = (99,  102, 241)   # Accent bars
WHITE   = (255, 255, 255)
TITLE   = (240, 243, 255)   # Near-white with slight blue tint
TAGLINE = (105, 118, 168)   # Muted blue-grey
SEP     = (60,  70,  130)   # Separator line


# ── Helpers ───────────────────────────────────────────────────────────────────

def px(n: int) -> int:
    """Convert logical pixels to render pixels."""
    return n * SCALE


def gradient_bg(W: int, H: int, top: tuple, bot: tuple) -> Image.Image:
    img  = Image.new("RGBA", (W, H))
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / max(H - 1, 1)
        r = int(top[0] + t * (bot[0] - top[0]))
        g = int(top[1] + t * (bot[1] - top[1]))
        b = int(top[2] + t * (bot[2] - top[2]))
        draw.line([(0, y), (W - 1, y)], fill=(r, g, b, 255))
    return img


def dot_grid(img: Image.Image, spacing: int, alpha: int = 14) -> Image.Image:
    """Subtle dot-grid texture overlay."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw  = ImageDraw.Draw(layer)
    W, H  = img.size
    for gx in range(spacing // 2, W, spacing):
        for gy in range(spacing // 2, H, spacing):
            draw.ellipse([gx - 1, gy - 1, gx + 1, gy + 1], fill=(*WHITE, alpha))
    return Image.alpha_composite(img, layer)


def add_glow(base: Image.Image, cx: int, cy: int,
             radius: int, color: tuple, alpha: int = 90) -> Image.Image:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw  = ImageDraw.Draw(layer)
    for frac, a_scale in [(1.0, 1.0), (0.65, 0.50), (0.35, 0.25)]:
        r = int(radius * frac)
        a = int(alpha * a_scale)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*color, a))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=radius // 2))
    return Image.alpha_composite(base, layer)


def render_logo_alpha(svg_path: Path, target_size: int) -> Image.Image:
    """White logo on transparent bg — render white-on-black, luminance → alpha."""
    drawing = svg2rlg(str(svg_path))
    scale   = target_size / max(drawing.width, drawing.height)
    drawing.width     = drawing.width  * scale
    drawing.height    = drawing.height * scale
    drawing.transform = (scale, 0, 0, scale, 0, 0)

    png_bytes = renderPM.drawToString(drawing, fmt="PNG", bg=0x000000)
    rendered  = Image.open(io.BytesIO(png_bytes)).convert("L")

    logo = Image.new("RGBA", rendered.size, (*WHITE, 0))
    logo.putalpha(rendered)
    return logo


def load_font(path: str, size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def text_w(draw: ImageDraw.Draw, text: str, font) -> int:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def draw_centered(draw: ImageDraw.Draw, y: int, text: str, font,
                  fill: tuple, W: int) -> int:
    """Draw text centered horizontally. Returns bottom y of rendered text."""
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((W - tw) // 2, y), text, fill=fill, font=font)
    return y + th


# ── sidebar: 164×314 logical → 328×628 rendered ───────────────────────────────

def make_sidebar():
    W, H = px(164), px(314)

    # Gradient + texture
    img = gradient_bg(W, H, BG_TOP, BG_BOT)
    img = dot_grid(img, spacing=px(14), alpha=12)

    # Corner glows — pushed off-canvas so they read as edge lighting
    img = add_glow(img, W + px(10), -px(10), px(85), ORANGE, alpha=95)
    img = add_glow(img, -px(10),  H + px(10), px(72), TEAL,   alpha=75)

    draw = ImageDraw.Draw(img)

    # Accent bars top + bottom
    draw.rectangle([0, 0, W, px(4)],        fill=(*INDIGO, 255))
    draw.rectangle([0, H - px(3), W, H],    fill=(*INDIGO, 150))

    # Logo
    logo_size = px(124)
    logo = render_logo_alpha(SVG_PATH, logo_size)
    lx   = (W - logo_size) // 2
    ly   = px(46)
    img.paste(logo, (lx, ly), logo)

    draw = ImageDraw.Draw(img)  # re-wrap after paste

    # Title — Bahnschrift (geometric condensed, matches banner art weight)
    title_font = load_font("C:/Windows/Fonts/bahnschrift.ttf", px(18))
    ty = ly + logo_size + px(14)
    ty = draw_centered(draw, ty, "Vibepollo", title_font, TITLE, W) + px(9)

    # Separator
    sep_w = int(W * 0.38)
    sep_x = (W - sep_w) // 2
    draw.line([(sep_x, ty), (sep_x + sep_w, ty)], fill=SEP, width=px(1))
    ty += px(8)

    # Tagline — two lines, regular Segoe UI
    tag1 = load_font("C:/Windows/Fonts/segoeui.ttf", px(10))
    tag2 = load_font("C:/Windows/Fonts/segoeuil.ttf", px(9))
    ty   = draw_centered(draw, ty, "Windows Game Streaming", tag1, TAGLINE, W) + px(2)
    draw_centered(draw, ty, "with Mic Passthrough",  tag2, TAGLINE, W)

    rgb = img.convert("RGB")
    out = OUT_DIR / "wizard-sidebar.bmp"
    rgb.save(str(out), "BMP")
    print(f"Saved {out} ({W}x{H})")


# ── header: 55×55 logical → 110×110 rendered ─────────────────────────────────

def make_header():
    W, H = px(55), px(55)

    img = gradient_bg(W, H, BG_TOP, BG_BOT)
    img = add_glow(img, W + px(6), -px(6), px(42), ORANGE, alpha=95)

    logo_size = px(42)
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
