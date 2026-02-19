
import sys
import os
from sqlmodel import Session, create_engine, select, delete

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.todo import TodoItem
from app.core.config import settings

def clear_todos():
    engine = create_engine(settings.DATABASE_URL)
    
    with Session(engine) as session:
        statement = delete(TodoItem)
        result = session.exec(statement)
        session.commit()
        print(f"Successfully deleted {result.rowcount} todo items.")

if __name__ == "__main__":
    clear_todos()
