from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root = Path(__file__).resolve().parents[1]
canvas = Image.new('RGB', (1200, 630), '#f8fafc')
draw = ImageDraw.Draw(canvas)
draw.rectangle((0,0,18,630), fill='#0b4f86')
draw.ellipse((870,-220,1390,300), fill='#eff6ff')
logo = Image.open(root/'public/nts-logo.jpeg').convert('RGBA')
logo = logo.crop(logo.getbbox())
logo.thumbnail((150,100), Image.Resampling.LANCZOS)
canvas.paste(logo, (76,48), logo)
def text(position, value, size, color, bold=False):
    font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf' if bold else 'C:/Windows/Fonts/arial.ttf', size)
    draw.text(position, value, font=font, fill=color)
text((250,73), 'AgreementPrint', 40, '#0b4f86', True)
text((76,190), 'Online Rental Agreements', 62, '#16436a', True)
text((76,268), 'in Tamil Nadu', 62, '#16436a', True)
text((80,379), 'Prepared. Printed on stamp paper. Delivered.', 29, '#475569')
draw.rectangle((76,479,1124,481), fill='#cbd5e1')
text((80,522), 'agreementprint.in', 28, '#0b4f86', True)
canvas.save(root/'public/images/social-share.png', optimize=True)
