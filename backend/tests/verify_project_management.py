import sys
import os
import asyncio
from uuid import uuid4
from datetime import datetime

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlmodel import Session, create_engine, select
from app.models.iam import User, UserStatus
from app.models.project import Project, ProjectMember, ProjectStatus, ProjectType
from app.models.todo import TodoItem, TodoSourceType, TodoActionType, TodoStatus
from app.core.config import settings

def run_test():
    engine = create_engine(settings.DATABASE_URL)
    
    with Session(engine) as session:
        print("--- Setting up test data ---")
        
        # Create Users
        pm_user = User(id=uuid4(), display_name="Project Manager", username=f"pm_{uuid4().hex[:8]}", status=UserStatus.ACTIVE)
        member_user = User(id=uuid4(), display_name="Team Member", username=f"member_{uuid4().hex[:8]}", status=UserStatus.ACTIVE)
        
        session.add(pm_user)
        session.add(member_user)
        session.commit()
        
        print(f"Created PM: {pm_user.id}")
        print(f"Created Member: {member_user.id}")
        
        # 1. Create Project
        print("\n--- Test 1: Create Project ---")
        project = Project(
            our_entity_id=uuid4(),
            project_no=f"PROJ-{uuid4().hex[:6].upper()}",
            name="Test Project",
            project_type=ProjectType.B2B,
            status=ProjectStatus.DRAFT,
            owner_user_id=pm_user.id,
            pm_user_id=pm_user.id,
            current_stage_code="init",
            progress=0.0
        )
        session.add(project)
        session.commit()
        session.refresh(project)
        print(f"Created Project: {project.id} ({project.name})")
        
        # 2. Add Project Member
        print("\n--- Test 2: Add Project Member ---")
        member = ProjectMember(
            project_id=project.id,
            user_id=member_user.id,
            role_in_project="Developer"
        )
        session.add(member)
        session.commit()
        
        members = session.exec(select(ProjectMember).where(ProjectMember.project_id == project.id)).all()
        print(f"Project Members Count: {len(members)}")
        if len(members) == 1 and members[0].user_id == member_user.id:
            print("SUCCESS: Member added correctly.")
        else:
            print("FAILURE: Member not added correctly.")

        # 3. Create Project Task
        print("\n--- Test 3: Create Project Task ---")
        task = TodoItem(
            our_entity_id=project.our_entity_id,
            assignee_user_id=member_user.id,
            creator_user_id=pm_user.id,
            title="Project Task 1",
            source_type=TodoSourceType.PROJECT_TASK,
            source_id=str(project.id),
            action_type=TodoActionType.DO,
            status=TodoStatus.OPEN
        )
        session.add(task)
        session.commit()
        
        todos = session.exec(select(TodoItem).where(TodoItem.source_type == TodoSourceType.PROJECT_TASK).where(TodoItem.source_id == str(project.id))).all()
        print(f"Project Todos Count: {len(todos)}")
        if len(todos) == 1 and todos[0].title == "Project Task 1":
            print("SUCCESS: Project task created and linked.")
        else:
            print("FAILURE: Project task not linked correctly.")
            
        # 4. Remove Project Member
        print("\n--- Test 4: Remove Project Member ---")
        session.delete(member)
        session.commit()
        
        members_after = session.exec(select(ProjectMember).where(ProjectMember.project_id == project.id)).all()
        if len(members_after) == 0:
            print("SUCCESS: Member removed.")
        else:
            print("FAILURE: Member not removed.")
            
        # 5. Delete Project
        print("\n--- Test 5: Delete Project ---")
        session.delete(project)
        session.commit()
        
        deleted_project = session.get(Project, project.id)
        if not deleted_project:
            print("SUCCESS: Project deleted.")
        else:
            print("FAILURE: Project not deleted.")
            
        # Cleanup
        print("\n--- Cleanup ---")
        session.delete(pm_user)
        session.delete(member_user)
        # Task might be remaining if not cascaded, cleaning it up manually if exists
        task_check = session.get(TodoItem, task.id)
        if task_check:
            session.delete(task_check)
        session.commit()

if __name__ == "__main__":
    run_test()
