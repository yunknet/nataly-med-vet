from pathlib import Path
import json,re
r=Path(__file__).parent
d=json.loads((r/'dist/data.json').read_text(encoding='utf-8'))
assert len(d['pages'])==369
assert len({x['id'] for x in d['records']})==len(d['records'])
assert len([x for x in d['records'] if x['doc']=='clinica'])==170
assert len([x for x in d['records'] if x['doc']=='posologia'])==611
assert len({x['group'] for x in d['records'] if x['doc']=='clinica'})==17
for doc in d['documents']:
    ps=[p for p in d['pages'] if p['doc']==doc['id']]
    assert [p['page'] for p in ps]==list(range(1,doc['count']+1))
    for p in ps:
        assert p['text'].strip()
        assert (r/'dist/assets/pages'/f'{doc["id"]}-{p["page"]}.webp').is_file()
for x in d['records']:
    assert x['text'].strip() and x['title'].strip()
    assert x['page']<=x['end']
    assert any(x['title'].lower() in p['text'].lower() for p in d['pages'] if p['doc']==x['doc'] and p['page']==x['page'])
    assert 'REFERÊNCIASBIBLIOGRÁFICAS' not in x['text']
assert all(x['group']=='Urologia' for x in d['records'] if x['title'] in ['Abscesso prostático','Hiperplasia prostática','Prostatite bacteriana'])
for path in (r/'dist').rglob('*'):
    if path.is_file(): assert path.stat().st_size<25*1024*1024, str(path)
print('PASS: 369 páginas, 781 fichas, 17 especialidades, IDs, fontes, limites de tamanho e arquivos visuais.')
