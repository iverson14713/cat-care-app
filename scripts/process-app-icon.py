"""Remove black/white borders and produce full-bleed orange app icons."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
_CURSOR_ASSETS = Path(
    r"C:\Users\USER\.cursor\projects"
    r"\c-Users-USER-Cat-Care-app-cat-care-app-main-cat-care-app-main"
    r"\assets"
)
_USER_ICON = _CURSOR_ASSETS / (
    "c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_09e8bde118ba217396e54466fd25c836_images_"
    "ChatGPT_Image_2026_5_18____12_15_10-562d25db-bc8d-4a21-941c-160161cb92de.png"
)
SRC = _USER_ICON if _USER_ICON.exists() else ROOT / "assets" / "app-icon-master.png"
if not SRC.exists() and (_CURSOR_ASSETS / "app-icon-master.png").exists():
    SRC = _CURSOR_ASSETS / "app-icon-master.png"
OUT_DIR = ROOT / "public"


def build_full_bleed_icon(src: Path) -> Image.Image:
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    arr = np.array(img, dtype=np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    orange_mask = (r > 110) & (g > 55) & (b < 130) & (r > b + 25)
    white_mask = (r > 200) & (g > 200) & (b > 200)
    dark_mask = (r < 55) & (g < 55) & (b < 55)
    # Dark vignette in corners (not quite black)
    dim_mask = (r < 100) & (g < 80) & (b < 60) & ~orange_mask & ~white_mask

    y_idx = np.arange(h)[:, None]
    top_band = orange_mask & (y_idx < h * 0.2)
    bottom_band = orange_mask & (y_idx > h * 0.8)
    top_color = arr[top_band][:, :3].mean(axis=0) if top_band.any() else np.array([255, 190, 90.0])
    bottom_color = (
        arr[bottom_band][:, :3].mean(axis=0) if bottom_band.any() else np.array([235, 105, 35.0])
    )

    edge = max(3, min(w, h) // 40)
    edge_white = (
        white_mask
        & (
            (y_idx < edge)
            | (y_idx >= h - edge)
            | (np.arange(w)[None, :] < edge)
            | (np.arange(w)[None, :] >= w - edge)
        )
    )

    out = np.zeros_like(arr)
    for y in range(h):
        t = y / max(h - 1, 1)
        grad = top_color * (1 - t) + bottom_color * t
        for x in range(w):
            if white_mask[y, x] and not edge_white[y, x]:
                out[y, x] = arr[y, x]
            elif orange_mask[y, x]:
                out[y, x] = arr[y, x]
            elif dim_mask[y, x]:
                out[y, x, :3] = grad
                out[y, x, 3] = 255.0
            else:
                out[y, x, :3] = grad
                out[y, x, 3] = 255.0

    result = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")

    # Square crop on non-dark content, then pad if needed
    rgb = np.array(result.convert("RGB"))
    content = (rgb.max(axis=2) > 60)
    ys, xs = np.where(content)
    if len(ys) == 0:
        return result
    y0, y1 = ys.min(), ys.max()
    x0, x1 = xs.min(), xs.max()
    side = max(y1 - y0, x1 - x0)
    cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
    half = side // 2
    y0 = max(0, cy - half)
    x0 = max(0, cx - half)
    y1 = min(h, y0 + side)
    x1 = min(w, x0 + side)
    cropped = result.crop((x0, y0, x1, y1))
    return cropped.resize((1024, 1024), Image.Resampling.LANCZOS)


def save_sizes(master: Image.Image) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sizes = {
        "favicon.png": 48,
        "apple-touch-icon.png": 180,
        "icon-192.png": 192,
        "icon-512.png": 512,
    }
    for name, size in sizes.items():
        icon = master.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(OUT_DIR / name, format="PNG", optimize=True)
        print(f"wrote {OUT_DIR / name} ({size}x{size})")


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Source image not found: {SRC}")
    master = build_full_bleed_icon(SRC)
    save_sizes(master)


if __name__ == "__main__":
    main()
