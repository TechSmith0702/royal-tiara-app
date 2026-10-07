# Builds the Android and iPhone app icons and splash screens from the brand artwork.
#
#   python scripts/generate-app-icons.py
#
# Needs Pillow (pip install pillow). Re-run it if public/app-icon.png or
# public/logo.png change, then rebuild the app.

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
STORE = ROOT / 'android' / 'play-store'
IOS_ASSETS = ROOT / 'ios' / 'App' / 'App' / 'Assets.xcassets'
CREAM = (0xF5, 0xEA, 0xD8, 255)

DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def white_to_alpha(img):
    """The artwork sits on white. Turn the white into transparency, keeping soft edges."""
    if img.mode == 'RGBA':
        return img  # already transparent
    img = img.convert('RGB')
    out = Image.new('RGBA', img.size)
    px, dst = img.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b = px[x, y]
            a = 255 - min(r, g, b)
            if a == 0:
                dst[x, y] = (0, 0, 0, 0)
                continue
            un = lambda c: max(0, min(255, round((c - (255 - a)) * 255 / a)))
            dst[x, y] = (un(r), un(g), un(b), a)
    return out


def crop_to_content(img):
    return img.crop(img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())


# The crown alone: in app-icon.png the crown ends at row 286 and the words
# "Royal Tiara" start below it.
icon_art = white_to_alpha(Image.open(ROOT / 'public' / 'app-icon.png'))
crown = crop_to_content(icon_art.crop((0, 0, icon_art.width, 288)))
logo = crop_to_content(white_to_alpha(Image.open(ROOT / 'public' / 'logo.png')))


def place(art, size, width_share, background=None):
    """Centre the artwork on a square/rectangle, `width_share` of the width wide."""
    w, h = size
    canvas = Image.new('RGBA', size, background or (0, 0, 0, 0))
    scale = min(w * width_share / art.width, h * 0.8 / art.height)
    piece = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.LANCZOS)
    canvas.alpha_composite(piece, ((w - piece.width) // 2, (h - piece.height) // 2))
    return canvas


def round_mask(img):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, img.width - 1, img.height - 1), fill=255)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


for name, k in DENSITIES.items():
    folder = RES / f'mipmap-{name}'
    # Adaptive icon (Android 8+): the launcher crops it, so the crown stays inside the middle 66%.
    place(crown, (round(108 * k),) * 2, 0.56).save(folder / 'ic_launcher_foreground.png')
    # Older phones: a finished square and round icon.
    legacy = place(crown, (round(48 * k),) * 2, 0.78, CREAM)
    legacy.save(folder / 'ic_launcher.png')
    round_mask(legacy).save(folder / 'ic_launcher_round.png')

# Splash screens: the full logo on cream, every size the template ships.
for path in RES.glob('drawable*/splash.png'):
    w, h = Image.open(path).size
    place(logo, (w, h), 0.5 if h > w else 0.32, CREAM).convert('RGB').save(path)

# Google Play listing: a 512px icon.
STORE.mkdir(exist_ok=True)
place(crown, (512, 512), 0.74, CREAM).convert('RGB').save(STORE / 'icon-512.png')

# iPhone: one 1024px icon (Apple rounds the corners and refuses transparency)
# and a 2732px square splash that is cropped to fit each screen.
if IOS_ASSETS.exists():
    place(crown, (1024, 1024), 0.72, CREAM).convert('RGB').save(IOS_ASSETS / 'AppIcon.appiconset' / 'AppIcon-512@2x.png')
    splash = place(logo, (2732, 2732), 0.25, CREAM).convert('RGB')
    for path in (IOS_ASSETS / 'Splash.imageset').glob('*.png'):
        splash.save(path)

print('App icons and splash screens written.')
