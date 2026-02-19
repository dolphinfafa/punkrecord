
import sys
import os
import asyncio
from uuid import uuid4
from datetime import datetime

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlmodel import Session, create_engine, select
from app.models.iam import User, UserStatus
from app.models.todo import TodoItem, TodoStatus, TodoSourceType, TodoActionType
from app.api.todo import start_todo, submit_todo, approve_todo
from app.core.config import settings

def run_test():
    engine = create_engine(settings.DATABASE_URL)
    
    with Session(engine) as session:
        print("--- Setting up test data ---")
        
        # Create Users
        user_a = User(id=uuid4(), display_name="User A", username=f"user_a_{uuid4().hex[:8]}", status=UserStatus.ACTIVE)
        user_b = User(id=uuid4(), display_name="User B", username=f"user_b_{uuid4().hex[:8]}", status=UserStatus.ACTIVE)
        manager_b = User(id=uuid4(), display_name="Manager B", username=f"manager_b_{uuid4().hex[:8]}", status=UserStatus.ACTIVE)
        
        # B reports to Manager B
        user_b.manager_user_id = manager_b.id
        
        session.add(user_a)
        session.add(user_b)
        session.add(manager_b)
        session.commit()
        
        print(f"Created User A: {user_a.id}")
        print(f"Created User B: {user_b.id} (Manager: {manager_b.id})")
        
        # 1. Test Start Task
        print("\n--- Test 1: Start Task ---")
        task_start = TodoItem(
            our_entity_id=uuid4(),
            assignee_user_id=user_a.id,
            creator_user_id=user_a.id,
            title="Start Test Task",
            source_type=TodoSourceType.CUSTOM,
            source_id=str(uuid4()),
            action_type=TodoActionType.DO,
            status=TodoStatus.OPEN
        )
        session.add(task_start)
        session.commit()
        
        # Call start_todo
        asyncio.run(start_todo(task_start.id, session=session, current_user=user_a))
        session.refresh(task_start)
        
        print(f"Task Status: {task_start.status}")
        print(f"Start At: {task_start.start_at}")
        
        if task_start.status == TodoStatus.IN_PROGRESS and task_start.start_at is not None:
            print("SUCCESS: Task started correctly.")
        else:
            print("FAILURE: Task start failed.")

        # 2. Test Self-Assigned Completion
        print("\n--- Test 2: Self-Assigned Completion ---")
        task_self = TodoItem(
            our_entity_id=uuid4(),
            assignee_user_id=user_a.id,
            creator_user_id=user_a.id, # Self-created
            title="Self Task",
            source_type=TodoSourceType.CUSTOM,
            source_id=str(uuid4()),
            action_type=TodoActionType.DO,
            status=TodoStatus.IN_PROGRESS
        )
        session.add(task_self)
        session.commit()
        
        asyncio.run(submit_todo(task_self.id, session=session, current_user=user_a))
        session.refresh(task_self)
        
        print(f"Self Task Status: {task_self.status}")
        
        if task_self.status == TodoStatus.DONE:
            print("SUCCESS: Self-assigned task auto-completed.")
        else:
            print(f"FAILURE: Self-assigned task status is {task_self.status}")

        # 3. Test Assigned Completion (Creator Review)
        print("\n--- Test 3: Assigned Completion (A -> B) ---")
        task_assigned = TodoItem(
            our_entity_id=uuid4(),
            assignee_user_id=user_b.id,
            creator_user_id=user_a.id, # Created by A
            title="Assigned Task",
            source_type=TodoSourceType.CUSTOM,
            source_id=str(uuid4()),
            action_type=TodoActionType.DO,
            status=TodoStatus.IN_PROGRESS
        )
        session.add(task_assigned)
        session.commit()
        
        # B submits
        asyncio.run(submit_todo(task_assigned.id, session=session, current_user=user_b))
        session.refresh(task_assigned)
        
        print(f"Assigned Task Status after submit: {task_assigned.status}")
        
        if task_assigned.status == TodoStatus.PENDING_REVIEW:
            print("SUCCESS: Assigned task is pending review.")
        else:
            print(f"FAILURE: Assigned task status is {task_assigned.status}")
            
        # Manager B tries to approve (Should fail now, as Creator A must approve)
        print("Testing Manager B approval (Should fail)...")
        try:
            asyncio.run(approve_todo(task_assigned.id, session=session, current_user=manager_b))
            print("FAILURE: Manager B was able to approve (Unexpected).")
        except Exception as e:
            print(f"SUCCESS: Manager B could not approve: {e}")
            
        # Creator A approves
        print("Testing Creator A approval (Should succeed)...")
        try:
            asyncio.run(approve_todo(task_assigned.id, session=session, current_user=user_a))
            session.refresh(task_assigned)
            print(f"Assigned Task Status after A approval: {task_assigned.status}")
            
            if task_assigned.status == TodoStatus.DONE:
                print("SUCCESS: Creator A approved task.")
            else:
                print("FAILURE: Task not DONE after A approval.")
                
        except Exception as e:
            print(f"FAILURE: Creator A approval raised exception: {e}")

        # Cleanup
        print("\n--- Cleanup ---")
        session.delete(task_start)
        session.delete(task_self)
        session.delete(task_assigned)
        session.delete(user_a)
        session.delete(user_b)
        session.delete(manager_b)
        session.commit()

if __name__ == "__main__":
    run_test()
