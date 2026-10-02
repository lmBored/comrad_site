"""One grade for every scenario thumbnail: levels, matched exposure, muted colour, a touch of the page's olive.
Run once on the tone-mapped t*.jpg frames (it overwrites them in place)."""
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance, ImageStat
SC = Path(__file__).resolve().parents[1] / "assets" / "scen"
for src in sorted(SC.glob("[0-9]*.jpg")):
    im = Image.open(SC / f"t{src.stem}.jpg").convert("RGB")   # start from the cropped 960x540 frame
    im = ImageOps.autocontrast(im, cutoff=1, preserve_tone=True)
    L = ImageStat.Stat(im.convert("L")).mean[0] / 255
    g = __import__("math").log(0.36) / __import__("math").log(max(0.05, min(0.95, L)))
    im = im.point(lambda v: round(255 * (v / 255) ** g))
    im = ImageEnhance.Color(im).enhance(0.62)
    im = Image.blend(im, Image.new("RGB", im.size, (70, 66, 40)), 0.10)
    im = ImageOps.posterize(im, 5)
    im.save(SC / f"t{src.stem}.jpg", quality=84)
    print(src.stem, round(L, 2), round(g, 2))
