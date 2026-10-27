import pymupdf
from PIL import Image
images=[]
for name,index in [('english-house-200',0),('tamil-lease-shop-200',2)]:
    doc=pymupdf.open(f'tmp/pdfs/alignment-check/{name}-painting-5000.5.pdf')
    pix=doc[index].get_pixmap(matrix=pymupdf.Matrix(.85,.85))
    images.append(Image.frombytes('RGB',[pix.width,pix.height],pix.samples))
out=Image.new('RGB',(sum(x.width for x in images),max(x.height for x in images)),'#eee');offset=0
for im in images:out.paste(im,(offset,0));offset+=im.width
out.save('tmp/pdfs/alignment-check/alignment.png')
