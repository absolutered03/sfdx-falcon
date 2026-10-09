# Rebuild index.html from template + data. Run from this directory: python3 build/build.py
import json, os
here = os.path.dirname(os.path.abspath(__file__))
out_dir = os.path.dirname(here)
tpl = open(os.path.join(here, 'template.html')).read()
data = json.load(open(os.path.join(here, 'registry-data.json')))
ex = json.load(open(os.path.join(here, 'examples.json')))
# sanity: every example key maps to a real release
rel = {(t['slug'], r['version']) for t in data['tools'] for r in t['releases']}
for k in ex:
    s, v = k.split('@'); assert (s, v) in rel, k
def emb(o): return json.dumps(o, separators=(',', ':'), ensure_ascii=False).replace('</', '<\\/')
out = tpl.replace('__DATA__', emb(data)).replace('__EXAMPLES__', emb(ex))
assert '—' not in tpl and '—' not in json.dumps(ex, ensure_ascii=False), 'em dash in authored copy'
open(os.path.join(out_dir, 'index.html'), 'w').write(out)
print('index.html bytes:', len(out.encode()))
