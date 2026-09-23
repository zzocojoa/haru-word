"""Apply reviewed fixes and emit heuristic candidates, never auto-certify semantics."""
import argparse,csv,json,re
from pathlib import Path
from expression_translations import apply_expression_translations

parser=argparse.ArgumentParser()
parser.add_argument('--apply',action='store_true')
parser.add_argument('--report',default='work/content-review-candidates.csv')
args=parser.parse_args()
path=Path('data/content.json')
content=json.loads(path.read_text('utf-8'))
fixes=json.loads(Path('data/reviewed-content-overrides.json').read_text('utf-8'))
if args.apply:
    for key,patch in fixes.items():
        content[key].update(patch)
        if patch.get('source')=='학습용 작성 예문':
            content[key].pop('attribution',None)
            content[key].pop('url',None)
    content=apply_expression_translations(content)
    path.write_text(json.dumps(content,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
words=json.loads(Path('data/words.json').read_text('utf-8'))
# Includes valid particles/pronouns/numerals: these are review candidates, not failures.
ending=re.compile(r'\b(?:a|an|the|of|to|for|with|in|on|at|by|from|my|your|his|her|their|our|two)$',re.I)
report=Path(args.report);report.parent.mkdir(parents=True,exist_ok=True)
rows=[]
for w in words:
    c=content[w['id']];reasons=[]
    if ending.search(c['expression']):reasons.append('표현 끝 검토')
    if re.search(r'[;·]',c['meaning']):reasons.append('단일 학습 뜻 검토 (동의어 병기 포함)')
    if reasons:rows.append({**{k:w[k] for k in ['id','word','pos','level']},'reason':' / '.join(reasons),**{k:c[k] for k in ['meaning','expression','example','translation']}})
with report.open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=['id','word','pos','level','reason','meaning','expression','example','translation']);writer.writeheader();writer.writerows(rows)
print(json.dumps({'reviewedOverrides':len(fixes),'remainingCandidates':len(rows),'expressionCandidates':sum('표현 끝' in r['reason'] for r in rows),'report':str(report)},ensure_ascii=False))
