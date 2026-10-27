from pathlib import Path
import pymupdf
from PIL import Image, ImageDraw
images=[]
for name,index in [('english-shop-200',2),('tamil-house-200',3),('tamil-lease-shop-200',2),('tamil-lease-shop-200',3)]:
    d=pymupdf.open(f'tmp/pdfs/fixed-a4/{name}.pdf')
    pix=d[index].get_pixmap(matrix=pymupdf.Matrix(.8,.8))
    im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
    tile=Image.new('RGB',(im.width,im.height+30),'#dddddd');tile.paste(im,(0,30));ImageDraw.Draw(tile).text((8,8),f'{name}: page {index+1}',fill='black');images.append(tile)
w=sum(i.width for i in images);h=max(i.height for i in images)
sheet=Image.new('RGB',(w,h),'white');x=0
for im in images:sheet.paste(im,(x,0));x+=im.width
sheet.save('tmp/pdfs/fixed-a4/final-pages.png')
for path in Path('tmp/pdfs/fixed-a4').glob('*.pdf'):
    d=pymupdf.open(path)
    for i,p in enumerate(d):
        assert f'Page {i+1} of {len(d)}' in p.get_text(),path
print('Verified PDF page counts and extracted footers for all 16 variants')
