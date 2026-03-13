
import asyncio
import sys
import os
from datetime import datetime, timedelta

sys.path.append(os.getcwd())

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import select
from database import DATABASE_URL, Base, AsyncSessionLocal
from models import (User, UserRole, UserStatus, Company, Vehicle, VehicleType,
                    Zone, Shipment, ShipmentStatus)
from auth import get_password_hash

engine = create_async_engine(DATABASE_URL)


async def seed_data():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("Tables created/verified.")

    async with AsyncSessionLocal() as db:
        print("Seeding data...")

        # Check if already seeded
        result = await db.execute(select(User).where(User.email == "admin@example.com"))
        if result.scalars().first():
            print("Already seeded. Done.")
            return

        # 1. Create the Demo Company
        demo_company = Company(
            name="Demo Logistics Co.",
            description="Default demo company for seeded users",
            address="123 Main St, Bangalore",
            lat=12.9716,
            lng=77.5946,
        )
        db.add(demo_company)
        await db.flush()  # get demo_company.id

        # Create a second company so the MSME user has someone to send orders to
        partner_company = Company(
            name="Partner Supplies Ltd.",
            description="Demo partner company",
            address="456 MG Road, Hyderabad",
            lat=17.3850,
            lng=78.4867,
        )
        db.add(partner_company)
        await db.flush()

        # 2. Create Users assigned to Demo Company
        users_to_create = [
            {"email": "admin@example.com",  "password": "password123", "role": UserRole.ADMIN,  "name": "System Admin",       "status": UserStatus.ACTIVE},
            {"email": "msme@example.com",   "password": "password123", "role": UserRole.MSME,   "name": "MSME Business User",  "status": UserStatus.ACTIVE},
            {"email": "driver@example.com", "password": "password123", "role": UserRole.DRIVER, "name": "Driver Raj",
             "license": "DL-KA01-2023001", "rating": 4.8, "phone": "9876543210",              "status": UserStatus.ACTIVE},
        ]

        created_users = {}
        for u in users_to_create:
            new_user = User(
                email=u["email"],
                hashed_password=get_password_hash(u["password"]),
                role=u["role"],
                status=u["status"],
                name=u["name"],
                company_id=demo_company.id,
                license_number=u.get("license"),
                rating=u.get("rating", 5.0),
                phone=u.get("phone")
            )
            db.add(new_user)
            created_users[u["email"]] = new_user
            print(f"Created user: {u['email']}")

        try:
            await db.commit()
            print("Base seeding complete.")
        except Exception as e:
            print(f"Error: {e}")
            await db.rollback()
            return

        await seed_vehicles_and_zones(db, demo_company.id)
        await seed_shipments(db)


async def seed_vehicles_and_zones(db, company_id):
    result = await db.execute(select(Vehicle))
    if result.scalars().first():
        print("Vehicles already exist. Skipping.")
        return

    drv_res = await db.execute(select(User).where(User.email == "driver@example.com"))
    drv = drv_res.scalars().first()

    # Zones (tagged with company)
    zones = [
        Zone(name="North Zone", description="Northern district coverage",
             color="#1890ff", coordinates=[[77.55, 12.98], [77.55, 13.05], [77.65, 13.05], [77.65, 12.98]],
             company_id=company_id),
        Zone(name="South Zone", description="Southern district coverage",
             color="#52c41a", coordinates=[[77.55, 12.90], [77.55, 12.98], [77.65, 12.98], [77.65, 12.90]],
             company_id=company_id),
        Zone(name="East Zone", description="Eastern district coverage",
             color="#fa8c16", coordinates=[[77.65, 12.90], [77.65, 13.05], [77.75, 13.05], [77.75, 12.90]],
             company_id=company_id),
    ]
    for z in zones:
        db.add(z)
    await db.flush()

    # Vehicles (tagged with company)
    vehicles = [
        Vehicle(name="Truck-01", plate_number="KA-01-AB-1234", vehicle_type=VehicleType.TRUCK,
                weight_capacity=5000, volume_capacity=25.0,
                current_driver_id=drv.id if drv else None, zone_id=zones[0].id, company_id=company_id),
        Vehicle(name="Van-01", plate_number="KA-01-CD-5678", vehicle_type=VehicleType.VAN,
                weight_capacity=1500, volume_capacity=8.0, zone_id=zones[1].id, company_id=company_id),
        Vehicle(name="Truck-02", plate_number="KA-02-EF-9012", vehicle_type=VehicleType.TRUCK,
                weight_capacity=8000, volume_capacity=40.0, zone_id=zones[2].id, company_id=company_id),
        Vehicle(name="Pickup-01", plate_number="KA-03-GH-3456", vehicle_type=VehicleType.PICKUP,
                weight_capacity=800, volume_capacity=4.0, zone_id=zones[0].id, company_id=company_id),
    ]
    for v in vehicles:
        db.add(v)

    try:
        await db.commit()
        print("Vehicles and zones seeded.")
    except Exception as e:
        print(f"Error seeding vehicles/zones: {e}")
        await db.rollback()


async def seed_shipments(db):
    result = await db.execute(select(Shipment))
    if result.scalars().first():
        return

    sender_res = await db.execute(select(User).where(User.role == UserRole.MSME))
    sender = sender_res.scalars().first()
    if not sender:
        return

    shipments = [
        {"tracking": "SHP-DEMO-001", "po": "PO-DEMO-1", "status": ShipmentStatus.PENDING,
         "created": datetime.utcnow(), "desc": "Demo standard delivery"},
        {"tracking": "SHP-DEMO-002", "po": "PO-DEMO-2", "status": ShipmentStatus.ASSIGNED,
         "created": datetime.utcnow() - timedelta(days=2), "desc": "Demo delayed shipment"},
    ]

    for s in shipments:
        ship = Shipment(
            tracking_number=s["tracking"],
            po_number=s["po"],
            sender_id=sender.id,
            pickup_address="123 Demo Origin St",
            drop_address="456 Demo Dest Rd",
            total_weight=100,
            total_volume=10,
            status=s["status"],
            description=s["desc"],
            created_at=s["created"]
        )
        db.add(ship)

    try:
        await db.commit()
        print("Shipments seeded.")
    except Exception as e:
        print(f"Error seeding shipments: {e}")
        await db.rollback()


if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(seed_data())
