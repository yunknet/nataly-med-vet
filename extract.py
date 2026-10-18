from pathlib import Path
import pypdfium2 as pdf
import re,json,shutil
from PIL import Image
root=Path(__file__).parent
out=root/'dist'; (out/'assets/pages').mkdir(parents=True,exist_ok=True)
sources=[('clinica','Guia de prescrição', 'ebook_b77c59da-cc26-45a6-885d-5d8d316e44a0_unlocked.pdf'),('posologia','Guia de posologia','ebook_bf1cfe85-1175-4f99-9ad0-93b4819e0dbb_unlocked.pdf')]
data={'documents':[],'pages':[],'records':[]}
specialties=['ALERGOLOGIA','CARDIOLOGIA','DERMATOLOGIA','ENDOCRINOLOGIA E METABOLOGIA','GASTROENTEROLOGIA','GINECOLOGIA E OBSTETRÍCIA','HEMATOLOGIA','HEPATOLOGIA E PANCREATOPATIAS','INFECTOLOGIA','NEFROLOGIA','NEUROLOGIA','ODONTOLOGIA','OFTALMOLOGIA','ORTOPEDIA','PNEUMOLOGIA','TOXICOLOGIA','UROLOGIA']
for docid,title,filename in sources:
    src=root/'sources'/f'{docid}.pdf'
    if not src.exists(): raise FileNotFoundError(f'Coloque o PDF original em {src}')
    d=pdf.PdfDocument(src); data['documents'].append({'id':docid,'title':title,'count':len(d),'author':'Lígia Rayssa F. de P. Rodrigues','edition':'2ª edição'})
    (root/'sources').mkdir(exist_ok=True)
    lines=[]
    for i,p in enumerate(d):
        text=p.get_textpage().get_text_range().replace('\r','')
        clean='\n'.join(l.strip() for l in text.splitlines() if l.strip() and not l.startswith('Licensed to'))
        data['pages'].append({'doc':docid,'page':i+1,'text':clean})
        lines.extend((l,i+1) for l in clean.splitlines())
        if not (out/'assets/pages'/f'{docid}-{i+1}.webp').exists():
            img=p.render(scale=1.7).to_pil(); img.save(out/'assets/pages'/f'{docid}-{i+1}.webp','WEBP',quality=82)
    current=None; group='Introdução'; route='Não especificada'
    for idx,(line,page) in enumerate(lines):
        if docid=='clinica':
            if page<13: continue
            if line in specialties:
                if current: data['records'].append(current); current=None
                group=line.capitalize()
            if line.startswith('REFERÊNCIAS'):
                if current: data['records'].append(current); current=None
                break
            start=idx+1<len(lines) and lines[idx+1][0]=='VISÃO GERAL'
            if start:
                if current: data['records'].append(current)
                current={'id':f'c{len(data["records"])}','title':line.capitalize(),'group':group,'doc':docid,'page':page,'end':page,'text':''}
        else:
            if page<6: continue
            if line.isupper() and ('USO ' in line):
                group=line.replace('–','—').capitalize()
                m=re.search(r'USO (ORAL|TÓPICO|OFTÁLMICO|OTOLÓGICO|ODONTOLÓGICO|INJETÁVEL)',line)
                if m: route=m.group(1).capitalize()
            start=bool(re.search(r'\(.*Farmácia.*\).*[-–—]{3}',line))
            if start:
                if current:data['records'].append(current)
                title2=re.split(r'\s*\(',line)[0].strip()
                current={'id':f'm{len(data["records"])}','title':title2,'group':group,'route':route,'doc':docid,'page':page,'end':page,'text':''}
        if current:
            current['text']+=line+'\n'; current['end']=page
    if current:data['records'].append(current)
for r in data['records']:
    t=r['text']; species=re.search(r'Espécie:\s*([^\n]+)',t)
    if species and r['doc']=='posologia': r['species']=species.group(1).strip('. ')
    elif re.search(r'felin|gatos',r['title'],re.I):r['species']='gatos'
    elif re.search(r'canin|cães',r['title'],re.I):r['species']='cães'
    else:r['species']='Consultar no texto'
    active=re.search(r'Princípio Ativo(?: e/ou Composição)?:\s*([^\n]+)',t)
    r['active']=active.group(1) if active else ''
    desc=re.search(r'Descrição:\s*([^\n]+)',t)
    r['summary']=desc.group(1) if desc else (r['active'] or r['group'])
    r['sections']=[s for s in ['PRESCRIÇÃO HOSPITALAR','PRESCRIÇÃO DOMICILIAR','Solicitações:','Recomendações:','Contra-Indicações:','Efeitos Adversos:','Incompatibilidade:'] if s in t]
(out/'data.json').write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
if not (out/'assets/nataly.webp').exists():
    Image.open(root/'sources/nataly.jpg').save(out/'assets/nataly.webp','WEBP',quality=90)
(root/'inventory.txt').write_text('\n'.join(f'{r["doc"]} | {r["page"]}-{r["end"]} | {r["group"]} | {r["title"]}' for r in data['records']),encoding='utf-8')
print(json.dumps({'pages':len(data['pages']),'records':len(data['records']),'clinical':sum(r['doc']=='clinica' for r in data['records'])}))
