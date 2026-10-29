#!/usr/bin/env python3
"""Build deterministic development workspace and native module ZIPs.

Run npm run check, npm run spec:check and the Chromium smoke before packaging.
Foundry source references and local tools stay outside the project checkout.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {'.git', 'node_modules', '__pycache__', '.pytest_cache', '.venv', 'artifacts'}

def build_zip(files, prefix):
    stream = io.BytesIO()
    with ZipFile(stream, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for relative, data in sorted(files.items()):
            info = ZipInfo(prefix + '/' + relative, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    data = stream.getvalue()
    with ZipFile(io.BytesIO(data)) as archive:
        if archive.testzip() is not None:
            raise ValueError('Generated ZIP failed integrity verification')
    return data

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT.parent / 'artifacts')
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'module.json').read_text())
    package = json.loads((ROOT / 'package.json').read_text())
    version = manifest['version']
    if version != package['version'] or not version.endswith('-dev'):
        raise ValueError('This packager requires matching development versions')
    files = {}
    for path in ROOT.rglob('*'):
        relative = path.relative_to(ROOT)
        if any(p in EXCLUDED for p in relative.parts):
            continue
        if path.is_symlink():
            raise ValueError('Refusing to package a symlink: ' + str(relative))
        if path.is_file():
            files[relative.as_posix()] = path.read_bytes()
    runtime = {p: content for p, content in files.items() if p in {'module.json', 'README.md'} or p.startswith(('src/', 'static/', 'lang/'))}
    for required in manifest['esmodules'] + manifest['styles'] + [item['path'] for item in manifest['languages']]:
        if required not in runtime:
            raise ValueError('Missing declared runtime asset: ' + required)
    suffix = version.removesuffix('.0-dev')
    deliverables = {
        f'Easy_Plots_Development_Workspace_v{suffix}.zip': build_zip(files, f'easy_plots_v{suffix}'),
        f'Easy_Plots_Foundry_Module_v{suffix}_DEV.zip': build_zip(runtime, 'easy-plots')
    }
    # Verify every destination before writing either archive.
    args.output.mkdir(parents=True, exist_ok=True)
    for name, content in deliverables.items():
        destination = args.output / name
        if destination.exists() and destination.read_bytes() != content:
            raise FileExistsError('Refusing to replace a different existing artifact: ' + str(destination))
    sums = []
    for name, content in deliverables.items():
        destination = args.output / name
        if not destination.exists():
            destination.write_bytes(content)
        sums.append(hashlib.sha256(content).hexdigest() + '  ' + name)
        print(destination)
    checksums = args.output / f'SHA256SUMS_v{suffix}.txt'
    checksum_content = '\n'.join(sums) + '\n'
    if checksums.exists() and checksums.read_text() != checksum_content:
        raise FileExistsError('Existing checksum file differs: ' + str(checksums))
    checksums.write_text(checksum_content)
    print(checksums)

if __name__ == '__main__':
    main()
