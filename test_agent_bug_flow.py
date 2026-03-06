"""
Bug 修复 Agent 工作流测试脚本
测试完整流程: 登录 → 获取Bug列表 → 筛选我的Bug → 标记AI修复中 → 标记AI已修复
"""
import requests
import json
import sys

BASE_URL = "http://89.208.247.23:5174/api/v1"
PROJECT_ID = "7ae52617-afef-4528-b787-84c1bc8837d0"
MY_USER_ID = "eaedb7cd-1da3-4150-bdbb-778c46b47cb6"

# ─── 登录凭据（请修改为实际的用户名密码）───
USERNAME = "zheyang"
PASSWORD = "zheyang123"


def step(n, title):
    print(f"\n{'='*60}")
    print(f"  步骤 {n}: {title}")
    print(f"{'='*60}")


def login():
    step(1, "登录获取 Token")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "username": USERNAME,
        "password": PASSWORD,
    })
    print(f"  状态码: {resp.status_code}")
    data = resp.json()
    token = data.get("data", {}).get("token") or data.get("access_token")
    if resp.status_code != 200 or not token:
        print(f"  登录失败: {json.dumps(data, ensure_ascii=False, indent=2)}")
        sys.exit(1)
    print(f"  Token: {token[:20]}...{token[-10:]}")
    return token


def get_bug_list(headers):
    step(2, "获取项目 Bug 列表")
    resp = requests.get(f"{BASE_URL}/project/projects/{PROJECT_ID}/todos", headers=headers)
    print(f"  状态码: {resp.status_code}")
    todos = resp.json().get("data", [])
    bugs = [t for t in todos if "bug" in (t.get("tags") or []) or (t.get("link") or {}).get("type") == "bug"]
    print(f"  项目任务总数: {len(todos)}")
    print(f"  Bug 数量: {len(bugs)}")
    for b in bugs:
        print(f"    - [{b['status']:15s}] {b['title']}  (assignee: {b.get('assignee_name', '未知')}, id: {b['id']})")
    return bugs


def filter_my_bugs(bugs):
    step(3, f"筛选我负责的 Bug (user_id: {MY_USER_ID[:8]}...)")
    my_bugs = [b for b in bugs if b.get("assignee_user_id") == MY_USER_ID]
    print(f"  我的 Bug 数量: {len(my_bugs)}")
    if not my_bugs:
        return my_bugs
    actionable = [b for b in my_bugs if b["status"] in ("open", "in_progress", "blocked")]
    if not actionable:
        print("  没有可操作的 Bug（状态需为 open/in_progress/blocked）")
        for b in my_bugs:
            print(f"    - [{b['status']:15s}] {b['title']}")
        return []
    print(f"\n  可操作的 Bug 列表:")
    for i, b in enumerate(actionable):
        print(f"    [{i}] [{b['status']:15s}] {b['title']}")
    while True:
        choice = input(f"\n  请输入要修复的 Bug 编号 (0-{len(actionable)-1}), 多个用逗号分隔, 输入 a 全选: ").strip()
        if choice.lower() == 'a':
            return actionable
        try:
            indices = [int(x.strip()) for x in choice.split(',')]
            selected = [actionable[i] for i in indices if 0 <= i < len(actionable)]
            if selected:
                print(f"  已选择 {len(selected)} 个 Bug:")
                for b in selected:
                    print(f"    - {b['title']}")
                return selected
            print("  无效选择，请重试")
        except (ValueError, IndexError):
            print("  输入格式错误，请重试")


def get_bug_detail(headers, bug_id, title):
    step("3.5", f"获取 Bug 详情: {title}")
    try:
        resp = requests.get(f"{BASE_URL}/todo/{bug_id}", headers=headers, timeout=10)
        print(f"  状态码: {resp.status_code}")
        if resp.status_code == 200:
            detail = resp.json().get("data", {})
            link = detail.get("link") or {}
            print(f"  标题: {detail.get('title')}")
            print(f"  状态: {detail.get('status')}")
            print(f"  优先级: {detail.get('priority')}")
            if link.get("actual_result"):
                print(f"  实际结果: {link['actual_result']}")
            if link.get("expected_result"):
                print(f"  期望结果: {link['expected_result']}")
            if link.get("reproduce_steps"):
                print(f"  复现步骤: {link['reproduce_steps']}")
        return resp.status_code
    except Exception as e:
        print(f"  请求失败（跳过）: {e}")
        return -1


def set_ai_fixing(headers, bug_id, title):
    step(4, f"标记为 AI 修复中: {title}")
    resp = requests.post(f"{BASE_URL}/todo/{bug_id}/status", headers=headers, json={"status": "ai_fixing"})
    print(f"  状态码: {resp.status_code}")
    result = resp.json()
    if resp.status_code == 200:
        new_status = result.get("data", {}).get("status", "")
        print(f"  新状态: {new_status}")
    else:
        print(f"  失败: {json.dumps(result, ensure_ascii=False)}")
    return resp.status_code


def set_ai_fixed(headers, bug_id, title):
    step(5, f"标记为 AI 已修复: {title}")
    resp = requests.post(f"{BASE_URL}/todo/{bug_id}/status", headers=headers, json={"status": "ai_fixed"})
    print(f"  状态码: {resp.status_code}")
    result = resp.json()
    if resp.status_code == 200:
        new_status = result.get("data", {}).get("status", "")
        print(f"  新状态: {new_status}")
    else:
        print(f"  失败: {json.dumps(result, ensure_ascii=False)}")
    return resp.status_code


def verify_final_state(headers):
    step(6, "验证最终状态")
    resp = requests.get(f"{BASE_URL}/project/projects/{PROJECT_ID}/todos", headers=headers)
    todos = resp.json().get("data", [])
    bugs = [t for t in todos if "bug" in (t.get("tags") or []) or (t.get("link") or {}).get("type") == "bug"]
    print(f"  当前 Bug 状态一览:")
    for b in bugs:
        status_label = {
            "open": "待处理", "in_progress": "处理中", "ai_fixing": "AI 修复中",
            "ai_fixed": "AI 已修复", "pending_review": "待验收", "done": "已修复",
        }.get(b["status"], b["status"])
        print(f"    - [{status_label:10s}] {b['title']}")


def main():
    print("=" * 60)
    print("  Bug 修复 Agent 工作流 - 端到端测试")
    print("=" * 60)

    # 1. 登录
    token = login()
    headers = {"Authorization": f"Bearer {token}"}

    # 2. 获取 Bug 列表
    bugs = get_bug_list(headers)
    if not bugs:
        print("\n  项目中没有 Bug，请先在 Bug 管理中创建几个测试 Bug")
        sys.exit(0)

    # 3. 筛选我的 Bug
    my_bugs = filter_my_bugs(bugs)
    if not my_bugs:
        print("\n  没有分配给我的 Bug，将使用第一个 Bug 进行测试")
        my_bugs = bugs[:1]

    if not my_bugs:
        print("\n  没有可操作的 Bug")
        verify_final_state(headers)
        sys.exit(0)

    # 3.5 获取详情
    for b in my_bugs:
        get_bug_detail(headers, b["id"], b["title"])

    # 4. 逐个标记 AI 修复中
    for b in my_bugs:
        code = set_ai_fixing(headers, b["id"], b["title"])
        if code != 200:
            print(f"  跳过: {b['title']}")

    # 5. 手动确认是否标记 AI 已修复
    confirm = input("\n  是否将以上 Bug 标记为 AI 已修复? (y/n): ").strip().lower()
    if confirm == 'y':
        for b in my_bugs:
            code = set_ai_fixed(headers, b["id"], b["title"])
            if code != 200:
                print(f"  跳过: {b['title']}")
    else:
        print("\n  已跳过「AI 已修复」步骤，Bug 保持 ai_fixing 状态")

    # 6. 验证最终状态
    verify_final_state(headers)

    print(f"\n{'='*60}")
    print("  测试完成!")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
