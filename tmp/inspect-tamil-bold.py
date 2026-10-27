import pymupdf
from PIL import Image,ImageDraw
images=[]
for name,index in [('tamil-house-100',0),('tamil-house-100',1),('tamil-shop-200',3)]:
    doc=pymupdf.open(f'tmp/pdfs/tamil-bold/{name}-painting-5000.5.pdf')
    index=min(index,len(doc)-1)
    pix=doc[index].get_pixmap(matrix=pymupdf.Matrix(.8,.8))
    im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
    tile=Image.new('RGB',(im.width,im.height+24),'#eee');tile.paste(im,(0,24));ImageDraw.Draw(tile).text((8,6),f'{name}, page {index+1}',fill='black');images.append(tile)
out=Image.new('RGB',(sum(i.width for i in images),max(i.height for i in images)),'white');x=0
for im in images:out.paste(im,(x,0));x+=im.width
out.save('tmp/pdfs/tamil-bold/bold-review.png')
