import sys
import os
import io
import json
import zipfile

root = sys.argv[1]
data = sys.stdin.buffer.read()
skip = {'node_modules', '.git', '.monkeycode-tmp-files', 'dist', '.cache',
        '__pycache__', '.venv', 'coverage'}
ALLOW_DOT = {'.env', '.gitignore'}

written = []
skipped = []

try:
    z = zipfile.ZipFile(io.BytesIO(data))
except Exception as e:
    print(json.dumps({'error': 'Not a valid zip: ' + str(e)}))
    sys.exit(1)

root_abs = os.path.abspath(root)

for info in z.infolist():
    n = info.filename.replace('\\', '/')
    parts = [x for x in n.split('/') if x not in ('', '.')]
    if not parts:
        continue
    if n.startswith('/') or '..' in parts:
        skipped.append(n)
        continue
    fname = parts[-1]
    if fname.startswith('.') and fname not in ALLOW_DOT:
        skipped.append(n)
        continue
    if any(p in skip for p in parts) or any(p.startswith('.') for p in parts[:-1]):
        skipped.append(n)
        continue
    dest = os.path.abspath(os.path.join(root_abs, *parts))
    if not (dest == root_abs or dest.startswith(root_abs + os.sep)):
        skipped.append(n)
        continue
    if info.is_dir():
        os.makedirs(dest, exist_ok=True)
        continue
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with z.open(info) as src, open(dest, 'wb') as out:
        out.write(src.read())
    written.append(n)

print(json.dumps({'written': len(written), 'skipped': len(skipped),
                  'writtenFiles': written[:20], 'skippedFiles': skipped[:20]}))
