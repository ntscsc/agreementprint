from pathlib import Path
import pymupdf
from PIL import Image, ImageDraw
files=list(Path('tmp/pdfs/preview-a4').glob('*.pdf'))
for path in files:
    d=pymupdf.open(path)
    for i,p in enumerate(d):
        assert abs(p.rect.height-841.89)<1
        assert f'Page {i+1} of {len(d)}' in p.get_text(),path
images=[]
for i in [1,2,3]:
    d=pymupdf.open('tmp/pdfs/preview-a4/tamil-lease-shop-200.pdf')
    pix=d[i].get_pixmap(matrix=pymupdf.Matrix(.8,.8))
    im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
    tile=Image.new('RGB',(im.width,im.height+30),'#ddd');tile.paste(im,(0,30));ImageDraw.Draw(tile).text((8,8),f'Page {i+1}',fill='black');images.append(tile)
sheet=Image.new('RGB',(sum(i.width for i in images),max(i.height for i in images)),'white');x=0
for im in images:sheet.paste(im,(x,0));x+=im.width
sheet.save('tmp/pdfs/preview-a4/pages-2-3-4.png')
print(f'Passed A4 PDF geometry and extracted page numbering: {len(files)} PDFs')
