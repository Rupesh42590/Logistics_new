"""Fix PostgreSQL enum types to include new values."""
import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from database import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)

async def fix_enums():
    enums_to_add = {

        "userrole": ["MSME", "DRIVER", "FLEET_MANAGER"],
        
    }
    
    async with engine.begin() as conn:
        for enum_name, values in enums_to_add.items():
            for val in values:
                try:
                    await conn.execute(text(f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS '{val}'"))
                    print(f"  Added '{val}' to {enum_name}")
                except Exception as e:
                    print(f"  WARN {enum_name}.{val}: {e}")
    
    print("Enum fix complete!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(fix_enums())
