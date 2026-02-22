"""
Project API endpoints
"""
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
import io
import urllib.parse

from fastapi import APIRouter, Depends, Query, Body
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.auth import get_current_user
from app.core.exceptions import NotFoundException
from app.core.response import success_response
from app.models.iam import User
from app.models.iam import User, OurEntity
from app.models.project import Project, ProjectStage, ProjectMember, ProjectType, ProjectStatus, StageStatus
from app.models.todo import TodoItem, TodoSourceType
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectStageResponse, StageStatusUpdate,
    ProjectMemberCreate, ProjectMemberBatchCreate, ProjectMemberResponse, ProjectTaskResponse
)

router = APIRouter(prefix="/project", tags=["Project"])


# Standard stages for B2B projects
B2B_STAGES = [
    ("requirement_alignment", "需求对齐"),
    ("quotation", "报价"),
    ("contract_signed", "合同签署"),
    ("prototype_confirmed", "原型确认"),
    ("design", "设计"),
    ("development", "开发"),
    ("testing", "测试"),
    ("delivery", "交付")
]

# Standard stages for B2C projects
B2C_STAGES = [
    ("requirement_analysis", "需求分析"),
    ("project_initiation", "项目立项"),
    ("prototype_confirmed", "原型确认"),
    ("design", "设计"),
    ("development", "开发"),
    ("testing", "测试"),
    ("launch", "上线"),
    ("operation", "运营"),
    ("iteration", "迭代")
]


def enrich_project_response(session: Session, project: Project) -> ProjectResponse:
    resp = ProjectResponse.model_validate(project)
    if project.pm_user_id:
        pm = session.get(User, project.pm_user_id)
        if pm:
            resp.pm_name = pm.display_name or pm.email
    return resp


@router.post("/projects", response_model=dict)
async def create_project(
    data: ProjectCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create project with automatic stage generation"""
    # Fetch default our_entity if not provided
    our_entity_id = data.our_entity_id
    if not our_entity_id:
        default_entity = session.exec(select(OurEntity)).first()
        if default_entity:
            our_entity_id = default_entity.id
        else:
            raise NotFoundException("未找到可用的我方主体")
            
    project = Project(
        our_entity_id=our_entity_id,
        project_no=data.project_no,
        name=data.name,
        project_type=ProjectType(data.project_type),
        status=ProjectStatus.DRAFT,
        owner_user_id=current_user.id,
        pm_user_id=data.pm_user_id,
        customer_id=data.customer_id,
        contract_id=data.contract_id,
        start_at=data.start_at,
        due_at=data.due_at,
        current_stage_code="",
        progress=0.0,
        description=data.description
    )
    
    session.add(project)
    session.commit()
    session.refresh(project)
    
    # Generate stages based on project type
    stages = B2B_STAGES if project.project_type == ProjectType.B2B else B2C_STAGES
    
    for idx, (code, name) in enumerate(stages, 1):
        stage = ProjectStage(
            project_id=project.id,
            stage_code=code,
            stage_name=name,
            sequence_no=idx,
            status=StageStatus.NOT_STARTED
        )
        session.add(stage)
    
    # Set current stage to first stage
    project.current_stage_code = stages[0][0]
    session.add(project)
    session.commit()
    session.refresh(project)
    

@router.get("/projects", response_model=dict)
async def list_projects(
    status: Optional[str] = Query(None),
    project_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List projects"""
    query = select(Project)
    
    if status:
        query = query.where(Project.status == status)
    if project_type:
        query = query.where(Project.project_type == project_type)
    
    query = query.order_by(Project.created_at.desc())
    
    offset = (page - 1) * page_size
    projects = session.exec(query.offset(offset).limit(page_size)).all()
    
    count_query = select(Project)
    if status:
        count_query = count_query.where(Project.status == status)
    if project_type:
        count_query = count_query.where(Project.project_type == project_type)
    total = len(session.exec(count_query).all())
    
    return success_response({
        "items": [enrich_project_response(session, p) for p in projects],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    })


@router.get("/projects/{project_id}", response_model=dict)
async def get_project(
    project_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get project by ID"""
    project = session.get(Project, project_id)
    if not project:
        raise NotFoundException("未找到项目")
    
    return success_response(enrich_project_response(session, project))


@router.patch("/projects/{project_id}", response_model=dict)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update project"""
    project = session.get(Project, project_id)
    if not project:
        raise NotFoundException("未找到项目")
    
    if data.name is not None:
        project.name = data.name
    if data.status is not None:
        project.status = ProjectStatus(data.status)
    if data.pm_user_id is not None:
        project.pm_user_id = data.pm_user_id
    if data.description is not None:
        project.description = data.description
    if data.start_at is not None:
        project.start_at = data.start_at
    if data.due_at is not None:
        project.due_at = data.due_at
    if data.our_entity_id is not None:
        project.our_entity_id = data.our_entity_id
    if data.customer_id is not None:
        project.customer_id = data.customer_id
    
    project.updated_at = datetime.utcnow()
    session.add(project)
    session.commit()
    session.refresh(project)
    
    return success_response(enrich_project_response(session, project))


@router.get("/projects/{project_id}/stages", response_model=dict)
async def get_project_stages(
    project_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get project stages"""
    project = session.get(Project, project_id)
    if not project:
        raise NotFoundException("未找到项目")
    
    stages = session.exec(
        select(ProjectStage)
        .where(ProjectStage.project_id == project_id)
        .order_by(ProjectStage.sequence_no)
    ).all()
    
    return success_response([ProjectStageResponse.model_validate(s) for s in stages])


@router.patch("/stages/{stage_id}", response_model=dict)
async def update_stage_status(
    stage_id: UUID,
    data: StageStatusUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update project stage status"""
    stage = session.get(ProjectStage, stage_id)
    if not stage:
        raise NotFoundException("未找到阶段")
    
    stage.status = StageStatus(data.status)
    if data.blocked_reason:
        stage.blocked_reason = data.blocked_reason
    if data.skip_reason:
        stage.skip_reason = data.skip_reason
    
    if stage.status == StageStatus.IN_PROGRESS and not stage.actual_start_at:
        stage.actual_start_at = datetime.utcnow().date()
    elif stage.status == StageStatus.DONE and not stage.actual_end_at:
        stage.actual_end_at = datetime.utcnow().date()
    
    stage.updated_at = datetime.utcnow()
    session.add(stage)
    session.commit()
    session.refresh(stage)
    
    return success_response(ProjectStageResponse.model_validate(stage))


@router.delete("/projects/{project_id}", response_model=dict)
async def delete_project(
    project_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete project"""
    project = session.get(Project, project_id)
    if not project:
        raise NotFoundException("未找到项目")
    
    # Check if there are related todos or stages?
    # For now, cascading delete is handled by database or we just delete
    # But usually we should check. Pydantic/SQLAlchemy might handle cascade if configured
    # For simplicity, we just delete the project and rely on DB cascade
    
    session.delete(project)
    session.commit()
    
    return success_response({"message": "项目已删除"})


# --- Project Members ---

@router.post("/projects/{project_id}/members", response_model=dict)
async def add_project_member(
    project_id: UUID,
    data: ProjectMemberCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add member to project"""
    project = session.get(Project, project_id)
    if not project:
        raise NotFoundException("未找到项目")
        
    # Check if user exists
    user = session.get(User, data.user_id)
    if not user:
        raise NotFoundException("未找到用户")
        
    # Check if already member
    existing = session.exec(
        select(ProjectMember)
        .where(ProjectMember.project_id == project_id)
        .where(ProjectMember.user_id == data.user_id)
    ).first()
    
    if existing:
        return success_response(ProjectMemberResponse.model_validate(existing))
        
    member = ProjectMember(
        project_id=project_id,
        user_id=data.user_id,
        role_in_project=data.role_in_project
    )
    
    session.add(member)
    session.commit()
    session.refresh(member)
    
    # Populate user info for response
    member.user_name = user.display_name
    member.user_email = user.email
    
    return success_response(ProjectMemberResponse.model_validate(member))


@router.delete("/projects/{project_id}/members/{user_id}", response_model=dict)
async def remove_project_member(
    project_id: UUID,
    user_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Remove member from project"""
    member = session.exec(
        select(ProjectMember)
        .where(ProjectMember.project_id == project_id)
        .where(ProjectMember.user_id == user_id)
    ).first()
    
    if member:
        session.delete(member)
        session.commit()
        
    return success_response({"message": "成员已移除"})


@router.get("/projects/{project_id}/members", response_model=dict)
async def list_project_members(
    project_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List project members"""
    project = session.get(Project, project_id)
    if not project:
        raise NotFoundException("未找到项目")
        
    members = session.exec(
        select(ProjectMember)
        .where(ProjectMember.project_id == project_id)
    ).all()
    
    # Enhance with user info
    result = []
    for m in members:
        user = session.get(User, m.user_id)
        resp = ProjectMemberResponse.model_validate(m)
        if user:
            resp.user_name = user.display_name
            resp.user_email = user.email
        result.append(resp)
        
    return success_response(result)


# --- Project Tasks ---

@router.get("/projects/{project_id}/todos", response_model=dict)
async def list_project_todos(
    project_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List project todos"""
    project = session.get(Project, project_id)
    if not project:
        raise NotFoundException("未找到项目")
        
    # Find todos linked to this project
    # source_type = PROJECT_TASK and source_id = project_id (as string)
    
    todos = session.exec(
        select(TodoItem)
        .where(TodoItem.source_type == TodoSourceType.PROJECT_TASK)
        .where(TodoItem.source_id == str(project_id))
        .order_by(TodoItem.created_at.desc())
    ).all()
    
    result = []
    for t in todos:
        assignee = session.get(User, t.assignee_user_id)
        resp = ProjectTaskResponse.model_validate(t)
        if assignee:
            resp.assignee_name = assignee.display_name
        result.append(resp)
        
    return success_response(result)


def sync_project_progress(session, project_id: UUID):
    """Recalculates and saves project progress percentage."""
    from app.models.todo import TodoItem, TodoSourceType
    project = session.get(Project, project_id)
    if not project:
        return
    if project.project_type and project.project_type.lower() == "b2b":
        stages = session.exec(select(ProjectStage).where(ProjectStage.project_id == project_id)).all()
        if not stages:
            project.progress_percentage = 0
        else:
            done = sum(1 for s in stages if s.status == StageStatus.COMPLETED)
            skipped = sum(1 for s in stages if s.status == StageStatus.SKIPPED)
            project.progress_percentage = int(((done + skipped) / len(stages)) * 100)
    else:
        todos = session.exec(
            select(TodoItem)
            .where(TodoItem.source_type == TodoSourceType.PROJECT_TASK)
            .where(TodoItem.source_id == str(project_id))
        ).all()
        if not todos:
            project.progress_percentage = 0
        else:
            done = sum(1 for t in todos if t.status == 'done')
            project.progress_percentage = int((done / len(todos)) * 100)
    session.add(project)
    session.commit()


@router.post("/export_quote_excel")

async def export_quote_excel(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user)
):
    """
    Generate a 2-sheet styled Excel: Sheet1=报价单, Sheet2=功能清单
    Payload: { project_name, rows, notes, total_price, total_final, final_confirmed, feature_list }
    """
    project_name = payload.get("project_name", "项目")
    rows = payload.get("rows", [])
    notes = payload.get("notes", [])
    total_price = payload.get("total_price", 0)
    total_final = payload.get("total_final", 0)
    final_confirmed = payload.get("final_confirmed", "")
    feature_list = payload.get("feature_list", [])

    wb = Workbook()

    # ─── Shared Styles ────────────────────────────────────────────────────────
    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    subtotal_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
    total_fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")
    hours_fill = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
    note_fill = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
    white_font = Font(color="FFFFFF", bold=True)
    red_font = Font(color="C00000", bold=True)
    bold_font = Font(bold=True)
    bold_italic = Font(bold=True, italic=True)
    center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)
    right_align = Alignment(horizontal="right", vertical="center")

    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )

    CHINESE_NUMS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
                    "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十"]

    COL_COUNT = 8  # 序号,服务内容,规格,单位,产品总价,折扣率,折后价,备注

    # ─── SHEET 1: 报价单 ────────────────────────────────────────────────────
    ws1 = wb.active
    ws1.title = "报价单"

    # Row 1: Title (styled same as feature list)
    ws1.merge_cells("A1:H1")
    ws1["A1"] = f"{project_name}项目报价"
    ws1["A1"].fill = header_fill
    ws1["A1"].font = white_font
    ws1["A1"].alignment = center_align

    # Row 2: Unit note (right-aligned, plain)
    ws1.merge_cells("A2:G2")
    ws1["H2"] = "单位：人民币（元）"
    ws1["H2"].alignment = right_align
    ws1["H2"].font = Font(size=9, color="666666")

    # Row 3: Headers (dark blue)
    headers = ["序号", "服务内容", "规格", "单位", "产品总价", "折扣率(%)", "折后价", "备注"]
    for ci, h in enumerate(headers, 1):
        cell = ws1.cell(row=3, column=ci, value=h)
        cell.fill = header_fill
        cell.font = white_font
        cell.alignment = center_align
        cell.border = thin_border

    # Column widths
    ws1.column_dimensions["A"].width = 8
    ws1.column_dimensions["B"].width = 30
    ws1.column_dimensions["C"].width = 8
    ws1.column_dimensions["D"].width = 8
    ws1.column_dimensions["E"].width = 14
    ws1.column_dimensions["F"].width = 12
    ws1.column_dimensions["G"].width = 14
    ws1.column_dimensions["H"].width = 30

    current_row = 4
    chinese_counter = 0

    for row in rows:
        if row.get("is_subtotal"):
            ws1.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=4)
            cell = ws1.cell(row=current_row, column=1, value=row.get("subtotal_label", "小计"))
            cell.font = bold_italic
            cell.alignment = center_align
            for ci, val in enumerate([row.get("total_price", ""), "", row.get("final_price", ""), ""], 5):
                c = ws1.cell(row=current_row, column=ci, value=val if val != "" else None)
                c.font = bold_italic
                c.alignment = right_align if ci in (5, 7) else center_align
            for ci in range(1, COL_COUNT + 1):
                ws1.cell(row=current_row, column=ci).fill = subtotal_fill
                ws1.cell(row=current_row, column=ci).border = thin_border
        else:
            chinese_counter += 1
            label = CHINESE_NUMS[chinese_counter - 1] if chinese_counter <= len(CHINESE_NUMS) else str(chinese_counter)
            total_p = row.get("total_price", "")
            final_p = row.get("final_price", "")
            values = [
                label,
                row.get("name", ""),
                row.get("spec", ""),
                row.get("unit", ""),
                float(total_p) if total_p else None,
                row.get("discount", ""),
                float(final_p) if final_p else None,
                row.get("remark", "")
            ]
            for ci, val in enumerate(values, 1):
                cell = ws1.cell(row=current_row, column=ci, value=val)
                cell.border = thin_border
                if ci in (5, 7):
                    cell.alignment = right_align
                elif ci == 2:
                    cell.alignment = left_align
                else:
                    cell.alignment = center_align
        current_row += 1

    # 总计 row
    ws1.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=4)
    ws1.cell(row=current_row, column=1, value="总计").font = red_font
    ws1.cell(row=current_row, column=1).alignment = center_align
    tp_val = float(total_price) if total_price else None
    tf_val = float(total_final) if total_final else None
    ws1.cell(row=current_row, column=5, value=tp_val).font = red_font
    ws1.cell(row=current_row, column=5).alignment = right_align
    ws1.cell(row=current_row, column=7, value=tf_val).font = red_font
    ws1.cell(row=current_row, column=7).alignment = right_align
    for ci in range(1, COL_COUNT + 1):
        ws1.cell(row=current_row, column=ci).fill = total_fill
        ws1.cell(row=current_row, column=ci).border = thin_border
    current_row += 1

    # 最终确认 row
    ws1.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=4)
    ws1.cell(row=current_row, column=1, value="最终确认").font = red_font
    ws1.cell(row=current_row, column=1).alignment = center_align
    try:
        confirmed_val = float(final_confirmed) if final_confirmed != "" else None
    except (ValueError, TypeError):
        confirmed_val = None
    ws1.cell(row=current_row, column=7, value=confirmed_val).font = red_font
    ws1.cell(row=current_row, column=7).alignment = right_align
    for ci in range(1, COL_COUNT + 1):
        ws1.cell(row=current_row, column=ci).fill = total_fill
        ws1.cell(row=current_row, column=ci).border = thin_border
    current_row += 1

    # ─── Work Hours Section (computed from feature_list) ──────────────────────
    # Sum dev hours from feature_list
    dev_backend_total = 0.0
    dev_frontend_total = 0.0
    dev_ui_total = 0.0
    dev_product_total = 0.0
    for f in feature_list:
        for key, acc in [("dev_backend", "dev_backend_total"), ("dev_frontend", "dev_frontend_total"),
                         ("dev_ui", "dev_ui_total"), ("dev_product", "dev_product_total")]:
            try:
                val = float(f.get(key, 0) or 0)
            except (ValueError, TypeError):
                val = 0.0
            if key == "dev_backend": dev_backend_total += val
            elif key == "dev_frontend": dev_frontend_total += val
            elif key == "dev_ui": dev_ui_total += val
            elif key == "dev_product": dev_product_total += val

    total_dev = dev_backend_total + dev_frontend_total + dev_ui_total + dev_product_total
    import math
    test_hrs = math.ceil(total_dev * 0.1)
    mgmt_hrs = math.ceil(total_dev * 0.1)

    def add_hours_row(r, label, backend, frontend, ui, product, fill=hours_fill, font=None):
        ws1.merge_cells(start_row=r, start_column=1, end_row=r, end_column=4)
        cell = ws1.cell(row=r, column=1, value=label)
        cell.alignment = center_align
        cell.border = thin_border
        if font: cell.font = font
        for ci, val in zip([5, 6, 7, 8], [backend, frontend, ui, product]):
            c = ws1.cell(row=r, column=ci, value=val if val else None)
            c.alignment = center_align
            c.border = thin_border
            if font: c.font = font
        for ci in range(1, COL_COUNT + 1):
            ws1.cell(row=r, column=ci).fill = fill
            if not ws1.cell(row=r, column=ci).border.left.style:
                ws1.cell(row=r, column=ci).border = thin_border

    # Header for work hours section
    ws1.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=COL_COUNT)
    ws1.cell(row=current_row, column=1, value="工时明细").fill = header_fill
    ws1.cell(row=current_row, column=1).font = white_font
    ws1.cell(row=current_row, column=1).alignment = center_align
    ws1.cell(row=current_row, column=1).border = thin_border
    current_row += 1

    # Sub-header row
    hours_headers = ["项目", "后端开发", "前端开发", "UI 设计", "产品规划"]
    ws1.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=4)
    ws1.cell(row=current_row, column=1, value="工时类别").fill = header_fill
    ws1.cell(row=current_row, column=1).font = white_font
    ws1.cell(row=current_row, column=1).alignment = center_align
    ws1.cell(row=current_row, column=1).border = thin_border
    for ci, h in zip([5, 6, 7, 8], ["后端开发(天)", "前端开发(天)", "UI设计(天)", "产品规划(天)"]):
        cell = ws1.cell(row=current_row, column=ci, value=h)
        cell.fill = header_fill
        cell.font = white_font
        cell.alignment = center_align
        cell.border = thin_border
    current_row += 1

    # 开发工时
    add_hours_row(current_row, "开发工时",
                  dev_backend_total or None, dev_frontend_total or None,
                  dev_ui_total or None, dev_product_total or None)
    current_row += 1

    # 测试工时 row (merged cols 5-8)
    ws1.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=4)
    ws1.cell(row=current_row, column=1, value="测试工时 (开发合计×10%，向上取整)").alignment = center_align
    ws1.cell(row=current_row, column=1).border = thin_border
    ws1.merge_cells(start_row=current_row, start_column=5, end_row=current_row, end_column=COL_COUNT)
    ws1.cell(row=current_row, column=5, value=test_hrs if test_hrs else None).alignment = center_align
    ws1.cell(row=current_row, column=5).border = thin_border
    for ci in range(1, COL_COUNT + 1):
        ws1.cell(row=current_row, column=ci).fill = hours_fill
        ws1.cell(row=current_row, column=ci).border = thin_border
    current_row += 1

    # 管理工时 row
    ws1.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=4)
    ws1.cell(row=current_row, column=1, value="管理工时 (开发合计×10%，向上取整)").alignment = center_align
    ws1.cell(row=current_row, column=1).border = thin_border
    ws1.merge_cells(start_row=current_row, start_column=5, end_row=current_row, end_column=COL_COUNT)
    ws1.cell(row=current_row, column=5, value=mgmt_hrs if mgmt_hrs else None).alignment = center_align
    ws1.cell(row=current_row, column=5).border = thin_border
    for ci in range(1, COL_COUNT + 1):
        ws1.cell(row=current_row, column=ci).fill = hours_fill
        ws1.cell(row=current_row, column=ci).border = thin_border
    current_row += 1

    # 合计工时 row
    total_hrs = total_dev + test_hrs + mgmt_hrs
    ws1.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=4)
    ws1.cell(row=current_row, column=1, value="合计工时").font = bold_font
    ws1.cell(row=current_row, column=1).alignment = center_align
    ws1.cell(row=current_row, column=1).border = thin_border
    ws1.merge_cells(start_row=current_row, start_column=5, end_row=current_row, end_column=COL_COUNT)
    ws1.cell(row=current_row, column=5, value=total_hrs if total_hrs else None).font = bold_font
    ws1.cell(row=current_row, column=5).alignment = center_align
    ws1.cell(row=current_row, column=5).border = thin_border
    for ci in range(1, COL_COUNT + 1):
        ws1.cell(row=current_row, column=ci).fill = total_fill
        ws1.cell(row=current_row, column=ci).border = thin_border
    current_row += 2

    # 备注 section
    if notes:
        ws1.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=COL_COUNT)
        ws1.cell(row=current_row, column=1, value="备注").font = bold_font
        ws1.cell(row=current_row, column=1).fill = note_fill
        ws1.cell(row=current_row, column=1).alignment = left_align
        ws1.cell(row=current_row, column=1).border = thin_border
        current_row += 1

        notes_text = "\n".join(f"{i+1}、{n}" for i, n in enumerate(notes))
        row_span = max(len(notes), 3)
        ws1.merge_cells(start_row=current_row, start_column=1, end_row=current_row + row_span - 1, end_column=COL_COUNT)
        cell = ws1.cell(row=current_row, column=1, value=notes_text)
        cell.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
        cell.border = thin_border
        ws1.row_dimensions[current_row].height = max(15 * len(notes), 60)

    # ─── SHEET 2: 功能清单 ──────────────────────────────────────────────────
    if feature_list:
        ws2 = wb.create_sheet(title="功能清单")
        headers2 = ["序号", "产品", "板块", "一级功能", "二级功能", "新增功能说明", "后端开发", "前端开发", "UI设计", "产品规划"]
        ws2.merge_cells("A1:J1")
        ws2["A1"] = f"{project_name}功能清单"
        ws2["A1"].fill = header_fill
        ws2["A1"].font = white_font
        ws2["A1"].alignment = center_align

        for ci, h in enumerate(headers2, 1):
            cell = ws2.cell(row=2, column=ci, value=h)
            cell.fill = header_fill
            cell.font = white_font
            cell.alignment = center_align
            cell.border = thin_border

        for col_letter, width in zip("ABCDEFGHIJ", [8, 15, 15, 20, 20, 50, 12, 12, 12, 12]):
            ws2.column_dimensions[col_letter].width = width

        feat_data_end = 2
        for row_i, f in enumerate(feature_list, 3):
            for ci, key in enumerate(["index", "product", "module", "l1_feature", "l2_feature", "description"], 1):
                ws2.cell(row=row_i, column=ci, value=f.get(key, "")).alignment = center_align
                ws2.cell(row=row_i, column=ci).border = thin_border
            for ci, key in enumerate(["dev_backend", "dev_frontend", "dev_ui", "dev_product"], 7):
                val = f.get(key, "")
                try:
                    val = float(val) if val else None
                except (ValueError, TypeError):
                    pass
                ws2.cell(row=row_i, column=ci, value=val).alignment = center_align
                ws2.cell(row=row_i, column=ci).border = thin_border
            feat_data_end = row_i

        # Footer rows matching feature list export
        def apply_feat_footer(r, label, fg, fh=None, fi=None, fj=None):
            ws2.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
            ws2.cell(row=r, column=1, value=label).alignment = center_align
            for ci in range(1, 11):
                ws2.cell(row=r, column=ci).border = thin_border
            ws2.cell(row=r, column=7, value=fg).alignment = center_align
            if fh: ws2.cell(row=r, column=8, value=fh).alignment = center_align
            if fi: ws2.cell(row=r, column=9, value=fi).alignment = center_align
            if fj: ws2.cell(row=r, column=10, value=fj).alignment = center_align

        dev_row = feat_data_end + 1
        apply_feat_footer(dev_row, "系统开发工时",
                          f"=SUM(G3:G{feat_data_end})",
                          f"=SUM(H3:H{feat_data_end})",
                          f"=SUM(I3:I{feat_data_end})",
                          f"=SUM(J3:J{feat_data_end})")
        test_row = dev_row + 1
        ws2.merge_cells(start_row=test_row, start_column=7, end_row=test_row, end_column=10)
        apply_feat_footer(test_row, "系统测试工时", f"=ROUNDUP(SUM(G{dev_row}:J{dev_row})*0.1,0)")
        mgmt_row = dev_row + 2
        ws2.merge_cells(start_row=mgmt_row, start_column=7, end_row=mgmt_row, end_column=10)
        apply_feat_footer(mgmt_row, "项目管理工时", f"=ROUNDUP(SUM(G{dev_row}:J{dev_row})*0.1,0)")
        total_row = dev_row + 3
        ws2.merge_cells(start_row=total_row, start_column=7, end_row=total_row, end_column=10)
        apply_feat_footer(total_row, "总计工时", f"=SUM(G{dev_row}:J{dev_row})+G{test_row}+G{mgmt_row}")

    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    filename = f"{project_name}_报价单.xlsx"
    encoded_filename = urllib.parse.quote(filename)
    return StreamingResponse(out, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"})
