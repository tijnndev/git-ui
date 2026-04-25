"""
Generates all Tauri-required icons for git-ui.
Logo concept: black background, teal #009280 accent, stylized git branch/node graph.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

ICONS_DIR = os.path.join("src-tauri", "icons")
os.makedirs(ICONS_DIR, exist_ok=True)


def make_base_image(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = size * 0.06
    r = (size / 2) - pad

    # ── Background circle ──────────────────────────────────────────────
    cx, cy = size / 2, size / 2
    # Deep black fill
    draw.ellipse(
        [cx - r, cy - r, cx + r, cy + r],
        fill=(13, 13, 13, 255),
    )
    # Teal border ring
    border = max(2, size * 0.025)
    draw.ellipse(
        [cx - r, cy - r, cx + r, cy + r],
        outline=(0, 146, 128, 255),
        width=int(border),
    )

    # ── Git graph: 3 nodes + connecting lines ──────────────────────────
    s = size

    # Node positions (fractions of size)
    top    = (0.50, 0.18)
    mid    = (0.50, 0.50)
    bot    = (0.50, 0.82)
    feat   = (0.24, 0.50)

    def p(frac_x, frac_y):
        return (frac_x * s, frac_y * s)

    line_w = max(2, int(s * 0.045))
    node_r = max(4, s * 0.075)
    small_r = max(3, s * 0.055)

    # Line: top → mid (main, teal)
    draw.line([p(*top), p(*mid)], fill=(0, 146, 128, 255), width=line_w)
    # Line: mid → bot (main, teal)
    draw.line([p(*mid), p(*bot)], fill=(0, 146, 128, 255), width=line_w)
    # Line: top → feat (branch off, lighter teal)
    draw.line([p(*top), p(*feat)], fill=(0, 200, 150, 210), width=line_w)
    # Line: feat → mid (merge, lighter teal)
    draw.line([p(*feat), p(*mid)], fill=(0, 200, 150, 210), width=line_w)

    def draw_node(center, radius, fill, outline=(255, 255, 255, 220)):
        cx2, cy2 = center
        draw.ellipse(
            [cx2 - radius, cy2 - radius, cx2 + radius, cy2 + radius],
            fill=fill,
        )
        ow = max(1, int(radius * 0.18))
        draw.ellipse(
            [cx2 - radius, cy2 - radius, cx2 + radius, cy2 + radius],
            outline=outline,
            width=ow,
        )

    # Draw nodes
    draw_node(p(*top),  node_r,  (0, 146, 128, 255))    # main top – teal
    draw_node(p(*mid),  node_r,  (0, 168, 148, 255))    # merge  – lighter teal
    draw_node(p(*bot),  node_r,  (0, 120, 104, 255))    # main bot – deep teal
    draw_node(p(*feat), small_r, (0, 200, 150, 255))    # feature – bright teal

    return img


def save_png(img: Image.Image, path: str, size: int):
    out = img.resize((size, size), Image.LANCZOS)
    out.save(path, "PNG")
    print(f"  wrote {path}")


def main():
    # Generate high-res base (4096px for supersampling – PIL doesn't anti-alias
    # natively, so rendering at 4× and downscaling with LANCZOS gives smooth edges)
    base = make_base_image(4096)

    # ── Required PNG sizes ─────────────────────────────────────────────
    pngs = {
        "32x32.png":       32,
        "128x128.png":     128,
        "128x128@2x.png":  256,
        "icon.png":        1024,
    }
    for name, size in pngs.items():
        save_png(base, os.path.join(ICONS_DIR, name), size)

    # ── icon.ico  (multi-size) ─────────────────────────────────────────
    sizes_ico = [16, 24, 32, 48, 64, 128, 256]
    frames = [base.resize((s, s), Image.LANCZOS) for s in sizes_ico]
    ico_path = os.path.join(ICONS_DIR, "icon.ico")
    frames[0].save(
        ico_path,
        format="ICO",
        sizes=[(s, s) for s in sizes_ico],
        append_images=frames[1:],
    )
    print(f"  wrote {ico_path}")

    # ── icon.icns  (macOS) ─────────────────────────────────────────────
    icns_path = os.path.join(ICONS_DIR, "icon.icns")
    try:
        icns_sizes = [16, 32, 64, 128, 256, 512, 1024]
        icns_frames = [base.resize((s, s), Image.LANCZOS) for s in icns_sizes]
        icns_frames[0].save(
            icns_path,
            format="ICNS",
            append_images=icns_frames[1:],
        )
        print(f"  wrote {icns_path}")
    except Exception as e:
        # ICNS saving not available on all platforms; create a placeholder
        print(f"  ICNS skipped ({e}), writing placeholder PNG instead")
        save_png(base, icns_path, 512)

    print("\nAll icons generated successfully!")


if __name__ == "__main__":
    main()
