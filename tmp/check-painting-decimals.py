from pathlib import Path
import pymupdf
word='\u0baa\u0bc6\u0baf\u0bbf\u0ba3\u0bcd\u0b9f\u0bcd'
files=list(Path('tmp/pdfs/painting-decimals').glob('*.pdf'))
assert len(files)==32,len(files)
for path in files:
    d=pymupdf.open(path);text=''.join(p.get_text() for p in d)
    positive='painting-5000.5' in path.name
    assert ('painting charges' in text or word in text)==positive,path
    if positive: assert '5,000.50' in text,path
    assert '5,000.5/-' not in text,path
for kind in ['tamil-lease-shop','english-shop']:
    d=pymupdf.open(f'tmp/pdfs/painting-decimals/{kind}-200-painting-5000.5.pdf')
    for p in d:
        if '5,000.50' in p.get_text():p.get_pixmap().save(f'tmp/pdfs/painting-decimals/{kind}-paise.png')
print('32 generated PDFs verified: positive deduction uses 5,000.50; zero omits painting')
