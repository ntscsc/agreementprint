from pathlib import Path
import pymupdf
word='\u0baa\u0bc6\u0baf\u0bbf\u0ba3\u0bcd\u0b9f\u0bcd'
files=list(Path('tmp/pdfs/painting-check').glob('*.pdf'))
assert len(files)==32,len(files)
for path in files:
    d=pymupdf.open(path)
    text=''.join(p.get_text() for p in d)
    positive='painting-2750' in path.name
    assert ('painting charges' in text or word in text)==positive,path
    if positive: assert '2,750' in text,path
    for i,p in enumerate(d):
        assert f'Page {i+1} of {len(d)}' in p.get_text(),path
print('32 PDFs passed: painting present for 2750, omitted for 0; page numbers intact')
for name in ['english-shop','tamil-shop','lease-shop','tamil-lease-shop']:
    d=pymupdf.open(f'tmp/pdfs/painting-check/{name}-200-painting-2750.pdf')
    for i,p in enumerate(d):
        if 'painting charges' in p.get_text() or word in p.get_text():
            p.get_pixmap(matrix=pymupdf.Matrix(.8,.8)).save(f'tmp/pdfs/painting-check/{name}-positive.png')
