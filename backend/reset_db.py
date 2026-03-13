import asyncio
import os
import sys

# Add current directory to path
sys.path.append(os.getcwd())

from database import engine, Base
from seed_data import seed_data

from sqlalchemy import text

async def reset_database():
    print("Dropping all tables...")
    async with engine.begin() as conn:
        # Drop all tables defined in Base.metadata
        for table in reversed(Base.metadata.sorted_tables):
             print(f"Dropping {table.name}...")
             await conn.execute(text(f"DROP TABLE IF EXISTS {table.name}"))
        
        # Specific drops for any tables not caught or to be sure
        tables_to_drop = [
            "audit_logs", "notifications", "shipment_timeline", "shipment_items", 
            "delivery_receipts", "shipments", "vehicles", "zones", "saved_addresses",
            "delivery_items", "attachments", "deliveries", "docks", "users", "vendors", "companies"
        ]
        for table_name in tables_to_drop:
            await conn.execute(text(f"DROP TABLE IF EXISTS {table_name}"))
    print("Tables dropped.")
    
    print("Re-seeding database...")
    await seed_data()
    print("Database reset complete.")

if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(reset_database())
