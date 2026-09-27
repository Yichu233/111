"""Sprint 1正常、异常和服务端权限集成测试。使用随机本地端口，无外部网络。"""
import http.client
import json
import threading
import unittest

from app.server import AppServer


class Sprint1Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = AppServer(("127.0.0.1", 0))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.cookie = ""

    def request(self, path, method="GET", body=None, extra=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        headers = {"Cookie": self.cookie}
        if body is not None:
            body = json.dumps(body)
            headers["Content-Type"] = "application/json"
        headers.update(extra or {})
        conn.request(method, path, body, headers)
        res = conn.getresponse()
        raw, status, response_headers = res.read(), res.status, dict(res.getheaders())
        if "Set-Cookie" in response_headers:
            self.cookie = response_headers["Set-Cookie"].split(";")[0]
        data = json.loads(raw) if response_headers.get("Content-Type", "").startswith("application/json") else raw.decode("utf-8")
        conn.close()
        return status, data, response_headers

    def login(self, identity="teacher-a"):
        status, data, _ = self.request("/api/demo-session", "POST", {"user_id": identity})
        self.assertEqual(status, 200)
        self.assertEqual(data["user"]["id"], identity)

    def get(self, path, status=200):
        actual, data, _ = self.request(path)
        self.assertEqual(actual, status, data)
        return data

    def test_us011_term_isolation_and_joint_teaching_deduplication(self):
        self.login("director")
        items = self.get("/api/offerings?term_id=2026-fall")["items"]
        self.assertEqual([o["id"] for o in items], ["K01", "K02", "K03", "K04"])
        self.assertEqual(items[0]["teachers"], ["林老师", "陈老师"])
        self.assertEqual([o["id"] for o in self.get("/api/offerings?term_id=2026-spring")["items"]], ["K05"])
        self.assertEqual(self.get("/api/offerings?term_id=2027-spring")["items"], [])

    def test_us014_teacher_membership_and_direct_object_access(self):
        self.login()
        self.assertEqual([o["id"] for o in self.get("/api/offerings?term_id=2026-fall")["items"]], ["K01", "K02"])
        for suffix in ("", "/resources", "/supervision"):
            self.get("/api/offerings/K03" + suffix, 404)
        self.login("teacher-b")
        self.assertEqual([o["id"] for o in self.get("/api/offerings?term_id=2026-fall")["items"]], ["K01", "K03", "K04"])
        self.login("teacher-empty")
        self.assertEqual(self.get("/api/offerings?term_id=2026-fall")["items"], [])
        self.get("/api/offerings/K01", 404)

    def test_us021_course_fields_and_missing_description(self):
        self.login("director")
        a = self.get("/api/offerings/K01")["course"]
        b = self.get("/api/offerings/K03")["course"]
        self.assertEqual((a["id"], a["code"]), ("C01", "CS301"))
        self.assertTrue(a["description"])
        self.assertIsNone(b["description"])

    def test_us022_offering_context_and_invalid_relationship(self):
        self.login()
        a = self.get("/api/offerings/K01?course_id=C01")
        b = self.get("/api/offerings/K02?course_id=C01")
        self.assertNotEqual(a["class_name"], b["class_name"])
        self.assertNotEqual(a["room"], b["room"])
        self.assertEqual(self.get("/api/offerings/K01?course_id=C02", 400)["error"], "course_mismatch")
        self.get("/api/offerings/missing", 404)

    def test_us051_shared_and_offering_specific_resources(self):
        self.login()
        a = self.get("/api/offerings/K01/resources")["items"]
        b = self.get("/api/offerings/K02/resources")["items"]
        self.assertEqual([r["id"] for r in a], ["R01", "R02", "R04", "R05", "R06"])
        self.assertEqual([r["id"] for r in b], ["R01", "R03"])
        self.assertEqual(a[0]["scope"], "课程共用")
        self.login("teacher-b")
        self.assertEqual(self.get("/api/offerings/K04/resources")["items"], [])

    def test_us052_source_missing_and_no_invented_entry(self):
        self.login()
        resources = {r["id"]: r for r in self.get("/api/offerings/K01/resources")["items"]}
        self.assertIn("模拟", resources["R01"]["source"])
        self.assertIsNone(resources["R05"]["source"])
        self.assertIsNone(resources["R05"]["url"])
        self.assertNotIn("file", resources["R01"])

    def test_us072_real_content_and_distinct_errors(self):
        self.login()
        content = self.get("/api/resources/R02/content?offering_id=K01")
        self.assertIn("2401班", content)
        self.assertEqual(self.get("/api/resources/R04/content?offering_id=K01", 404)["error"], "broken")
        self.assertEqual(self.get("/api/resources/R05/content?offering_id=K01", 404)["error"], "no_entry")
        self.assertEqual(self.get("/api/resources/R06/content?offering_id=K01", 403)["error"], "forbidden")

    def test_us072_permission_not_only_hidden_button(self):
        self.login()
        _, body, _ = self.request("/api/resources/R06/content?offering_id=K01")
        self.assertNotIn("RESTRICTED_BODY_R06", str(body))
        self.get("/api/resources/R02/content?offering_id=K02", 404)
        self.get("/app/fixtures/restricted.txt", 404)
        self.get("/fixtures/restricted.txt", 404)
        self.login("director")
        self.assertIn("RESTRICTED_BODY_R06", self.get("/api/resources/R06/content?offering_id=K01"))

    def test_us091_records_sources_and_context(self):
        self.login("supervisor")
        a = self.get("/api/offerings/K01/supervision")
        self.assertEqual([r["id"] for r in a["records"]], ["D01", "D02"])
        self.assertTrue(all(r["date"] and r["source"] and r["offering_id"] == "K01" for r in a["records"]))
        self.assertIn("K01", self.get(a["records"][0]["source_url"]))
        self.get("/api/records/D01/source?offering_id=K02", 404)
        b = self.get("/api/offerings/K02/supervision")
        self.assertEqual([r["id"] for r in b["records"]], ["D03"])

    def test_us091_missing_records_preserve_unknown(self):
        self.login("supervisor")
        result = self.get("/api/offerings/K04/supervision")
        self.assertEqual(result["records"], [])
        self.assertIn("未收全", result["data_state"])
        self.assertIn("不等于未督导", result["notice"])
        self.assertNotIn("coverage", result)

    def test_supervision_permissions_and_department_boundary(self):
        self.login()
        self.get("/api/offerings/K01/supervision", 403)
        self.get("/api/records/D01/source?offering_id=K01", 403)
        self.login("director")
        self.get("/api/offerings/K99", 404)
        self.get("/api/offerings/K99/resources", 404)
        self.get("/api/offerings/K99/supervision", 404)

    def test_sessions_untrusted_query_and_expiry(self):
        self.get("/api/offerings?term_id=2026-fall", 401)
        self.cookie = "demo_session=forged"
        self.get("/api/offerings/K01", 401)
        self.login("teacher-empty")
        self.assertEqual(self.get("/api/offerings?term_id=2026-fall&user_id=director")["items"], [])
        token = self.cookie.split("=", 1)[1]
        with self.server.session_lock:
            self.server.sessions[token] = ("teacher-empty", 0)
        self.get("/api/offerings/K01", 401)

    def test_input_validation_and_cross_site_switch(self):
        for body in ({"user_id": "no-one"}, {"user_id": []}, [], None):
            status, _, _ = self.request("/api/demo-session", "POST", body)
            self.assertIn(status, (400, 415))
        status, _, _ = self.request("/api/demo-session", "POST", {"user_id": "director"}, {"Origin": "http://evil.example"})
        self.assertEqual(status, 403)
        self.login()
        for query in ("", "?term_id=no-term", "?term_id=2026-fall&term_id=2026-spring"):
            self.get("/api/offerings" + query, 400)
        self.get("/api/resources/R01/content", 400)

    def test_static_assets_and_no_private_files(self):
        for path in ("/", "/app.js", "/styles.css"):
            status, body, headers = self.request(path)
            self.assertEqual(status, 200)
            self.assertTrue(body)
            self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.login()
        for path in ("/../data.py", "/%2e%2e/app/data.py", "/.git/config"):
            self.get(path, 404)


if __name__ == "__main__":
    unittest.main(verbosity=2)
