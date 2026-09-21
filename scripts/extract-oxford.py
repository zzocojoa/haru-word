"""Reproducible column-aware extraction; source PDF remains unmodified."""
import hashlib, json, re, sys
from collections import Counter
from pathlib import Path
import pdfplumber

src = Path(sys.argv[1])
out = Path('data')
out.mkdir(exist_ok=True)
rows, lines, level = [], [], None
positions = ['indefinite article', 'definite article', 'auxiliary v.', 'modal v.', 'exclam.', 'number', 'adj.', 'adv.', 'prep.', 'conj.', 'det.', 'pron.', 'n.', 'v.', 'ordinal number', 'infinitive marker']
pattern = re.compile(r'^(.*?)\s+('+'|'.join(re.escape(x) for x in positions)+r')(.*)$')
with pdfplumber.open(src) as pdf:
    for page_no, page in enumerate(pdf.pages, 1):
        bounds = [(40,171),(171,301.5),(301.5,432),(432,566)]
        for col, (left, right) in enumerate(bounds, 1):
            top = 150 if page_no == 1 else 25
            text = page.crop((left,top,right,800)).extract_text(x_tolerance=1.5,y_tolerance=3) or ''
            text = text.replace('light (from the sun/a lamp) n.,\nadj.', 'light (from the sun/a lamp) n., adj.').replace('second1 (next after the first)\ndet./number', 'second1 (next after the first) det./number').replace('exit v\n', 'exit v.\n').replace('percent noun.', 'percent n.').replace('wish v, n.', 'wish v., n.')
            for line in text.splitlines():
                line = line.strip()
                if not line: continue
                if line in ['A1','A2','B1','B2']:
                    level = line
                    continue
                lines.append({'page':page_no,'column':col,'line':line,'level':level})
                m = pattern.match(line)
                if not m:
                    print('UNPARSED',page_no,col,repr(line))
                    continue
                word, pos = m[1], m[2]+m[3]
                pos = pos.replace('/', ', ')
                parts = [x.strip() for x in pos.split(',')]
                for part in parts:
                    if part not in positions: print('BAD POS',line,repr(part))
                rows.append({'headword':word,'word':re.sub(r'\d(?=\s|$)', '',word).split(' (')[0], 'pos':parts, 'level':level,'page':page_no,'column':col,'sourceLine':line})

entries=[]
for row in rows:
    for pos in row['pos']:
        key = f"{row['headword']}|{pos}|{row['level']}"
        entries.append({'id':hashlib.sha256(key.encode()).hexdigest()[:16], 'word':row['word'], 'headword':row['headword'], 'pos':pos, 'level':row['level'], 'page':row['page']})
report={'source':src.name,'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'pages':13,'sourceRows':len(rows),'uniqueHeadwords':len(set(x['headword'] for x in rows)),'learningEntries':len(entries),'rowsByLevel':dict(Counter(x['level'] for x in rows)),'entriesByLevel':dict(Counter(x['level'] for x in entries)),'uniqueEntryIds':len(set(x['id'] for x in entries))}
Path('work/oxford-lines.json').write_text(json.dumps(lines,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'source-rows.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'words.json').write_text(json.dumps(entries,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(out/'source-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
