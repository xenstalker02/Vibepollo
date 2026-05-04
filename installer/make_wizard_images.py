"""
Generate Vibepollo installer wizard images from logo-vibepollo.svg.

Outputs:
  installer/images/wizard-sidebar.bmp   328x628  (2x — HiDPI crisp)
  installer/images/wizard-header.bmp   110x110  (2x — HiDPI crisp)

Images are rendered at 2x (328x628 / 110x110) so they scale DOWN rather than
UP on HiDPI displays. Inno Setup scales them proportionally to fill the 164x314
and 55x55 sidebar/header areas — downscaling produces clean results at all DPI
levels.

These images are VERSION-AGNOSTIC — no version string is embedded.
They only need to change if the branding changes.

Aesthetic: matches Vibepollo/Vibelight banner art —
  deep saturated purple-indigo gradient, film-grain noise, orange glow top-right,
  teal glow bottom-left, Inter Bold title, badge-pill feature tags.
"""

import io
import os
import urllib.request
import tempfile
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

# ── Palette — saturated purple-indigo matching banner art ─────────────────────
BG_TOP  = (8,    5,   35)    # Deep saturated navy-purple
BG_BOT  = (24,  14,   90)    # Rich indigo
ORANGE  = (255, 130,  30)    # Corner glow — top-right
TEAL    = (20,  210, 190)    # Corner glow — bottom-left
INDIGO  = (99,  102, 241)    # Accent bars + badge borders
WHITE   = (255, 255, 255)
TITLE   = (240, 243, 255)    # Near-white with slight blue tint

# Badge pill colors
BADGE_FILL   = (12,  18,  75, 160)   # Semi-transparent dark indigo (RGBA)
BADGE_BORDER = (80,  90, 220, 220)   # Blue-indigo border
BADGE_TEXT   = (190, 200, 255, 255)  # Light blue-white text


# ── Font loading ──────────────────────────────────────────────────────────────

def _get_inter_bold() -> str | None:
    """Download Inter Bold to temp dir. Returns path or None on failure."""
    url = "https://cdn.jsdelivr.net/gh/rsms/inter@v4.0/docs/font-files/Inter-Bold.ttf"
    tmp = Path(tempfile.gettempdir()) / "Inter-Bold.ttf"
    if tmp.exists():
        return str(tmp)
    try:
        urllib.request.urlretrieve(url, tmp)
        return str(tmp)
    except Exception:
        return None


def _font_candidates(size: int) -> ImageFont.FreeTypeFont | None:
    """Try Inter Bold → Calibri Bold → Segoe UI Bold → fallback."""
    candidates = [
        _get_inter_bold(),
        "C:/Windows/Fonts/calibrib.ttf",   # Calibri Bold — non-condensed, rounded
        "C:/Windows/Fonts/segoeuib.ttf",   # Segoe UI Bold
        "C:/Windows/Fonts/segoeui.ttf",
    ]
    for path in candidates:
        if path and Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _badge_font(size: int) -> ImageFont.FreeTypeFont | None:
    """Smaller weight for badge text."""
    candidates = [
        _get_inter_bold(),
        "C:/Windows/Fonts/calibrib.ttf",
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
    ]
    for path in candidates:
        if path and Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


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


def add_noise(img: Image.Image, strength: int = 13) -> Image.Image:
    """Subtle film-grain noise layer matching banner art texture."""
    W, H  = img.size
    grain = Image.frombytes("L", (W, H), os.urandom(W * H))
    # Scale grain intensity down (urandom is 0-255; we want subtle)
    grain = grain.point(lambda p: int(p * strength / 255))
    layer = Image.merge("RGBA", [grain, grain, grain,
                                  Image.new("L", (W, H), strength)])
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


def text_size(draw: ImageDraw.Draw, text: str, font) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_centered(draw: ImageDraw.Draw, y: int, text: str, font,
                  fill: tuple, W: int) -> int:
    """Draw text centered horizontally. Returns bottom y."""
    tw, th = text_size(draw, text, font)
    draw.text(((W - tw) // 2, y), text, fill=fill, font=font)
    return y + th


def draw_badge(img: Image.Image, cx: int, cy: int,
               text: str, font) -> int:
    """
    Draw a pill-shaped badge centered at (cx, cy).
    Semi-transparent dark fill + indigo border + light blue text.
    Returns badge height (for stacking).
    """
    tmp_draw = ImageDraw.Draw(img)
    tw, th   = text_size(tmp_draw, text, font)

    pad_x = px(12)
    pad_y = px(5)
    bw    = tw + pad_x * 2
    bh    = th + pad_y * 2
    radius = bh // 2          # full capsule

    x0 = cx - bw // 2
    y0 = cy - bh // 2
    x1 = cx + bw // 2
    y1 = cy + bh // 2

    # Draw onto a separate RGBA layer so fill alpha composites correctly
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ld    = ImageDraw.Draw(layer)

    # Fill
    ld.rounded_rectangle([x0, y0, x1, y1], radius=radius,
                          fill=BADGE_FILL)
    # Border
    ld.rounded_rectangle([x0, y0, x1, y1], radius=radius,
                          outline=BADGE_BORDER, width=max(1, px(1)))

    result = Image.alpha_composite(img, layer)
    # Text on top
    rd = ImageDraw.Draw(result)
    rd.text((cx - tw // 2, y0 + pad_y), text, fill=BADGE_TEXT, font=font)

    # Copy result pixels back into img (in-place-ish via return)
    img.paste(result, (0, 0))
    return bh


# ── sidebar: 164×314 logical → 328×628 rendered ───────────────────────────────

def make_sidebar():
    W, H = px(164), px(314)

    # 1. Gradient
    img = gradient_bg(W, H, BG_TOP, BG_BOT)

    # 2. Film-grain noise
    img = add_noise(img, strength=14)

    # 3. Corner glows
    img = add_glow(img, W + px(12), -px(12), px(90),  ORANGE, alpha=100)
    img = add_glow(img, -px(12),  H + px(12), px(75), TEAL,   alpha=80)

    draw = ImageDraw.Draw(img)

    # 4. Accent bars top + bottom
    draw.rectangle([0, 0, W, px(4)],       fill=(*INDIGO, 255))
    draw.rectangle([0, H - px(3), W, H],   fill=(*INDIGO, 150))

    # 5. Logo
    logo_size = px(120)
    logo = render_logo_alpha(SVG_PATH, logo_size)
    lx   = (W - logo_size) // 2
    ly   = px(44)
    img.paste(logo, (lx, ly), logo)

    draw = ImageDraw.Draw(img)  # re-wrap after paste

    # 6. Title — Inter Bold (non-condensed), falls back to Calibri Bold
    title_font = _font_candidates(px(18))
    ty = ly + logo_size + px(14)
    ty = draw_centered(draw, ty, "Vibepollo", title_font, TITLE, W)
    ty += px(14)

    # 7. Badge pills — "Windows Game Streaming" / "Mic Passthrough"
    badge_font = _badge_font(px(9))

    bh1 = draw_badge(img, W // 2, ty + px(8),
                     "Windows Game Streaming", badge_font)
    ty += bh1 + px(8)

    draw_badge(img, W // 2, ty + px(8),
               "Mic Passthrough", badge_font)

    # 8. Convert and save
    rgb = img.convert("RGB")
    out = OUT_DIR / "wizard-sidebar.bmp"
    rgb.save(str(out), "BMP")
    print(f"Saved {out} ({W}x{H})")


# ── header: 55×55 logical → 110×110 rendered ─────────────────────────────────

def make_header():
    W, H = px(55), px(55)

    img = gradient_bg(W, H, BG_TOP, BG_BOT)
    img = add_noise(img, strength=12)
    img = add_glow(img, W + px(6), -px(6), px(42), ORANGE, alpha=100)

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
