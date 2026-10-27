from PIL import Image, ImageDraw
p=Image.open('tmp/agreement-proof/AP-100021-live.png')
out=Image.new('RGB',(1200,610),'#eeeeee');draw=ImageDraw.Draw(out)
draw.text((12,8),'AP-100021 live browser: pages 2, 3 and 4 (each 1,122.52 CSS px high)',fill='black')
for i,y in enumerate([1446.515625,2601.03125,3755.546875]):
    tile=p.crop((378,int(y),1173,int(y+1122.515625))).resize((390,552))
    out.paste(tile,(i*400+5,45));draw.text((i*400+12,28),f'Page {i+2}',fill='black')
out.save('tmp/agreement-proof/AP-100021-pages-2-4.png')
