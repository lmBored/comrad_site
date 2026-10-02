"""Copy and web-optimise the figures the project page uses.

Sources of truth:
  ../paper/figure/                      paper figures (latest)
  ../COMRAD_Poster/poster/v3/fig/       dark poster versions + DoomGen pipeline
  assets/visuals/                       Freedoom sprites / textures (BSD licence)

Usage (from comrad_site/):  python tools/prepare_assets.py
Writes into assets/{scen,views,fig,sprites,tex,video}/.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image

SITE = Path(__file__).resolve().parents[1]
ROOT = SITE.parent
PAPER = ROOT / "paper" / "figure"
POSTER = ROOT / "COMRAD_Poster" / "poster" / "v3"
VIS = SITE / "assets" / "visuals"
OUT = SITE / "assets"


def jpg(src: Path, dst: Path, max_w: int, q: int = 82) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(src)
    if im.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", im.size, (0, 0, 0) if "poster" in str(src).lower() else (255, 255, 255))
        im = im.convert("RGBA")
        bg.paste(im, mask=im.split()[-1])
        im = bg
    im = im.convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(dst, "JPEG", quality=q, optimize=True, progressive=True)


def scen_frame(src: Path, dst: Path) -> None:
    """Trim transparent margins, put on black, cover-crop to 16:9 at 960x540."""
    import numpy as np
    dst.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(src)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        a = np.array(im)[..., 3]
        ys, xs = np.where(a.max(1) > 10)[0], np.where(a.max(0) > 10)[0]
        im = im.crop((xs[0], ys[0], xs[-1] + 1, ys[-1] + 1))
        bg = Image.new("RGB", im.size, (0, 0, 0))
        bg.paste(im, mask=im.split()[-1])
        im = bg
    im = im.convert("RGB")
    w, h = im.size
    tw, th = w, round(w * 9 / 16)
    if th > h:
        th, tw = h, round(h * 16 / 9)
    l, t = (w - tw) // 2, (h - th) // 2
    im.crop((l, t, l + tw, t + th)).resize((960, 540), Image.LANCZOS).save(dst, "JPEG", quality=80, optimize=True, progressive=True)


def png(src: Path, dst: Path, max_w: int | None = None) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(src)
    if max_w and im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(dst, "PNG", optimize=True)


def main() -> None:
    # scenario thumbnails (first-person views, 1920x1080 sources)
    for n in range(1, 13):
        scen_frame(PAPER / "scenarios" / f"{n}.png", OUT / "scen" / f"{n}.jpg")
    # two annotated views per scenario (appendix)
    for p in sorted((PAPER / "appendix_scenario").glob("*.jpg")):
        jpg(p, OUT / "views" / p.name, 816, 80)
    jpg(PAPER / "reward_1.png", OUT / "views" / "reward_1.jpg", 1280, 82)
    jpg(PAPER / "reward_2.png", OUT / "views" / "reward_2.jpg", 1280, 82)

    # paper figures
    jpg(PAPER / "baseline_learning_curves.png", OUT / "fig" / "learning_curves.jpg", 2400, 84)
    jpg(PAPER / "categories_with_difficulty.png", OUT / "fig" / "taxonomy.jpg", 2000, 86)
    jpg(PAPER / "infras.png", OUT / "fig" / "infras.jpg", 1646, 88)
    jpg(PAPER / "agent_scaling_learning.png", OUT / "fig" / "agent_scaling_learning.jpg", 1400, 86)

    # dark poster figures
    for name in ["ammo_ippo_annot", "ammo_happo_annot", "difficulty_axes"]:
        png(POSTER / "fig" / f"{name}.png", OUT / "fig" / f"{name}.png", 1600)
    for i in (1, 2, 3):
        png(POSTER / "fig" / f"doomgen_step{i}.png", OUT / "fig" / f"doomgen_step{i}.png", 600)
    for i in range(1, 7):
        jpg(POSTER / "fig" / f"doomgen_variant_{i}.png", OUT / "fig" / f"doomgen_variant_{i}.jpg", 900, 84)

    # Freedoom sprites used on the page and in the mini-game
    sprites = ["playa1", "playa2a8", "playb1", "playc1", "playe1", "playf1", "plyca1",
               "trooa1", "troob1", "possa1", "sarga1", "skula1", "skulb1", "heada1", "paina1",
               "bossa1", "bossb1", "bosse1", "bossi0", "spida1", "cposa1", "fatta1",
               "rkeya0", "bkeya0", "ykeya0", "ammoa0", "clipa0", "media0", "stima0", "soula0", "bar1a0",
               "bal1a0", "pisga0", "pisfa0", "misfa0", "puffa0", "puffb0", "tfoga0", "tfogb0", "tfogc0"]
    for s in sprites:
        src = VIS / "SPRITES" / f"{s}.png"
        if src.exists():
            (OUT / "sprites").mkdir(parents=True, exist_ok=True)
            shutil.copy(src, OUT / "sprites" / src.name)
        else:
            print("missing sprite", s)
    for g in ["stfst00", "stfst01", "stfst02", "stfst10", "stfst11", "stfst12", "stfkill0", "stfevl0",
              "stfouch0", "stfgod0", "stfdead0", "stftl00", "stftr00"]:
        src = VIS / "graphics" / f"{g}.png"
        if src.exists():
            shutil.copy(src, OUT / "sprites" / src.name)
        else:
            print("missing face", g)

    # textures for the mini-game
    (OUT / "tex").mkdir(parents=True, exist_ok=True)
    for t in ["stonew1.png", "stonew5.png", "flat1_1.png", "flat5_4.png"]:
        shutil.copy(POSTER / "assets" / t, OUT / "tex" / t)

    # lighter hero loop + poster frame from the split-screen demo
    (OUT / "video").mkdir(parents=True, exist_ok=True)
    demo = SITE / "comrad_vid_540.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(demo), "-an", "-vf", "scale=1280:-2",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-movflags", "+faststart",
                    "-pix_fmt", "yuv420p", str(OUT / "video" / "demo_loop.mp4")], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT / "video" / "demo_loop.mp4"), "-ss", "4", "-frames:v", "1",
                    "-q:v", "3", str(OUT / "video" / "demo_poster.jpg")], check=True)
    for algo in ["IPPO", "HAPPO"]:
        src = OUT / f"ammo_carrier_{algo}_topdown_heatmap_best_ep03_1600x1200.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-an", "-vf", "scale=800:-2",
                        "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-movflags", "+faststart",
                        "-pix_fmt", "yuv420p", str(OUT / "video" / f"ammo_{algo.lower()}.mp4")], check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "8" if algo == "HAPPO" else "40", "-i", str(src), "-frames:v", "1",
                        "-vf", "scale=800:-2", "-q:v", "4", str(OUT / "video" / f"ammo_{algo.lower()}.jpg")],
                       check=True)
        # inverted "automap" variant used when the rollouts play on the dark page
        for ext, extra in [("mp4", ["-c:v", "libx264", "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]), ("jpg", ["-q:v", "4"])]:
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT / "video" / f"ammo_{algo.lower()}.{ext}"),
                            "-vf", "negate,eq=saturation=1.4:brightness=0.02", *extra,
                            str(OUT / "video" / f"ammo_{algo.lower()}_dark.{ext}")], check=True)
    # Not automated here (one-off, done by hand and committed):
    #   assets/data/curves.json   learning curves traced from paper/figure/baseline_learning_curves.pdf (pdfplumber)
    #   assets/scen/t*.jpg        tone-mapped scenario thumbnails
    #   assets/fig/ammo_*_map.png automaps recoloured from the poster
    #   assets/fig/doomgen_step*  DoomGen steps recoloured for the dark page
    #   assets/sprites/sttdot.png decimal point drawn to match the Freedoom STTNUM glyphs
    print("done")


if __name__ == "__main__":
    main()
