"""Generate the PNG app icons for 余记 from a small vector-like drawing."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = ROOT / "icons"
ICON_DIR.mkdir(exist_ok=True)

S = 2048
U = S / 512
GREEN = (20, 56, 46, 255)
GREEN_LIGHT = (32, 88, 70, 255)
CREAM = (251, 247, 238, 255)
CREAM_DEEP = (243, 234, 216, 255)
CORAL = (240, 124, 87, 255)
CORAL_DARK = (214, 95, 59, 255)


def xy(value):
    return int(round(value * U))


def gradient_background():
    image = Image.new("RGBA", (S, S), GREEN)
    draw = ImageDraw.Draw(image)
    for y in range(S):
        t = y / max(1, S - 1)
        color = tuple(int(GREEN_LIGHT[i] * (1 - t) + GREEN[i] * t) for i in range(3)) + (255,)
        draw.line([(0, y), (S, y)], fill=color)
    return image


def content_layer():
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    # Cream coin
    draw.ellipse(
        [xy(98), xy(108), xy(414), xy(424)],
        fill=CREAM,
    )
    # Soft inner edge
    draw.ellipse(
        [xy(111), xy(121), xy(401), xy(411)],
        outline=(255, 255, 255, 36),
        width=xy(2),
    )

    # ¥ glyph
    stroke = xy(31)
    segments = [
        ((xy(194), xy(167)), (xy(256), xy(236))),
        ((xy(256), xy(236)), (xy(318), xy(167))),
        ((xy(256), xy(236)), (xy(256), xy(378))),
        ((xy(206), xy(271)), (xy(306), xy(271))),
        ((xy(206), xy(312)), (xy(306), xy(312))),
    ]
    for start, end in segments:
        draw.line([start, end], fill=GREEN, width=stroke)
    cap = stroke / 2
    for point in {point for segment in segments for point in segment}:
        draw.ellipse(
            [point[0] - cap, point[1] - cap, point[0] + cap, point[1] + cap],
            fill=GREEN,
        )

    # Coral leaf
    leaf = [
        (xy(343), xy(121)),
        (xy(366), xy(120)),
        (xy(402), xy(151)),
        (xy(392), xy(174)),
        (xy(366), xy(166)),
        (xy(348), xy(143)),
    ]
    draw.polygon(leaf, fill=CORAL)
    draw.line(
        [(xy(346), xy(124)), (xy(384), xy(160))],
        fill=CORAL_DARK,
        width=xy(5),
        joint="curve",
    )

    # Small accent dots
    draw.ellipse([xy(391), xy(252), xy(411), xy(272)], fill=CORAL)
    draw.ellipse([xy(108), xy(333), xy(120), xy(345)], fill=(247, 241, 228, 132))
    return layer


def rounded_mask(radius):
    mask = Image.new("L", (S, S), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, S - 1, S - 1], radius=xy(radius), fill=255)
    return mask


def scaled_content(layer, factor):
    size = int(S * factor)
    resized = layer.resize((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    offset = (S - size) // 2
    canvas.alpha_composite(resized, (offset, offset))
    return canvas


def save(image, name, size):
    image.resize((size, size), Image.Resampling.LANCZOS).save(ICON_DIR / name, optimize=True)


def main():
    background = gradient_background()
    content = content_layer()

    regular = background.copy()
    regular.alpha_composite(content)
    regular.putalpha(rounded_mask(118))

    save(regular, "icon-180.png", 180)
    save(regular, "icon-192.png", 192)
    save(regular, "icon-512.png", 512)

    maskable = background.copy()
    maskable.alpha_composite(scaled_content(content, 0.84))
    save(maskable, "icon-512-maskable.png", 512)

    print("Generated icons in", ICON_DIR)


if __name__ == "__main__":
    main()
