"""只读业务服务；所有入口共用授权与对象关联校验，避免页面切换串用数据。"""
from .data import COURSES, DATA_DIR, OFFERINGS, RECORDS, RESOURCES, TERMS, USERS


class APIError(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def can_view(user, offering):
    """模拟策略：教师仅看本人任课；主任和督导仅看所属系。"""
    if user["role"] == "teacher":
        return user["id"] in offering["teacher_ids"]
    return COURSES[offering["course_id"]]["department"] == user["department"]


def offering_for(user, offering_id, course_id=None):
    offering = OFFERINGS.get(offering_id)
    # 范围外与不存在统一返回404，不泄露范围外对象是否存在。
    if not offering or not can_view(user, offering):
        raise APIError(404, "offering_unavailable", "开课不存在或不在当前身份的授权范围内。")
    if course_id and offering["course_id"] != course_id:
        raise APIError(400, "course_mismatch", "课程与开课不匹配，请重新选择。")
    return offering


def offering_view(offering):
    return {**offering, "course": COURSES[offering["course_id"]],
            "teachers": [USERS[t]["name"] for t in offering["teacher_ids"]],
            "term": next(t["name"] for t in TERMS if t["id"] == offering["term_id"])}


def list_offerings(user, term_id):
    if term_id not in {t["id"] for t in TERMS}:
        raise APIError(400, "invalid_term", "请选择有效学期。")
    return [offering_view(o) for o in OFFERINGS.values() if o["term_id"] == term_id and can_view(user, o)]


def related(resource, offering):
    return resource["course_id"] == offering["course_id"] and resource["offering_id"] in (None, offering["id"])


def resource_state(user, resource):
    if user["role"] not in resource["allowed_roles"]:
        return "forbidden", "权限不足"
    if not resource["file"]:
        return "no_entry", "暂无入口"
    if not (DATA_DIR / resource["file"]).is_file():
        return "broken", "入口失效"
    return "available", "可访问"


def list_resources(user, offering_id):
    offering = offering_for(user, offering_id)
    result = []
    for r in RESOURCES.values():
        if related(r, offering):
            state, label = resource_state(user, r)
            result.append({k: r[k] for k in ("id", "name", "description", "source")} | {
                "scope": "课程共用" if r["offering_id"] is None else "本次开课",
                "status": state, "status_label": label,
                "url": f"/api/resources/{r['id']}/content?offering_id={offering_id}" if state == "available" else None})
    return result


def resource_content(user, resource_id, offering_id):
    offering = offering_for(user, offering_id)
    resource = RESOURCES.get(resource_id)
    if not resource or not related(resource, offering):
        raise APIError(404, "resource_unavailable", "当前开课没有此资料。")
    state, label = resource_state(user, resource)
    if state != "available":
        raise APIError(403 if state == "forbidden" else 404, state, label)
    return (DATA_DIR / resource["file"]).read_bytes()


def supervision(user, offering_id):
    offering = offering_for(user, offering_id)
    if user["role"] not in ("director", "supervisor"):
        raise APIError(403, "records_forbidden", "当前模拟身份无权查阅督导记录，请切换主任或教学督导身份。")
    records = [{k: r[k] for k in ("id", "offering_id", "date", "observer", "summary", "source")} | {
        "source_url": f"/api/records/{r['id']}/source?offering_id={offering_id}"}
        for r in RECORDS.values() if r["offering_id"] == offering_id]
    return {"records": records, "data_state": offering["records_state"],
            "notice": "这里只展示已登记事实。未查询到记录不等于未督导；本轮不计算覆盖率或教学评分。"}


def record_source(user, record_id, offering_id):
    supervision(user, offering_id)  # 原始事实入口沿用相同身份与开课范围校验。
    record = RECORDS.get(record_id)
    if not record or record["offering_id"] != offering_id:
        raise APIError(404, "record_unavailable", "当前开课没有此督导记录。")
    return (DATA_DIR / record["source_file"]).read_bytes()
