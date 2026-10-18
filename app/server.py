"""本地教学HTTP服务，无第三方依赖。运行：python -m app.server。"""
import argparse
import json
import secrets
import threading
import time
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from .storage import Repository, DEFAULT_DATABASE, StorageError
import sqlite3
from .domain import APIError, list_offerings, list_resources, offering_for, offering_view, record_source, resource_content, supervision

STATIC = Path(__file__).resolve().parent / "static"
STATIC_ROUTES = {"/": ("index.html", "text/html"), "/app.js": ("app.js", "text/javascript"), "/public.js": ("public.js", "text/javascript"), "/public.css": ("public.css", "text/css"), "/styles.css": ("styles.css", "text/css")}


class AppServer(ThreadingHTTPServer):
    """会话保存在当前进程中，限时且有上限；重启后需重新选择模拟身份。"""
    daemon_threads = True

    def __init__(self, address, repository=None, database=DEFAULT_DATABASE):
        self.repository = repository or Repository(database)
        super().__init__(address, Handler)
        self.sessions = {}
        self.session_lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    server_version = "HummingbirdDemo/1.0"

    def reply(self, status, body, content_type="application/json", cookie=None):
        if content_type == "application/json":
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def query_one(self, query, key):
        values = query.get(key, [])
        if len(values) != 1 or not values[0]:
            raise APIError(400, "invalid_parameter", f"请提供唯一的{key}参数。")
        return values[0]

    def current_user(self, store):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            raise APIError(401, "session_required", "请先选择模拟身份。")
        token = cookie.get("demo_session")
        with self.server.session_lock:
            session = self.server.sessions.get(token.value if token else "")
        if not session or session[1] <= time.time():
            raise APIError(401, "session_required", "请先选择模拟身份；会话可能已过期。")
        user = store.user(session[0])
        if not user:
            raise APIError(401, "session_required", "模拟身份已不可用，请重新选择。")
        return user

    def do_GET(self):
        try:
            with self.server.repository.read() as store:
                self.get_response(store)
        except APIError as error:
            self.reply(error.status, {"error": error.code, "message": error.message})
        except (sqlite3.Error, StorageError):
            self.reply(503, {"error": "storage_unavailable", "message": "本地数据暂不可用，请重试。"})

    def get_response(self, store):
        try:
            parsed = urlsplit(self.path)
            path, query = parsed.path, parse_qs(parsed.query, keep_blank_values=True)
            if path in STATIC_ROUTES:
                name, mime = STATIC_ROUTES[path]
                return self.reply(200, (STATIC / name).read_bytes(), mime)
            if path == "/api/public-catalog":
                return self.reply(200, json.loads((STATIC.parent / "public_catalog.json").read_text(encoding="utf-8")))
            if path == "/api/bootstrap":
                try:
                    user = self.current_user(store)
                except APIError:
                    user = None
                return self.reply(200, {"users": store.users(), "terms": store.terms(), "user": user, "demo": True})
            user = self.current_user(store)
            pieces = path.strip("/").split("/")
            if path == "/api/offerings":
                return self.reply(200, {"items": list_offerings(store, user, self.query_one(query, "term_id"))})
            if len(pieces) == 3 and pieces[:2] == ["api", "offerings"]:
                course_id = self.query_one(query, "course_id") if "course_id" in query else None
                return self.reply(200, offering_view(store, offering_for(store, user, pieces[2], course_id)))
            if len(pieces) == 4 and pieces[:2] == ["api", "offerings"]:
                if pieces[3] == "resources":
                    return self.reply(200, {"items": list_resources(store, user, pieces[2])})
                if pieces[3] == "supervision":
                    return self.reply(200, supervision(store, user, pieces[2]))
            if len(pieces) == 4 and pieces[:2] == ["api", "resources"] and pieces[3] == "content":
                return self.reply(200, resource_content(store, user, pieces[2], self.query_one(query, "offering_id")), "text/plain")
            if len(pieces) == 4 and pieces[:2] == ["api", "records"] and pieces[3] == "source":
                return self.reply(200, record_source(store, user, pieces[2], self.query_one(query, "offering_id")), "text/plain")
            raise APIError(404, "not_found", "页面或接口不存在。")
        except APIError as error:
            self.reply(error.status, {"error": error.code, "message": error.message})
        except sqlite3.Error:
            raise
        except Exception:
            self.log_error("Unexpected request error")
            self.reply(500, {"error": "internal_error", "message": "服务发生错误，请查看终端并重试。"})

    def do_POST(self):
        try:
            with self.server.repository.read() as store:
                self.post_response(store)
        except APIError as error:
            self.reply(error.status, {"error": error.code, "message": error.message})
        except (sqlite3.Error, StorageError):
            self.reply(503, {"error": "storage_unavailable", "message": "本地数据暂不可用，请重试。"})

    def post_response(self, store):
        try:
            if self.path != "/api/demo-session":
                raise APIError(404, "not_found", "接口不存在。")
            # 同源JSON写入，仅用于选择公开的模拟身份；不是生产登录或学校认证。
            origin = self.headers.get("Origin")
            if origin and origin != "http://" + self.headers.get("Host", ""):
                raise APIError(403, "origin_rejected", "不接受跨站身份切换。")
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                raise APIError(415, "json_required", "请使用JSON请求。")
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                raise APIError(400, "invalid_length", "请求长度无效。")
            if not 0 < size <= 2048:
                raise APIError(400, "invalid_length", "请求体长度无效。")
            try:
                payload = json.loads(self.rfile.read(size))
            except (ValueError, UnicodeDecodeError):
                raise APIError(400, "invalid_json", "JSON内容无效。")
            user_id = payload.get("user_id") if isinstance(payload, dict) else None
            if not isinstance(user_id, str) or not store.user(user_id):
                raise APIError(400, "invalid_user", "请选择有效的模拟身份。")
            previous = SimpleCookie()
            try:
                previous.load(self.headers.get("Cookie", ""))
            except Exception:
                previous = SimpleCookie()
            previous_token = previous.get("demo_session")
            now, token = time.time(), secrets.token_urlsafe(32)
            with self.server.session_lock:
                self.server.sessions = {k: v for k, v in self.server.sessions.items() if v[1] > now}
                if previous_token:
                    self.server.sessions.pop(previous_token.value, None)
                if len(self.server.sessions) >= 512:
                    self.server.sessions.pop(next(iter(self.server.sessions)))
                self.server.sessions[token] = (user_id, now + 4 * 3600)
            self.reply(200, {"user": store.user(user_id)}, cookie=f"demo_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=14400")
        except APIError as error:
            self.reply(error.status, {"error": error.code, "message": error.message})


def main():
    parser = argparse.ArgumentParser(description="第15组 爱教学 本地模拟原型")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
    args = parser.parse_args()
    try:
        server = AppServer((args.host, args.port), database=args.database)
    except StorageError as error:
        parser.exit(1, str(error) + "\n")
    print(f"爱教学已启动：http://{args.host}:{server.server_port} （Ctrl+C停止；公开课程资料工作空间）", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
