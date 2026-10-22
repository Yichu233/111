"""Run browser workflows against a new isolated scene database on every run."""
from pathlib import Path
import json, os, shutil, socket, subprocess, sys, time, urllib.request, uuid

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
node = shutil.which('node') or str(RUNTIME/'bin/node.exe')
env = os.environ.copy()
if (RUNTIME/'node_modules').exists():
    env['NODE_PATH'] = str(RUNTIME/'node_modules')
with socket.socket() as probe:
    probe.bind(('127.0.0.1', 0))
    port = probe.getsockname()[1]
database = ROOT/'var'/('qa-'+uuid.uuid4().hex[:12])/'aijiaoxue.sqlite3'
database.parent.mkdir(parents=True)
assert database.resolve().is_relative_to((ROOT/'var').resolve())
env['AIJIAOXUE_BASE_URL'] = f'http://127.0.0.1:{port}'
(ROOT/'artifacts/campus').mkdir(parents=True, exist_ok=True)
log = (database.parent/'server.log').open('w', encoding='utf-8')
server = subprocess.Popen([sys.executable,'-m','app.server','--port',str(port),'--database',str(database)],cwd=ROOT,stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
try:
    for _ in range(80):
        try:
            with urllib.request.urlopen(env['AIJIAOXUE_BASE_URL']+'/api/campus/bootstrap', timeout=1) as response:
                json.load(response)
            break
        except OSError:
            if server.poll() is not None:
                raise RuntimeError('Test server failed; see '+str(database.parent/'server.log'))
            time.sleep(.1)
    else:
        raise RuntimeError('Test server did not become ready')
    files=sys.argv[1:] or ['browser_campus.cjs','browser_polish.cjs','browser_workspace.cjs','browser_guest.cjs','browser_finish.cjs','browser_course_evidence.cjs','browser_terms_resources.cjs']
    for filename in files:
        assert filename in ['browser_campus.cjs','browser_polish.cjs','browser_workspace.cjs','browser_guest.cjs','browser_finish.cjs','browser_course_evidence.cjs','browser_terms_resources.cjs']
        subprocess.run([node,str(ROOT/'tests'/filename)],cwd=ROOT,env=env,check=True)
    print('Browser suite passed; isolated database: '+str(database))
finally:
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait()
    log.close()
