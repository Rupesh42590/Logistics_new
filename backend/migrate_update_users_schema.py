"""Add missing columns to users table."""
import asyncio
import sys
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from database import DATABASE_URL

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

engine = create_async_engine(DATABASE_URL, echo=False)

async def migrate():
    async with engine.begin() as conn:
        # Columns to add based on Use model in models.py and error logs
        columns = [
            ("license_number", "VARCHAR UNIQUE"),
            ("rating", "FLOAT DEFAULT 5.0"),
            ("phone", "VARCHAR"),
            ("vendor_id", "INTEGER REFERENCES vendors(id)")
        ]
        
        for col_name, col_def in columns:
            try:
                # Basic check if column exists (Postgres specific) using simple exception handling
                # A robust way would be querying information_schema, but existing check inside ADD COLUMN IF NOT EXISTS is cleanest if supported,
                # but older Postgres might not support IF NOT EXISTS for column.
                # SQLAlchemy text() passes raw SQL. Postgres 9.6+ supports IF NOT EXISTS.
                await conn.execute(text(
                    f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_def}"
                ))
                print(f"Added {col_name} column to users")
            except Exception as e:
                print(f"Error adding {col_name}: {e}")

    print("Migration complete!")
    await engine.dispose()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(migrate())
