import sys
import os
import io
import zipfile

root = sys.argv[1]
skip = {'node_modules', '.git', '.monkeycode-tmp-files', 'dist', '.cache',
        '__pycache__', '.venv', 'coverage'}
# Dotfiles shipped in backups on purpose (restorable config). Everything else
# dot-prefixed stays excluded so secrets/tooling never leak.
ALLOW_DOT = {'.env', '.gitignore'}

buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in skip and not d.startswith('.')]
        for f in files:
            full = os.path.join(base, f)
            rel = os.path.relpath(full, root).replace(os.sep, '/')
            parts = rel.split('/')
            if any(s.startswith('.') for s in parts) and f not in ALLOW_DOT:
                continue
            zf.write(full, rel)

sys.stdout.buffer.write(buf.getvalue())
