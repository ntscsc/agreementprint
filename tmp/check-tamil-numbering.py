from pathlib import Path
import pymupdf,re
for path in Path('tmp/pdfs/numbered-tamil').glob('tamil-*.pdf'):
    d=pymupdf.open(path);text='\n'.join(p.get_text() for p in d)
    text=text.split('\u0b9a\u0bbe\u0b9f\u0bcd\u0b9a\u0bbf\u0b95\u0bb3\u0bcd')[0]
    numbers=[int(n) for n in re.findall(r'(?m)^(\d+)\.\s',text)]
    assert len(numbers)>=10,(path,numbers)
    assert numbers==list(range(1,len(numbers)+1)),(path,numbers)
print('Tamil PDF clause numbers are consecutive across page breaks')
for name in ['tamil-house-100','tamil-lease-shop-200']:
    d=pymupdf.open(f'tmp/pdfs/numbered-tamil/{name}-painting-5000.5.pdf')
    for i in [1,len(d)-1]:d[i].get_pixmap(matrix=pymupdf.Matrix(.85,.85)).save(f'tmp/pdfs/numbered-tamil/{name}-page-{i+1}.png')
