from pathlib import Path
from pypdf import PdfReader
import pymupdf
files=list(Path('tmp/pdfs/review-fixes').glob('*.pdf'))
for path in files:
    r=PdfReader(path)
    for i,p in enumerate(r.pages):
        text=p.extract_text()
        assert f'Page {i+1} of {len(r.pages)}' in text, (path,i,'footer')
        fonts=p['/Resources']['/Font'].get_object()
        for font in fonts.values():
            font=font.get_object()
            assert '/ToUnicode' in font, (path,'missing text mapping')
            if font['/Subtype']=='/Type3':
                assert font.get('/CharProcs'), (path,'missing embedded glyphs')
            else:
                descendants=font.get('/DescendantFonts',[font])
                for child in descendants:
                    descriptor=child.get_object()['/FontDescriptor'].get_object()
                    assert any(k in descriptor for k in ['/FontFile','/FontFile2','/FontFile3']), (path,'font not embedded')
    assert 'Arun Kumar' in ''.join(p.extract_text() for p in r.pages), path
print(f'Passed selectable text, embedded fonts and page numbering: {len(files)} PDFs')
for name in ['english-house-200','tamil-lease-shop-100']:
    doc=pymupdf.open(f'tmp/pdfs/review-fixes/{name}.pdf')
    for i,page in enumerate(doc):
        page.get_pixmap(matrix=pymupdf.Matrix(.75,.75)).save(f'tmp/pdfs/review-fixes/{name}-page-{i+1}.png')
