import asyncio
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()

# Connect to 'postgres' db to create new db
DATABASE_URL = os.getenv("DATABASE_URL")
# Parse user/pass from existing URL or use defaults
# Assuming format postgresql+asyncpg://user:pass@host/dbname
# Simplified parsing for direct connection string construction
DB_USER = "postgres"
DB_PASS = "harihyma"
DB_HOST = "localhost"
NEW_DB_NAME = "logistics_db_new"

async def create_db():
    print(f"Connecting to postgres...")
    try:
        sys_conn = await asyncpg.connect(user=DB_USER, password=DB_PASS, host=DB_HOST, database='postgres')
        
        # Check if db exists
        exists = await sys_conn.fetchval(f"SELECT 1 FROM pg_database WHERE datname = '{NEW_DB_NAME}'")
        if not exists:
            print(f"Creating database {NEW_DB_NAME}...")
            await sys_conn.execute(f'CREATE DATABASE "{NEW_DB_NAME}"')
            print("Database created.")
        else:
            print(f"Database {NEW_DB_NAME} already exists.")
            
        await sys_conn.close()
    except Exception as e:
        print(f"Error creating database: {e}")

if __name__ == "__main__":
    asyncio.run(create_db())
