"""Todo detail compatibility, using isolated SQLite and synthetic notes only."""
import pytest

from app.core.config import Settings
from app.models.todo import TodoStatus
from test_beli_workflow import db, make_project, task


@pytest.mark.parametrize("field", ["VOLC_ASR_APP_KEY", "VOLC_ASR_ACCESS_KEY"])
def test_asr_credentials_have_no_embedded_defaults(field):
    assert Settings.model_fields[field].default == ""


@pytest.mark.parametrize("status", [TodoStatus.OPEN, TodoStatus.DONE])
@pytest.mark.parametrize("notes,link,tags,expected", [
    (None, {"type": "bug", "notes": "旧备注\n第二行"}, [], "旧备注\n第二行"),
    (None, {"notes": "标签 Bug 备注"}, ["bug"], "标签 Bug 备注"),
    ("新备注", {"type": "bug", "notes": "旧备注"}, [], "新备注"),
    ("", {"type": "bug", "notes": "旧备注"}, [], ""),
    (None, {"notes": "非 Bug 元数据"}, [], None),
    (None, {"type": "bug", "notes": 42}, [], None),
    (None, {"type": "bug", "notes": {"text": "无效备注"}}, [], None),
    (None, {"type": "bug"}, [], None),
])
def test_notes_consistent_across_detail_lists_and_project(db, status, notes, link, tags, expected):
    session, boss, employee, _, _, actor, client = db
    project = make_project(db)
    todo = task(db, status=status, estimated_hours=0, notes=notes, description="任务描述\n第二行",
                source_type="project_task", source_id=str(project.id), link=link, tags=tags)

    def check(row):
        assert row["description"] == "任务描述\n第二行"
        assert row["notes"] == expected

    check(client.get(f"/api/v1/todo/{todo.id}").json()["data"])
    team = client.get("/api/v1/todo/team", params={"status": status.value}).json()["data"]["items"]
    check(next(row for row in team if row["id"] == str(todo.id)))
    if link.get("type") == "bug" or "bug" in tags:
        bugs = client.get(f"/api/v1/project/projects/{project.id}/bugs").json()["data"]["items"]
        check(next(row for row in bugs if row["id"] == str(todo.id)))
    actor[0] = employee
    personal = client.get("/api/v1/todo/my", params={"status": status.value}).json()["data"]["items"]
    check(next(row for row in personal if row["id"] == str(todo.id)))
    session.refresh(todo)
    assert todo.notes == notes  # Reading legacy data must not mutate the stored row.
    assert todo.link == link


@pytest.mark.parametrize("description,notes", [(None, None), ("", ""), ("仅描述", None), (None, "仅备注")])
def test_optional_detail_fields_roundtrip(db, description, notes):
    _, boss, _, _, _, _, client = db
    created = client.post("/api/v1/todo", json={"title": "详情字段测试", "assignee_user_id": str(boss.id),
        "due_at": "2099-01-01T18:00:00", "description": description, "notes": notes})
    assert created.status_code == 200, created.text
    row = created.json()["data"]
    readback = client.get(f"/api/v1/todo/{row['id']}").json()["data"]
    assert (readback["description"], readback["notes"]) == (description, notes)


def test_patch_clears_notes_without_reviving_legacy_notes(db):
    session, _, _, _, _, _, client = db
    todo = task(db, status=TodoStatus.OPEN, estimated_hours=0, description="原描述", notes=None,
                link={"type": "bug", "notes": "旧备注"})
    path = f"/api/v1/todo/{todo.id}"
    for payload in [{}, {"description": None, "notes": None}]:
        response = client.patch(path, json=payload)
        assert response.status_code == 200, response.text
        assert response.json()["data"]["notes"] == "旧备注"
        assert response.json()["data"]["description"] == "原描述"
    for payload in [{"description": "新描述\n第二行", "notes": "新备注"}, {"description": "", "notes": ""}]:
        response = client.patch(path, json=payload)
        assert response.status_code == 200, response.text
        for field, value in payload.items():
            assert response.json()["data"][field] == value
            assert client.get(path).json()["data"][field] == value
        session.refresh(todo)
        assert (todo.description, todo.notes) == (payload["description"], payload["notes"])
    assert todo.link["notes"] == "旧备注"
