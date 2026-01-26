#!/usr/bin/env python3
"""
Test database connection
"""
import sys
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.config import settings
from app.core.database import engine
from sqlmodel import text

def test_connection():
    """Test database connection"""
    print("=" * 60)
    print("Testing Database Connection")
    print("=" * 60)
    print(f"\nDatabase Configuration:")
    print(f"  Host: {settings.DB_HOST}")
    print(f"  Port: {settings.DB_PORT}")
    print(f"  Database: {settings.DB_NAME}")
    print(f"  User: {settings.DB_USER}")
    print(f"\nDatabase URL: {settings.DATABASE_URL.replace(settings.DB_PASSWORD, '***')}")
    
    try:
        # Test connection
        with engine.connect() as connection:
            result = connection.execute(text("SELECT VERSION()"))
            version = result.scalar()
            print(f"\n✓ Connection successful!")
            print(f"  MySQL Version: {version}")
            
            # Test database access
            result = connection.execute(text("SELECT DATABASE()"))
            db_name = result.scalar()
            print(f"  Current Database: {db_name}")
            
            # List tables
            result = connection.execute(text("SHOW TABLES"))
            tables = result.fetchall()
            print(f"\n  Existing tables ({len(tables)}):")
            if tables:
                for table in tables:
                    print(f"    - {table[0]}")
            else:
                print("    (No tables found)")
            
        print("\n" + "=" * 60)
        print("Database connection test PASSED ✓")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"\n✗ Connection failed!")
        print(f"  Error: {str(e)}")
        print("\n" + "=" * 60)
        print("Database connection test FAILED ✗")
        print("=" * 60)
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
