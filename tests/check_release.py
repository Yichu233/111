"""Check a checkout or source ZIP by starting it with a disposable database.

Usage: python tests/check_release.py [--archive path/to/source.zip] [--output result.json]
The existing scene database is never opened by this check.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path, PurePosixPath
import re
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile


def extract_source(archive, destination):
    """Accept a flat source ZIP or one enclosing folder; reject escaped paths."""
    with zipfile.ZipFile(archive) as bundle:
        for item in bundle.infolist():
            relative = PurePosixPath(item.filename)
            if relative.is_absolute() or '..' in relative.parts or '\\' in item.filename:
                raise ValueError('Unsafe archive path: ' + item.filename)
            target = (destination / item.filename).resolve()
            if not target.is_relative_to(destination.resolve()):
                raise ValueError('Archive entry leaves extraction directory')
        bundle.extractall(destination)
    roots = [destination] if (destination / 'app/server.py').is_file() else [p for p in destination.iterdir() if p.is_dir() and (p / 'app/server.py').is_file()]
    if len(roots) != 1:
        raise ValueError('Expected exactly one project root containing app/server.py')
    return roots[0]


def verify(project, scratch):
    """Run the server on a random local port, then request its real entry assets."""
    for relative in ['README.md', 'app/server.py', 'tests/test_sprint1.py', 'tests/test_campus.py']:
        if not (project / relative).is_file():
            raise ValueError('Missing release file: ' + relative)
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    database = scratch / 'isolated-data/aijiaoxue.sqlite3'
    environment = os.environ.copy()
    environment.update(PYTHONUTF8='1', PYTHONDONTWRITEBYTECODE='1')
    log_path = scratch / 'server.log'
    with log_path.open('w', encoding='utf-8') as log:
        process = subprocess.Popen(
            [sys.executable, '-m', 'app.server', '--port', str(port), '--database', str(database)],
            cwd=project, env=environment, stdout=log, stderr=log,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
        try:
            for _ in range(100):
                try:
                    with urllib.request.urlopen(base + '/api/campus/bootstrap', timeout=1) as response:
                        bootstrap = json.load(response)
                    break
                except (OSError, urllib.error.URLError):
                    if process.poll() is not None:
                        raise RuntimeError('Release server exited; ' + log_path.read_text(encoding='utf-8'))
                    time.sleep(.1)
            else:
                raise RuntimeError('Release server did not become ready')
            if len(bootstrap.get('users', [])) != 7:
                raise AssertionError('Expected seven local scenario identities')
            with urllib.request.urlopen(base + '/', timeout=5) as response:
                markup = response.read().decode('utf-8')
            routes = sorted(set(re.findall(r'(?:src|href)="(/[^"#]+)"', markup)))
            if not routes:
                raise AssertionError('Entry HTML references no local application assets')
            for route in routes:
                with urllib.request.urlopen(base + route, timeout=5) as response:
                    if response.status != 200 or not response.read():
                        raise AssertionError('Missing or empty asset: ' + route)
            return {'passed': True, 'scenario_identities': len(bootstrap['users']), 'static_assets': routes,
                    'database_isolated': True, 'business_form_submissions': 0}
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='aijiaoxue-release-') as name:
        scratch = Path(name)
        project = Path(__file__).resolve().parents[1]
        if args.archive:
            project = extract_source(args.archive.resolve(), scratch / 'source')
        result = verify(project, scratch)
    result.update(executed_at=datetime.now(timezone.utc).isoformat(), archive_checked=bool(args.archive))
    output = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output + '\n', encoding='utf-8')
    print(output)


if __name__ == '__main__':
    main()
