import json,re,hashlib
from pathlib import Path
from collections import defaultdict,Counter
from expression_translations import apply_expression_translations
import nltk
nltk.data.path.insert(0,str(Path('work/nltk_data').resolve()))
from nltk.stem import WordNetLemmatizer
lemma=WordNetLemmatizer()
words=json.loads(Path('data/words.json').read_text('utf-8'))
dictionary=json.loads(Path('work/dictionary-source.json').read_text('utf-8'))
index=defaultdict(list)
posmap={'NN':'n.','VB':'v.','JJ':'adj.','RB':'adv.','IN':'prep.','CC':'conj.','DT':'det.','PR':'pron.','WP':'pron.','MD':'modal v.','UH':'exclam.','CD':'number','TO':'infinitive marker'}
bad=re.compile(r'\b(kill\w*|murder\w*|sex\w*|rap\w*|suicid\w*|fuck\w*|shit|stupid|hate\w*|die\w*|dead|naked|idiot|gun\w*)\b',re.I)
for line in Path('work/tatoeba/kor.txt').read_text('utf-8').splitlines():
    en,ko,credit=line.split('\t')
    tokens=re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[^\w\s]",en)
    if not 4<=len(en.split())<=15 or bad.search(en):continue
    tags=nltk.pos_tag(tokens)
    for i,(token,tag) in enumerate(tags):
        pos=posmap.get(tag[:2]);
        if not pos:continue
        base=lemma.lemmatize(token.lower(),{'n.':'n','v.':'v','adj.':'a','adv.':'r'}.get(pos,'n'))
        phrase=' '.join(tokens[max(0,i-1):min(len(tokens),i+3)]).replace(' .','').replace(' ,','')
        ids=re.findall(r'#(\d+)',credit)
        rec={'example':en,'translation':ko,'expression':phrase,'source':'Tatoeba 참고 예문','attribution':credit,'url':'https://tatoeba.org/en/sentences/show/'+ids[0]}
        index[(base,pos)].append(rec)
        if base!=token.lower():index[(token.lower(),pos)].append(rec)

# Authored examples list explicit targets and senses, avoiding ambiguous POS inference.
authored={}
for file in sorted(Path('data').glob('authored-*.tsv')):
    for line in file.read_text('utf-8').splitlines():
        if not line or line.startswith('#'):continue
        targets,en,ko=line.split('\t')
        for target in re.split(r';(?=[^;|]+\|(?:n\.|v\.|adj\.|adv\.|prep\.|pron\.|det\.|conj\.|exclam\.|number|modal v\.|auxiliary v\.|indefinite article|definite article|infinitive marker)\|)',targets):
            head,pos,meaning,expression=target.split('|')
            authored[(head,pos)]={'meaning':meaning,'expression':expression,'example':en,'translation':ko,'source':'학습용 작성 예문'}
overrides={}
if Path('data/meaning-overrides.json').exists():overrides=json.loads(Path('data/meaning-overrides.json').read_text('utf-8'))
for line in Path('data/meaning-overrides.tsv').read_text('utf-8').splitlines():
    if line.strip():
        head,pos,meaning=line.split('|');overrides[head+'|'+pos]=meaning
output={};missing=[]
for w in words:
    key=(w['headword'],w['pos']); fallback=(w['word'],w['pos'])
    d=dictionary.get(w['word'].lower(),{})
    examples=index.get((w['word'].lower(),w['pos']),[])
    example=min(examples,key=lambda x:abs(len(x['example'].split())-7)) if examples else {}
    own=authored.get(key,authored.get(fallback,{}))
    meaning=overrides.get('|'.join(key),overrides.get('|'.join(fallback),d.get('meaning_ko','')))
    content={'meaning':meaning,'ipa':'','expression':'','example':'','translation':'','source':'참고 풀이',**(own or example)}
    output[w['id']]=content
    if not content['example'] or not content['meaning']:missing.append({**w,'meaning':content['meaning']})
for key,patch in json.loads(Path('data/reviewed-content-overrides.json').read_text('utf-8')).items():
    output[key].update(patch)
    if patch.get('source')=='학습용 작성 예문':
        output[key].pop('attribution',None);output[key].pop('url',None)
output=apply_expression_translations(output)
Path('data/content.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
Path('work/missing-content.json').write_text(json.dumps(missing,ensure_ascii=False,indent=2),encoding='utf-8')
unique=list(dict.fromkeys((w['headword'],w['pos'],w['meaning']) for w in missing))
Path('work/missing-content.tsv').write_text('\n'.join('|'.join(w) for w in unique),encoding='utf-8')
print(json.dumps({'total':len(output),'complete':len(output)-len(missing),'missing':len(missing),'uniqueMissing':len(unique),'sources':dict(Counter(c['source'] for c in output.values()))}))
