"""Draw the COMRAD pixel wordmark (hand-authored 13-row bitmap letters, Doom-logo style bevel ramp)."""
from pathlib import Path
from PIL import Image

G = {
"C": """
.#######.
#########
###...###
###......
###......
###......
###......
###......
###......
###......
###...###
#########
.#######.""",
"O": """
.#######.
#########
###...###
###...###
###...###
###...###
###...###
###...###
###...###
###...###
###...###
#########
.#######.""",
"M": """
###.....###
####...####
#####.#####
###.###.###
###..#..###
###.....###
###.....###
###.....###
###.....###
###.....###
###.....###
###.....###
###.....###""",
"R": """
########.
#########
###...###
###...###
###...###
#########
########.
###.###..
###..###.
###...###
###...###
###...###
###...###""",
"A": """
.#######.
#########
###...###
###...###
###...###
#########
#########
###...###
###...###
###...###
###...###
###...###
###...###""",
"D": """
########.
#########
###...###
###...###
###...###
###...###
###...###
###...###
###...###
###...###
###...###
#########
########.""",
}
RAMP = {"p1": [(255, 214, 160), (247, 160, 72), (242, 128, 26), (196, 92, 12), (128, 56, 6)],
        "p2": [(214, 210, 255), (164, 158, 245), (125, 118, 232), (88, 80, 196), (50, 44, 130)]}

def lerp(a, b, t): return tuple(round(x + (y - x) * t) for x, y in zip(a, b))
def ramp(stops, t):
    t = max(0, min(1, t)) * (len(stops) - 1); i = min(int(t), len(stops) - 2)
    return lerp(stops[i], stops[i + 1], t - i)

def word(text, hue, gap=2, pad=2):
    rows = [G[c].strip("\n").split("\n") for c in text]
    H = len(rows[0]); W = sum(len(r[0]) for r in rows) + gap * (len(rows) - 1)
    on = set(); x0 = 0
    for r in rows:
        for y, line in enumerate(r):
            for x, ch in enumerate(line):
                if ch == "#": on.add((x0 + x, y))
        x0 += len(r[0]) + gap
    im = Image.new("RGBA", (W + pad * 2 + 1, H + pad * 2 + 1), (0, 0, 0, 0))
    P = lambda x, y, c: im.putpixel((x + pad, y + pad), c)
    # drop shadow, then outline
    for (x, y) in on: P(x + 1, y + 1, (0, 0, 0, 150))
    for (x, y) in on:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                q = (x + dx, y + dy)
                if q not in on and 0 <= q[0] + pad < im.width - 1 and 0 <= q[1] + pad < im.height - 1:
                    P(*q, (12, 10, 6, 255))
    for (x, y) in on:
        c = ramp(RAMP[hue], y / (H - 1))
        if (x, y - 1) not in on: c = lerp(c, (255, 255, 255), .45)
        elif (x - 1, y) not in on: c = lerp(c, (255, 255, 255), .18)
        if (x, y + 1) not in on: c = lerp(c, (0, 0, 0), .35)
        elif (x + 1, y) not in on: c = lerp(c, (0, 0, 0), .2)
        P(x, y, c + (255,))
    return im

if __name__ == "__main__":
    out = Path(__file__).resolve().parents[1] / "assets" / "sprites"
    for t, h in (("COM", "p1"), ("RAD", "p2")):
        im = word(t, h)
        im.save(out / f"wm_{t.lower()}.png")
        for k in (2, 12):
            im.resize((im.width * k, im.height * k), Image.NEAREST).save(out / f"wm_{t.lower()}@{k}x.png", optimize=True)
        print(t, im.size)
