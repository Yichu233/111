"""只读业务服务；所有入口共用授权与对象关联校验，避免页面切换串用数据。"""
from pathlib import Path



class APIError(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def offering_for(store, user, offering_id, course_id=None):
    offering = store.offering(offering_id)
    # 范围外与不存在统一返回404，不泄露范围外对象是否存在。
    if not offering or not store.can_view(user, offering):
        raise APIError(404, "offering_unavailable", "开课不存在或不在当前身份的授权范围内。")
    if course_id and offering["course_id"] != course_id:
        raise APIError(400, "course_mismatch", "课程与开课不匹配，请重新选择。")
    return offering


def offering_view(store, offering):
    teachers = store.teachers(offering['id'])
    return {**offering, 'course': store.course(offering['course_id']),
            'teacher_ids': [t['id'] for t in teachers], 'teachers': [t['name'] for t in teachers],
            'term': next(t['name'] for t in store.terms() if t['id'] == offering['term_id'])}


def list_offerings(store, user, term_id):
    if term_id not in {t['id'] for t in store.terms()}:
        raise APIError(400, 'invalid_term', '请选择有效学期。')
    return [offering_view(store, o) for o in store.offerings(user, term_id)]


def fixture_path(store, filename):
    # Reject absolute paths, traversal and symlink targets outside the fixture root.
    if not filename or Path(filename).is_absolute():
        return None
    try:
        path = (store.fixture_dir / filename).resolve()
        return path if path.is_relative_to(store.fixture_dir) else None
    except (OSError, ValueError):
        return None


def read_fixture(store, filename, code='broken'):
    path = fixture_path(store, filename)
    try:
        if path is None:
            raise OSError('invalid fixture path')
        return path.read_bytes()
    except (OSError, ValueError):
        raise APIError(404, code, '资料入口暂不可用，请返回当前开课重试。')

def related(resource, offering):
    return resource["course_id"] == offering["course_id"] and resource["offering_id"] in (None, offering["id"])


def resource_state(store, user, resource):
    if not store.allows(resource["id"], user["role"]):
        return "forbidden", "权限不足"
    if not resource["file"]:
        return "no_entry", "暂无入口"
    path = fixture_path(store, resource["file"])
    try:
        available = path is not None and path.is_file()
    except (OSError, ValueError):
        available = False
    if not available:
        return "broken", "入口失效"
    return "available", "可访问"


def list_resources(store, user, offering_id):
    offering = offering_for(store, user, offering_id)
    result = []
    for r in store.resources(offering):
        if related(r, offering):
            state, label = resource_state(store, user, r)
            result.append({k: r[k] for k in ("id", "name", "description", "source")} | {
                "scope": "课程共用" if r["offering_id"] is None else "本次开课",
                "status": state, "status_label": label,
                "url": f"/api/resources/{r['id']}/content?offering_id={offering_id}" if state == "available" else None})
    return result


def resource_content(store, user, resource_id, offering_id):
    offering = offering_for(store, user, offering_id)
    resource = store.resource(resource_id)
    if not resource or not related(resource, offering):
        raise APIError(404, "resource_unavailable", "当前开课没有此资料。")
    state, label = resource_state(store, user, resource)
    if state != "available":
        raise APIError(403 if state == "forbidden" else 404, state, label)
    return read_fixture(store, resource["file"])


def supervision(store, user, offering_id):
    offering = offering_for(store, user, offering_id)
    if user["role"] not in ("director", "supervisor"):
        raise APIError(403, "records_forbidden", "当前模拟身份无权查阅督导记录，请切换主任或教学督导身份。")
    records = [{k: r[k] for k in ("id", "offering_id", "date", "observer", "summary", "source")} | {
        "source_url": f"/api/records/{r['id']}/source?offering_id={offering_id}"}
        for r in store.records(offering_id)]
    return {"records": records, "data_state": offering["records_state"],
            "notice": "这里只展示已登记事实。未查询到记录不等于未督导；本轮不计算覆盖率或教学评分。"}


def record_source(store, user, record_id, offering_id):
    supervision(store, user, offering_id)  # 原始事实入口沿用相同身份与开课范围校验。
    record = store.record(record_id)
    if not record or record["offering_id"] != offering_id:
        raise APIError(404, "record_unavailable", "当前开课没有此督导记录。")
    return read_fixture(store, record["source_file"], "source_unavailable")
