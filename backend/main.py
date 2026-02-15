from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, or_
from sqlalchemy.orm import selectinload, aliased
from contextlib import asynccontextmanager
import datetime
from typing import List, Optional

from database import engine, Base, get_db
import models
import schemas
from auth import get_current_user, create_access_token, verify_password, get_password_hash, get_current_admin
from fastapi.security import OAuth2PasswordRequestForm

# --- Lifecycle ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (Auto-migration for dev)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(lifespan=lifespan, title="Plant Inbound Logistics")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend is running"}

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Auth Endpoints ---

@app.post("/token", response_model=schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.User).where(models.User.email == form_data.username))
    user = result.scalars().first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserResponse)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user


# --- Self-Registration (MSME) ---
class RegisterRequest(BaseModel):
    email: str
    password: str
    company_name: Optional[str] = None
    gst_number: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@app.post("/register")
async def register_msme(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(models.User).where(models.User.email == req.email))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pwd = get_password_hash(req.password)
    new_user = models.User(
        email=req.email,
        name=req.company_name or req.email.split("@")[0],
        hashed_password=hashed_pwd,
        role=models.UserRole.MSME,
        phone=None,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    access_token = create_access_token(data={"sub": new_user.email, "role": new_user.role.value})
    return {"access_token": access_token, "token_type": "bearer"}

# --- Change Password ---
@app.post("/change-password")
async def change_password(
    req: schemas.ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if not verify_password(req.old_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.hashed_password = get_password_hash(req.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}

# --- Helper: Audit Log ---
async def create_audit_log(db: AsyncSession, user_id: int, action: str, details: str, delivery_id: int = None):
    log = models.AuditLog(
        user_id=user_id,
        delivery_id=delivery_id,
        action=action,
        details=details
    )
    db.add(log)
    # Don't commit here if part of larger transaction, usually called before commit

# --- Vendor Management (Admin) ---
# Removed per new directive
# @app.post("/vendors", response_model=schemas.VendorResponse)
# async def create_vendor(vendor: schemas.VendorCreate, db: AsyncSession = Depends(get_db), admin: models.User = Depends(get_current_admin)):
#     db_vendor = models.Vendor(**vendor.dict())
#     db.add(db_vendor)
#     try:
#         await db.commit()
#         await db.refresh(db_vendor)
#     except Exception as e:
#         await db.rollback()
#         raise HTTPException(status_code=400, detail="Vendor already exists")
#     return db_vendor

# @app.get("/vendors", response_model=List[schemas.VendorResponse])
# async def read_vendors(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_admin)):
#     stmt = select(models.Vendor)
#     result = await db.execute(stmt)
#     return result.scalars().all()

# --- Dock Management (Admin) ---
# Removed per new directive
# @app.post("/docks", response_model=schemas.DockResponse)
# async def create_dock(dock: schemas.DockCreate, db: AsyncSession = Depends(get_db), admin: models.User = Depends(get_current_admin)):
#     db_dock = models.Dock(**dock.dict())
#     db.add(db_dock)
#     try:
#         await db.commit()
#         await db.refresh(db_dock)
#     except:
#         await db.rollback()
#         raise HTTPException(status_code=400, detail="Dock name exists")
#     return db_dock

# @app.get("/docks", response_model=List[schemas.DockResponse])
# async def read_docks(db: AsyncSession = Depends(get_db)):
#     result = await db.execute(select(models.Dock))
#     return result.scalars().all()

# --- Delivery Workflow ---

def validate_status_transition(current: models.DeliveryStatus, new: models.DeliveryStatus):
    """
    STRICT STATUS TRANSITION RULES
    Draft → Submitted
    Submitted → Approved
    Approved → Scheduled
    Scheduled → Arrived
    Arrived → Unloading
    Unloading → Received
    Received → Closed
    Received → Closed
    """
    valid_transitions = {
        models.DeliveryStatus.DRAFT: [models.DeliveryStatus.SUBMITTED, models.DeliveryStatus.CANCELLED],
        models.DeliveryStatus.SUBMITTED: [models.DeliveryStatus.APPROVED, models.DeliveryStatus.CANCELLED],
        models.DeliveryStatus.APPROVED: [models.DeliveryStatus.SCHEDULED, models.DeliveryStatus.CANCELLED],
        models.DeliveryStatus.SCHEDULED: [models.DeliveryStatus.ARRIVED, models.DeliveryStatus.CANCELLED, models.DeliveryStatus.APPROVED], # Allow reschedule (back to approved logic ideally or just scheduled->scheduled)
        models.DeliveryStatus.ARRIVED: [models.DeliveryStatus.UNLOADING, models.DeliveryStatus.CANCELLED],
        models.DeliveryStatus.UNLOADING: [models.DeliveryStatus.RECEIVED, models.DeliveryStatus.CANCELLED], # Partial loop possible
        models.DeliveryStatus.RECEIVED: [models.DeliveryStatus.CLOSED],
        models.DeliveryStatus.CLOSED: [],
        models.DeliveryStatus.CANCELLED: []
    }
    
    if new not in valid_transitions.get(current, []):
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid status transition from {current} to {new}"
        )

# 1. Create Delivery (Vendor or Admin)
# Removed per new directive - using Shipments instead
# @app.post("/deliveries", response_model=schemas.DeliveryResponse)
# async def create_delivery(
#     delivery: schemas.DeliveryCreate, 
#     db: AsyncSession = Depends(get_db), 
#     current_user: models.User = Depends(get_current_user)
# ):
#     ... (implementation commented out) ...

# # 2. List Deliveries (Filtered by Role)
# @app.get("/deliveries", response_model=List[schemas.DeliveryResponse])
# async def read_deliveries(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
#     ...

# # 3. Submit Delivery (Vendor)
# @app.post("/deliveries/{id}/submit", response_model=schemas.DeliveryResponse)
# async def submit_delivery(id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
#     ...

# @app.put("/deliveries/{id}", response_model=schemas.DeliveryResponse)
# async def update_delivery(id: int, req: schemas.DeliveryUpdate, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
#     ...

# @app.delete("/deliveries/{id}")
# async def delete_delivery(id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
#     ...

# @app.post("/deliveries/{id}/approve", response_model=schemas.DeliveryResponse)
# async def approve_delivery(id: int, db: AsyncSession = Depends(get_db), admin: models.User = Depends(get_current_admin)):
#     ...

# @app.post("/deliveries/{id}/reject", response_model=schemas.DeliveryResponse)
# async def reject_delivery(id: int, db: AsyncSession = Depends(get_db), admin: models.User = Depends(get_current_admin)):
#     ...

# # 4. Schedule Delivery (Admin)
# @app.post("/deliveries/{id}/upload", response_model=schemas.DeliveryResponse)
# async def upload_attachment(
#     id: int, 
#     file: UploadFile = File(...), 
#     db: AsyncSession = Depends(get_db), 
#     user: models.User = Depends(get_current_user)
# ):
#     ...

# # 4. Schedule Delivery (Admin)
# @app.post("/deliveries/{id}/schedule", response_model=schemas.DeliveryResponse)
# async def schedule_delivery(
#     id: int, 
#     req: schemas.ScheduleDeliveryRequest, 
#     db: AsyncSession = Depends(get_db), 
#     admin: models.User = Depends(get_current_admin)
# ):
#     ...

# # 5. Gate Entry (Gate Sec)
# @app.post("/deliveries/{id}/gate-in", response_model=schemas.DeliveryResponse)
# async def gate_in(
#     id: int, 
#     req: schemas.GateEntryRequest,
#     db: AsyncSession = Depends(get_db),
#     user: models.User = Depends(get_current_user)
# ):
#     ...

# @app.post("/deliveries/{id}/gate-out", response_model=schemas.DeliveryResponse)
# async def gate_out(
#     id: int, 
#     db: AsyncSession = Depends(get_db),
#     user: models.User = Depends(get_current_user)
# ):
#     ...

# # 6. Warehouse Unloading Start
# @app.post("/deliveries/{id}/unloading-start", response_model=schemas.DeliveryResponse)
# async def unloading_start(id: int, db: AsyncSession = Depends(get_db), user: models.User = Depends(get_current_user)):
#     ...

# 7. Warehouse Receive (Complete)
@app.post("/deliveries/{id}/receive", response_model=schemas.DeliveryResponse)
async def receive_goods(
    id: int, 
    req: schemas.WarehouseReceiveRequest,
    db: AsyncSession = Depends(get_db), 
    user: models.User = Depends(get_current_user)
):
    if user.role not in [models.UserRole.WAREHOUSE_OPS, models.UserRole.SUPER_ADMIN]:
        raise HTTPException(403, "Not authorized")
        
    result = await db.execute(select(models.Delivery).options(selectinload(models.Delivery.items)).where(models.Delivery.id == id))
    delivery = result.scalars().first()
    
    # Update items
    all_received = True
    for item_update in req.items:
        for item in delivery.items:
            if item.id == item_update.id:
                # Accumulate or overwrite? Requirement says "partial quantity received". 
                # Usually warehouse counts total on pallet. Let's assume input is "current total received".
                item.quantity_received = item_update.quantity_received
                if item_update.shortage_reason:
                    item.shortage_reason = item_update.shortage_reason
                    
                # Check if item fully received
                if item.quantity_received < item.quantity_expected:
                    all_received = False

    # Check overall status
    validate_status_transition(delivery.status, models.DeliveryStatus.RECEIVED)

    # Only close if all items received? Or allow manual force close?
    # Prompt says "final closure when complete".
    # For now, if we call this endpoint, we assume it's the "Finish Unloading" action.
    # If partial, maybe status remains UNLOADING?
    # Let's add a query param or request field 'finalize': bool. 
    # For now, simplified: Always move to RECEIVED, enabling next step CLOSED.
    
    delivery.status = models.DeliveryStatus.RECEIVED
    delivery.unloading_end_at = datetime.datetime.utcnow()
    
    await create_audit_log(db, user.id, "RECEIVED", f"Goods received for PO {delivery.po_number}", id)
    await db.commit()
    return delivery


# --- Admin Dashboard Stats ---
@app.get("/admin/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db), user: models.User = Depends(get_current_admin)):
    today = datetime.date.today()
    today_start = datetime.datetime.combine(today, datetime.time.min)
    today_end = datetime.datetime.combine(today, datetime.time.max)
    
    # Created Today (Shipments)
    res_created = await db.execute(
        select(func.count(models.Shipment.id)).where(
            models.Shipment.created_at >= today_start,
            models.Shipment.created_at <= today_end
        )
    )
    created_today = res_created.scalar() or 0
    
    # Active Shipments (In Transit)
    res_active = await db.execute(
        select(func.count(models.Shipment.id)).where(
            models.Shipment.status.in_([models.ShipmentStatus.PICKED_UP, models.ShipmentStatus.IN_TRANSIT])
        )
    )
    active_shipments = res_active.scalar() or 0
    
    # Pending Assignments
    res_pending = await db.execute(
        select(func.count(models.Shipment.id)).where(models.Shipment.status == models.ShipmentStatus.PENDING)
    )
    pending_count = res_pending.scalar() or 0
    
    # Active Drivers
    res_drivers = await db.execute(
        select(func.count(models.User.id)).where(
             models.User.role == models.UserRole.DRIVER,
             models.User.is_active == True # Simplified, ideally checking if on trip
        )
    )
    active_drivers = res_drivers.scalar() or 0
    
    # Delayed Shipments (> 24h pending/assigned)
    threshold = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
    res_delayed = await db.execute(
        select(func.count(models.Shipment.id)).where(
            models.Shipment.status.in_([models.ShipmentStatus.PENDING, models.ShipmentStatus.ASSIGNED]),
            models.Shipment.created_at < threshold
        )
    )
    delayed_count = res_delayed.scalar() or 0
    
    return {
        "scheduled_today": created_today,
        "vehicles_on_site": active_shipments, # Mapping to 'Active Shipments' on UI
        "pending_approvals": pending_count,   # Mapping to 'Pending Assignments'
        "dock_utilization": f"{active_drivers} Active", # Mapping to 'Active Drivers'
        "delayed_deliveries": delayed_count
    }

@app.get("/admin/audit-logs", response_model=List[schemas.AuditLogResponse])
async def get_audit_logs(limit: int = 20, db: AsyncSession = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    stmt = select(models.AuditLog).options(selectinload(models.AuditLog.user)).order_by(models.AuditLog.timestamp.desc()).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

# --- User Management (Admin) ---
@app.get("/users", response_model=List[schemas.UserResponse])
async def read_users(db: AsyncSession = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    result = await db.execute(select(models.User))
    return result.scalars().all()

@app.post("/admin/users", response_model=schemas.UserResponse)
async def create_user_admin(user: schemas.UserCreate, db: AsyncSession = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    # Check email
    existing = await db.execute(select(models.User).where(models.User.email == user.email))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pwd = get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        name=user.name,
        hashed_password=hashed_pwd,
        role=user.role,
        vendor_id=user.vendor_id,
        license_number=user.license_number,
        rating=user.rating,
        phone=user.phone
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@app.put("/admin/users/{user_id}/status", response_model=schemas.UserResponse)
async def update_user_status(
    user_id: int, 
    is_active: bool, 
    db: AsyncSession = Depends(get_db), 
    admin: models.User = Depends(get_current_admin)
):
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = is_active
    await db.commit()
    await db.refresh(user)
    return user


# --- Reporting ---
from fastapi.responses import StreamingResponse
import csv
import io

@app.get("/admin/reports/export")
async def export_shipments_csv(
    status: Optional[models.ShipmentStatus] = None,
    driver_id: Optional[int] = None,
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    db: AsyncSession = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    # Base query
    query = select(models.Shipment).options(
        selectinload(models.Shipment.sender),
        selectinload(models.Shipment.assigned_vehicle),
        selectinload(models.Shipment.assigned_driver)
    ).order_by(models.Shipment.created_at.desc())

    # Apply Filters
    if status:
        query = query.where(models.Shipment.status == status)
    if driver_id:
        query = query.where(models.Shipment.assigned_driver_id == driver_id)
    if start_date:
        query = query.where(func.date(models.Shipment.created_at) >= start_date)
    if end_date:
        query = query.where(func.date(models.Shipment.created_at) <= end_date)

    result = await db.execute(query)
    shipments = result.scalars().all()

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "ID", "Tracking Number", "Status", "Created At", 
        "Pickup Address", "Drop Address", 
        "Sender", "Driver", "Vehicle"
    ])

    for s in shipments:
        writer.writerow([
            s.id, s.tracking_number, s.status, s.created_at,
            s.pickup_address, s.drop_address,
            s.sender.email if s.sender else "N/A",
            s.assigned_driver.name if s.assigned_driver else "Unassigned",
            s.assigned_vehicle.plate_number if s.assigned_vehicle else "Unassigned"
        ])

    output.seek(0)
    
    # BytesIO wrapper for StreamingResponse
    mem = io.BytesIO()
    mem.write(output.getvalue().encode('utf-8'))
    mem.seek(0)
    
    return StreamingResponse(
        mem,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=shipments_report.csv"}
    )

@app.get("/reports/deliveries")
async def export_deliveries_csv(
    start_date: datetime.date = None,
    end_date: datetime.date = None,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    # ... implementation details omitted for brevity context ...
    pass 


# ===============================
# AUDIT LOGGING
# ===============================

async def create_audit_log(db: AsyncSession, user_id: int, action: str, entity_type: str, entity_id: int, details: str = None):
    audit = models.AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details
    )
    db.add(audit)
    # Note: Commit should be handled by the caller or auto-commit if part of larger transaction
    # We flush to simulate saving, but caller does commit.
    await db.flush()

@app.get("/admin/audit-logs", response_model=List[schemas.AuditLogResponse])
async def get_audit_logs(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    result = await db.execute(
        select(models.AuditLog)
        .options(selectinload(models.AuditLog.user))
        .order_by(models.AuditLog.timestamp.desc())
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()
# --- Legacy Factory Reports (Disabled) ---

# @app.get("/reports/deliveries")
# async def export_deliveries_csv(...):
#     ...

# @app.get("/reports/vendor-performance")
# async def vendor_performance_report(db: AsyncSession = Depends(get_db), user: models.User = Depends(get_current_user)):
#     if user.role != models.UserRole.SUPER_ADMIN:
#         raise HTTPException(403, "Not authorized")
#     return []

# @app.get("/reports/materials")
# async def export_material_intake_csv(
#     start_date: datetime.date = None,
#     end_date: datetime.date = None,
#     db: AsyncSession = Depends(get_db),
#     user: models.User = Depends(get_current_user)
# ):
#     if user.role not in [models.UserRole.SUPER_ADMIN, models.UserRole.WAREHOUSE_OPS]:
#         raise HTTPException(403, "Not authorized")
#     return StreamingResponse(iter([]), media_type="text/csv")


# ==========================================
# ENTERPRISE LOGISTICS ENDPOINTS (NEW)
# ==========================================

import uuid
import json
import math

# --- Helper: Generate Tracking Number ---
def generate_tracking_number():
    return f"SHP-{uuid.uuid4().hex[:10].upper()}"

# --- Helper: Create Notification ---
async def create_notification(db: AsyncSession, user_id: int, type: str, title: str, message: str = ""):
    notif = models.Notification(user_id=user_id, type=type, title=title, message=message)
    db.add(notif)

# --- Helper: Add Timeline Entry ---
async def add_timeline_entry(db: AsyncSession, shipment_id: int, status, user_id: int = None, notes: str = None):
    entry = models.ShipmentTimeline(
        shipment_id=shipment_id, status=status, updated_by_id=user_id, notes=notes
    )
    db.add(entry)

# --- Helper: Point in Polygon (for zone matching) ---
def point_in_polygon(lat: float, lng: float, polygon: list) -> bool:
    """Ray casting algorithm for point-in-polygon test."""
    if not polygon or len(polygon) < 3:
        return False
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i][1], polygon[i][0]  # [lng, lat] → lat, lng
        xj, yj = polygon[j][1], polygon[j][0]
        if ((yi > lng) != (yj > lng)) and (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


# ===============================
# SHIPMENT ENDPOINTS (MSME)
# ===============================

@app.post("/shipments", response_model=schemas.ShipmentResponse)
async def create_shipment(
    req: schemas.ShipmentCreate,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if user.role not in [models.UserRole.MSME, models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        raise HTTPException(403, "Only MSME users or admins can create shipments")

    shipment = models.Shipment(
        tracking_number=generate_tracking_number(),
        sender_id=user.id,
        pickup_address=req.pickup_address,
        pickup_lat=req.pickup_lat,
        pickup_lng=req.pickup_lng,
        pickup_contact=req.pickup_contact,
        pickup_phone=req.pickup_phone,
        drop_address=req.drop_address,
        drop_lat=req.drop_lat,
        drop_lng=req.drop_lng,
        drop_contact=req.drop_contact,
        drop_phone=req.drop_phone,
        total_weight=req.total_weight,
        total_volume=req.total_volume,
        description=req.description,
        special_instructions=req.special_instructions,
        status=models.ShipmentStatus.PENDING,
        po_number=req.po_number,
    )
    db.add(shipment)
    await db.flush()

    # Add items
    for item_data in req.items:
        item = models.ShipmentItem(
            shipment_id=shipment.id,
            name=item_data.name,
            quantity=item_data.quantity,
            weight=item_data.weight,
            length=item_data.length,
            width=item_data.width,
            height=item_data.height,
            description=item_data.description,
        )
        db.add(item)

    # Add timeline entry
    await add_timeline_entry(db, shipment.id, models.ShipmentStatus.PENDING, user.id, "Shipment created")
    await create_audit_log(db, user.id, "SHIPMENT_CREATED", "SHIPMENT", shipment.id, f"Shipment {shipment.tracking_number} created")

    await db.commit()
    await db.refresh(shipment)

    # Reload with relationships
    result = await db.execute(
        select(models.Shipment)
        .options(selectinload(models.Shipment.items), selectinload(models.Shipment.timeline).selectinload(models.ShipmentTimeline.updated_by))
        .where(models.Shipment.id == shipment.id)
    )
    return result.scalars().first()


# ===============================
# GLOBAL SEARCH
# ===============================

@app.get("/search/global", response_model=schemas.GlobalSearchResponse)
async def global_search(
    q: str,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    """
    Search across Shipments, Drivers, and Vehicles.
    Respects RBAC: MSME only sees their own shipments.
    """
    if not q or len(q) < 2:
        return {"shipments": [], "drivers": [], "vehicles": []}

    search_term = f"%{q}%"
    
    search_term = f"%{q}%"
    
    # 1. Shipments
    Sender = aliased(models.User)
    Driver = aliased(models.User)

    ship_query = select(models.Shipment).options(
        selectinload(models.Shipment.items),
        selectinload(models.Shipment.timeline).selectinload(models.ShipmentTimeline.updated_by),
        selectinload(models.Shipment.sender),
        selectinload(models.Shipment.assigned_driver)
    ).outerjoin(Sender, models.Shipment.sender)\
     .outerjoin(Driver, models.Shipment.assigned_driver)\
     .where(or_(
        models.Shipment.tracking_number.ilike(search_term),
        models.Shipment.po_number.ilike(search_term),
        models.Shipment.pickup_address.ilike(search_term),
        models.Shipment.drop_address.ilike(search_term),
        models.Shipment.pickup_contact.ilike(search_term),
        models.Shipment.drop_contact.ilike(search_term),
        models.Shipment.pickup_phone.ilike(search_term),
        models.Shipment.drop_phone.ilike(search_term),
        Sender.name.ilike(search_term),
        Driver.name.ilike(search_term)
    ))

    # RBAC for Shipments
    if user.role == models.UserRole.MSME:
        ship_query = ship_query.where(models.Shipment.sender_id == user.id)
    elif user.role == models.UserRole.DRIVER:
        ship_query = ship_query.where(models.Shipment.assigned_driver_id == user.id)
    
    ship_results = await db.execute(ship_query.limit(10))
    shipments = ship_results.scalars().all()

    # 2. Drivers (Admin/Ops only)
    drivers = []
    if user.role in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        driver_query = select(models.User).where(
            models.User.role == models.UserRole.DRIVER,
            or_(
                models.User.name.ilike(search_term),
                models.User.email.ilike(search_term),
                models.User.license_number.ilike(search_term),
                models.User.phone.ilike(search_term)
            )
        )
        drv_results = await db.execute(driver_query.limit(5))
        drivers = drv_results.scalars().all()

    # 3. Vehicles (Admin/Ops only)
    vehicles = []
    if user.role in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        veh_query = select(models.Vehicle).where(or_(
            models.Vehicle.plate_number.ilike(search_term),
            models.Vehicle.name.ilike(search_term)
        ))
        veh_results = await db.execute(veh_query.limit(5))
        vehicles = veh_results.scalars().all()

    return {
        "shipments": shipments,
        "drivers": drivers,
        "vehicles": vehicles
    }


@app.get("/shipments", response_model=List[schemas.ShipmentResponse])
async def list_shipments(
    q: Optional[str] = None,
    status: Optional[List[models.ShipmentStatus]] = Query(None),
    date_from: Optional[datetime.date] = None,
    date_to: Optional[datetime.date] = None,
    sort_by: Optional[str] = None,
    driver_id: Optional[int] = None,
    vehicle_id: Optional[int] = None,
    delayed: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    query = select(models.Shipment).options(
        selectinload(models.Shipment.items),
        selectinload(models.Shipment.timeline).selectinload(models.ShipmentTimeline.updated_by)
    )

    # Search filter
    if q:
        search_term = f"%{q}%"
        query = query.where(or_(
            models.Shipment.tracking_number.ilike(search_term),
            models.Shipment.pickup_address.ilike(search_term),
            models.Shipment.drop_address.ilike(search_term),
            models.Shipment.description.ilike(search_term)
        ))

    # Status filter
    if status:
        query = query.where(models.Shipment.status.in_(status))
        
    # Date range filter
    if date_from:
        query = query.where(models.Shipment.created_at >= datetime.datetime.combine(date_from, datetime.time.min))
    if date_to:
        query = query.where(models.Shipment.created_at <= datetime.datetime.combine(date_to, datetime.time.max))

    # Specific filters
    if driver_id:
        query = query.where(models.Shipment.assigned_driver_id == driver_id)
    if vehicle_id:
        query = query.where(models.Shipment.assigned_vehicle_id == vehicle_id)
    if delayed:
        threshold = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
        query = query.where(
            models.Shipment.status.in_([models.ShipmentStatus.PENDING, models.ShipmentStatus.ASSIGNED]),
            models.Shipment.created_at < threshold
        )

    # Filter by role
    if user.role == models.UserRole.MSME:
        query = query.where(models.Shipment.sender_id == user.id)
    elif user.role == models.UserRole.DRIVER:
        query = query.where(models.Shipment.assigned_driver_id == user.id)
    # SUPER_ADMIN, FLEET_MANAGER see all

    # Sorting
    if sort_by == "oldest":
        query = query.order_by(models.Shipment.created_at.asc())
    elif sort_by == "updated":
        query = query.order_by(models.Shipment.updated_at.desc())
    else:
        query = query.order_by(models.Shipment.created_at.desc())

    result = await db.execute(query)
    return result.scalars().all()


@app.get("/shipments/{id}", response_model=schemas.ShipmentResponse)
async def get_shipment(
    id: int,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    result = await db.execute(
        select(models.Shipment)
        .options(
            selectinload(models.Shipment.items),
            selectinload(models.Shipment.timeline).selectinload(models.ShipmentTimeline.updated_by)
        )
        .where(models.Shipment.id == id)
    )
    shipment = result.scalars().first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")
    return shipment


@app.put("/shipments/{id}", response_model=schemas.ShipmentResponse)
async def update_shipment(
    id: int,
    req: schemas.ShipmentUpdate,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    result = await db.execute(select(models.Shipment).where(models.Shipment.id == id))
    shipment = result.scalars().first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")
    if shipment.status != models.ShipmentStatus.PENDING:
        raise HTTPException(400, "Can only update pending shipments")

    for field, value in req.dict(exclude_unset=True).items():
        setattr(shipment, field, value)

    await db.commit()
    result = await db.execute(
        select(models.Shipment).options(selectinload(models.Shipment.items), selectinload(models.Shipment.timeline).selectinload(models.ShipmentTimeline.updated_by))
        .where(models.Shipment.id == id)
    )
    return result.scalars().first()


@app.delete("/shipments/{id}")
async def cancel_shipment(
    id: int,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    result = await db.execute(select(models.Shipment).where(models.Shipment.id == id))
    shipment = result.scalars().first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")
    if shipment.status not in [models.ShipmentStatus.PENDING, models.ShipmentStatus.ASSIGNED]:
        raise HTTPException(400, "Cannot cancel shipment in current status")

    shipment.status = models.ShipmentStatus.CANCELLED
    await add_timeline_entry(db, shipment.id, models.ShipmentStatus.CANCELLED, user.id, "Shipment cancelled")
    await create_audit_log(db, user.id, "SHIPMENT_CANCELLED", "SHIPMENT", shipment.id, f"Shipment {shipment.tracking_number} cancelled")
    await db.commit()
    return {"message": "Shipment cancelled"}


# ===============================
# DISPATCH ENGINE
# ===============================

@app.post("/shipments/{id}/dispatch", response_model=schemas.ShipmentResponse)
async def auto_dispatch_shipment(
    id: int,
    req: schemas.DispatchRequest = None,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    """Auto-dispatch: Zone Match → Vehicle Capacity Check → Driver Assignment"""
    if user.role not in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        raise HTTPException(403, "Only admin/fleet manager can dispatch")

    result = await db.execute(
        select(models.Shipment).options(selectinload(models.Shipment.items))
        .where(models.Shipment.id == id)
    )
    shipment = result.scalars().first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")
    if shipment.status != models.ShipmentStatus.PENDING:
        raise HTTPException(400, "Only pending shipments can be dispatched")

    vehicle_id = req.vehicle_id if req else None
    driver_id = req.driver_id if req else None

    # Step 1: Zone matching (if pickup coordinates available)
    zone_id = None
    if shipment.pickup_lat and shipment.pickup_lng:
        zones_result = await db.execute(
            select(models.Zone).where(models.Zone.status == models.ZoneStatus.ACTIVE)
        )
        zones = zones_result.scalars().all()
        for zone in zones:
            if zone.coordinates and point_in_polygon(shipment.pickup_lat, shipment.pickup_lng, zone.coordinates):
                zone_id = zone.id
                break

    # Step 2: Find available vehicle (or use manual override)
    if vehicle_id:
        veh_result = await db.execute(select(models.Vehicle).where(models.Vehicle.id == vehicle_id))
        vehicle = veh_result.scalars().first()
        if not vehicle:
            raise HTTPException(404, "Vehicle not found")
    else:
        # Auto-find vehicle with capacity
        veh_query = select(models.Vehicle).where(
            models.Vehicle.status == models.VehicleStatus.AVAILABLE,
        )
        if zone_id:
            veh_query = veh_query.where(models.Vehicle.zone_id == zone_id)

        veh_result = await db.execute(veh_query)
        vehicles = veh_result.scalars().all()

        # Filter by capacity
        vehicle = None
        for v in vehicles:
            remaining_weight = v.weight_capacity - v.current_weight_used
            remaining_volume = v.volume_capacity - v.current_volume_used
            if remaining_weight >= shipment.total_weight and remaining_volume >= shipment.total_volume:
                vehicle = v
                break

        if not vehicle:
            # Try vehicles from any zone if zone-specific search failed
            if zone_id:
                veh_result = await db.execute(
                    select(models.Vehicle).where(models.Vehicle.status == models.VehicleStatus.AVAILABLE)
                )
                for v in veh_result.scalars().all():
                    remaining_weight = v.weight_capacity - v.current_weight_used
                    remaining_volume = v.volume_capacity - v.current_volume_used
                    if remaining_weight >= shipment.total_weight and remaining_volume >= shipment.total_volume:
                        vehicle = v
                        break

        if not vehicle:
            await create_notification(db, user.id, "OVERLOAD", "No Vehicle Available",
                                      f"No vehicle with sufficient capacity for shipment {shipment.tracking_number}")
            await db.commit()
            raise HTTPException(400, "No available vehicle with sufficient capacity")

    # Step 3: Find driver (or use manual override)
    if driver_id:
        drv_result = await db.execute(select(models.User).where(
            models.User.id == driver_id, models.User.role == models.UserRole.DRIVER
        ))
        driver = drv_result.scalars().first()
        if not driver:
            raise HTTPException(404, "Driver not found")
    else:
        # Auto-find driver assigned to vehicle
        if vehicle.current_driver_id:
            driver_id = vehicle.current_driver_id
        else:
            # Find any available driver
            drv_result = await db.execute(
                select(models.User).where(models.User.role == models.UserRole.DRIVER)
            )
            drivers = drv_result.scalars().all()
            # Pick first available driver not currently on a trip
            for d in drivers:
                active_check = await db.execute(
                    select(func.count(models.Shipment.id)).where(
                        models.Shipment.assigned_driver_id == d.id,
                        models.Shipment.status.in_([
                            models.ShipmentStatus.ASSIGNED,
                            models.ShipmentStatus.PICKED_UP,
                            models.ShipmentStatus.IN_TRANSIT
                        ])
                    )
                )
                if active_check.scalar() == 0:
                    driver_id = d.id
                    break

            if not driver_id:
                raise HTTPException(400, "No available driver found")

    # Assign
    shipment.assigned_vehicle_id = vehicle.id
    shipment.assigned_driver_id = driver_id
    shipment.zone_id = zone_id
    shipment.status = models.ShipmentStatus.ASSIGNED
    shipment.assigned_at = datetime.datetime.utcnow()

    # Update vehicle capacity usage
    vehicle.current_weight_used += shipment.total_weight
    vehicle.current_volume_used += shipment.total_volume
    vehicle.status = models.VehicleStatus.ON_TRIP

    await add_timeline_entry(db, shipment.id, models.ShipmentStatus.ASSIGNED, user.id,
                             f"Assigned to vehicle {vehicle.plate_number}")
    await create_notification(db, driver_id, "ASSIGNMENT", "New Shipment Assigned",
                              f"Shipment {shipment.tracking_number} assigned to you")
    await create_audit_log(db, user.id, "SHIPMENT_DISPATCHED", "SHIPMENT", shipment.id,
                           f"Shipment {shipment.tracking_number} dispatched to vehicle {vehicle.plate_number}")

    await db.commit()

    result = await db.execute(
        select(models.Shipment).options(selectinload(models.Shipment.items), selectinload(models.Shipment.timeline).selectinload(models.ShipmentTimeline.updated_by))
        .where(models.Shipment.id == id)
    )
    return result.scalars().first()


@app.post("/shipments/{id}/assign", response_model=schemas.ShipmentResponse)
async def manual_assign_shipment(
    id: int,
    req: schemas.AssignRequest,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    """Manual admin override assignment"""
    if user.role not in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        raise HTTPException(403, "Not authorized")

    result = await db.execute(select(models.Shipment).where(models.Shipment.id == id))
    shipment = result.scalars().first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")

    # Validate vehicle
    veh_result = await db.execute(select(models.Vehicle).where(models.Vehicle.id == req.vehicle_id))
    vehicle = veh_result.scalars().first()
    if not vehicle:
        raise HTTPException(404, "Vehicle not found")

    # Validate driver
    drv_result = await db.execute(select(models.User).where(
        models.User.id == req.driver_id, models.User.role == models.UserRole.DRIVER
    ))
    if not drv_result.scalars().first():
        raise HTTPException(404, "Driver not found")

    # Capacity check
    remaining_weight = vehicle.weight_capacity - vehicle.current_weight_used
    remaining_volume = vehicle.volume_capacity - vehicle.current_volume_used
    if remaining_weight < shipment.total_weight or remaining_volume < shipment.total_volume:
        raise HTTPException(400, f"Vehicle capacity exceeded. Remaining: {remaining_weight}kg / {remaining_volume}m³")

    # If reassignment: restore capacity to old vehicle
    if shipment.assigned_vehicle_id:
        old_veh_res = await db.execute(select(models.Vehicle).where(models.Vehicle.id == shipment.assigned_vehicle_id))
        old_vehicle = old_veh_res.scalars().first()
        if old_vehicle:
            old_vehicle.current_weight_used = max(0, old_vehicle.current_weight_used - shipment.total_weight)
            old_vehicle.current_volume_used = max(0, old_vehicle.current_volume_used - shipment.total_volume)
            # Check if old vehicle becomes empty/available
            active_count = await db.execute(
                select(func.count(models.Shipment.id)).where(
                    models.Shipment.assigned_vehicle_id == old_vehicle.id,
                    models.Shipment.status.in_([
                        models.ShipmentStatus.ASSIGNED, models.ShipmentStatus.PICKED_UP, models.ShipmentStatus.IN_TRANSIT
                    ]),
                    models.Shipment.id != shipment.id # Exclude current shipment
                )
            )
            if active_count.scalar() == 0:
                old_vehicle.status = models.VehicleStatus.AVAILABLE

    shipment.assigned_vehicle_id = req.vehicle_id
    shipment.assigned_driver_id = req.driver_id
    shipment.status = models.ShipmentStatus.ASSIGNED
    shipment.assigned_at = datetime.datetime.utcnow()

    vehicle.current_weight_used += shipment.total_weight
    vehicle.current_volume_used += shipment.total_volume
    vehicle.status = models.VehicleStatus.ON_TRIP

    await add_timeline_entry(db, shipment.id, models.ShipmentStatus.ASSIGNED, user.id, "Manually assigned by admin")
    await create_notification(db, req.driver_id, "ASSIGNMENT", "New Shipment Assigned",
                              f"Shipment {shipment.tracking_number} assigned to you")
    await create_audit_log(db, user.id, "SHIPMENT_ASSIGNED", "SHIPMENT", shipment.id, f"Shipment {shipment.tracking_number} manually assigned to driver {req.driver_id}")

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(models.Shipment).options(
            selectinload(models.Shipment.items),
            selectinload(models.Shipment.timeline).selectinload(models.ShipmentTimeline.updated_by)
        )
        .where(models.Shipment.id == id)
    )
    return result.scalars().first()


# ===============================
# DRIVER OPERATIONS
# ===============================

@app.post("/shipments/{id}/pickup", response_model=schemas.ShipmentResponse)
async def pickup_shipment(
    id: int, db: AsyncSession = Depends(get_db), user: models.User = Depends(get_current_user)
):
    if user.role != models.UserRole.DRIVER:
        raise HTTPException(403, "Only drivers can pick up shipments")

    result = await db.execute(select(models.Shipment).where(models.Shipment.id == id))
    shipment = result.scalars().first()
    if not shipment or shipment.assigned_driver_id != user.id:
        raise HTTPException(404, "Shipment not found or not assigned to you")
    if shipment.status != models.ShipmentStatus.ASSIGNED:
        raise HTTPException(400, "Shipment must be in ASSIGNED status")

    shipment.status = models.ShipmentStatus.PICKED_UP
    shipment.picked_up_at = datetime.datetime.utcnow()
    await add_timeline_entry(db, shipment.id, models.ShipmentStatus.PICKED_UP, user.id, "Picked up by driver")
    await create_audit_log(db, user.id, "SHIPMENT_PICKED_UP", "SHIPMENT", shipment.id, f"Shipment {shipment.tracking_number} picked up")

    await db.commit()
    result = await db.execute(
        select(models.Shipment).options(selectinload(models.Shipment.items), selectinload(models.Shipment.timeline).selectinload(models.ShipmentTimeline.updated_by))
        .where(models.Shipment.id == id)
    )
    return result.scalars().first()


@app.post("/shipments/{id}/in-transit", response_model=schemas.ShipmentResponse)
async def transit_shipment(
    id: int, db: AsyncSession = Depends(get_db), user: models.User = Depends(get_current_user)
):
    if user.role != models.UserRole.DRIVER:
        raise HTTPException(403, "Only drivers can update transit status")

    result = await db.execute(select(models.Shipment).where(models.Shipment.id == id))
    shipment = result.scalars().first()
    if not shipment or shipment.assigned_driver_id != user.id:
        raise HTTPException(404, "Shipment not found or not assigned to you")
    if shipment.status != models.ShipmentStatus.PICKED_UP:
        raise HTTPException(400, "Shipment must be in PICKED_UP status")

    shipment.status = models.ShipmentStatus.IN_TRANSIT
    shipment.in_transit_at = datetime.datetime.utcnow()
    await add_timeline_entry(db, shipment.id, models.ShipmentStatus.IN_TRANSIT, user.id, "In transit")
    await create_audit_log(db, user.id, "SHIPMENT_IN_TRANSIT", "SHIPMENT", shipment.id, f"Shipment {shipment.tracking_number} in transit")

    await db.commit()
    result = await db.execute(
        select(models.Shipment).options(selectinload(models.Shipment.items), selectinload(models.Shipment.timeline).selectinload(models.ShipmentTimeline.updated_by))
        .where(models.Shipment.id == id)
    )
    return result.scalars().first()


@app.post("/shipments/{id}/deliver", response_model=schemas.ShipmentResponse)
async def deliver_shipment(
    id: int,
    req: schemas.DeliveryReceiptCreate,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    """Driver marks delivery + creates receipt (driver confirmation)"""
    if user.role != models.UserRole.DRIVER:
        raise HTTPException(403, "Only drivers can deliver shipments")

    result = await db.execute(select(models.Shipment).where(models.Shipment.id == id))
    shipment = result.scalars().first()
    if not shipment or shipment.assigned_driver_id != user.id:
        raise HTTPException(404, "Shipment not found or not assigned to you")
    if shipment.status != models.ShipmentStatus.IN_TRANSIT:
        raise HTTPException(400, "Shipment must be in IN_TRANSIT status")

    shipment.status = models.ShipmentStatus.DELIVERED
    shipment.delivered_at = datetime.datetime.utcnow()

    # Create delivery receipt
    receipt = models.DeliveryReceipt(
        shipment_id=shipment.id,
        receiver_name=req.receiver_name,
        receiver_phone=req.receiver_phone,
        photo_url=req.photo_url,
        notes=req.notes,
        driver_confirmed=True,
    )
    db.add(receipt)

    await add_timeline_entry(db, shipment.id, models.ShipmentStatus.DELIVERED, user.id, "Delivered by driver")

    # Release vehicle capacity
    if shipment.assigned_vehicle_id:
        veh_result = await db.execute(select(models.Vehicle).where(models.Vehicle.id == shipment.assigned_vehicle_id))
        vehicle = veh_result.scalars().first()
        if vehicle:
            vehicle.current_weight_used = max(0, vehicle.current_weight_used - shipment.total_weight)
            vehicle.current_volume_used = max(0, vehicle.current_volume_used - shipment.total_volume)
            # Check if vehicle has any other active shipments
            active_count = await db.execute(
                select(func.count(models.Shipment.id)).where(
                    models.Shipment.assigned_vehicle_id == vehicle.id,
                    models.Shipment.status.in_([
                        models.ShipmentStatus.ASSIGNED, models.ShipmentStatus.PICKED_UP, models.ShipmentStatus.IN_TRANSIT
                    ])
                )
            )
            if active_count.scalar() <= 1:  # This shipment is becoming delivered
                vehicle.status = models.VehicleStatus.AVAILABLE

    # Notify sender
    await create_notification(db, shipment.sender_id, "ALERT", "Shipment Delivered",
                              f"Your shipment {shipment.tracking_number} has been delivered")
    await create_audit_log(db, user.id, "SHIPMENT_DELIVERED", "SHIPMENT", shipment.id, f"Shipment {shipment.tracking_number} delivered")

    await db.commit()
    result = await db.execute(
        select(models.Shipment).options(selectinload(models.Shipment.items), selectinload(models.Shipment.timeline).selectinload(models.ShipmentTimeline.updated_by))
        .where(models.Shipment.id == id)
    )
    return result.scalars().first()


@app.post("/shipments/{id}/confirm-receipt", response_model=schemas.ShipmentResponse)
async def confirm_receipt(
    id: int, db: AsyncSession = Depends(get_db), user: models.User = Depends(get_current_user)
):
    """Receiver/sender confirms delivery (dual confirmation)"""
    result = await db.execute(
        select(models.Shipment).options(selectinload(models.Shipment.receipt))
        .where(models.Shipment.id == id)
    )
    shipment = result.scalars().first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")
    if shipment.status != models.ShipmentStatus.DELIVERED:
        raise HTTPException(400, "Shipment must be in DELIVERED status")

    if shipment.receipt:
        shipment.receipt.receiver_confirmed = True

    shipment.status = models.ShipmentStatus.CONFIRMED
    shipment.confirmed_at = datetime.datetime.utcnow()
    await add_timeline_entry(db, shipment.id, models.ShipmentStatus.CONFIRMED, user.id, "Receipt confirmed")
    await create_audit_log(db, user.id, "RECEIPT_CONFIRMED", "SHIPMENT", shipment.id, f"Receipt for {shipment.tracking_number} confirmed")

    await db.commit()
    result = await db.execute(
        select(models.Shipment).options(selectinload(models.Shipment.items), selectinload(models.Shipment.timeline).selectinload(models.ShipmentTimeline.updated_by))
        .where(models.Shipment.id == id)
    )
    return result.scalars().first()


@app.get("/shipments/{id}/receipt", response_model=schemas.ShipmentResponse)
async def get_delivery_receipt_data(
    id: int, db: AsyncSession = Depends(get_db), user: models.User = Depends(get_current_user)
):
    result = await db.execute(
        select(models.Shipment).options(
            selectinload(models.Shipment.receipt),
            selectinload(models.Shipment.items),
            selectinload(models.Shipment.timeline).selectinload(models.ShipmentTimeline.updated_by)
        ).where(models.Shipment.id == id)
    )
    shipment = result.scalars().first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")
    if not shipment.receipt:
        raise HTTPException(404, "Receipt not generated yet")
    return shipment


@app.get("/driver/dashboard")
async def driver_dashboard(
    db: AsyncSession = Depends(get_db), user: models.User = Depends(get_current_user)
):
    if user.role != models.UserRole.DRIVER:
        raise HTTPException(403, "Not a driver")

    # Active shipments
    active_result = await db.execute(
        select(func.count(models.Shipment.id)).where(
            models.Shipment.assigned_driver_id == user.id,
            models.Shipment.status.in_([
                models.ShipmentStatus.ASSIGNED, models.ShipmentStatus.PICKED_UP, models.ShipmentStatus.IN_TRANSIT
            ])
        )
    )
    active = active_result.scalar() or 0

    # Completed today
    today_start = datetime.datetime.combine(datetime.date.today(), datetime.time.min)
    completed_result = await db.execute(
        select(func.count(models.Shipment.id)).where(
            models.Shipment.assigned_driver_id == user.id,
            models.Shipment.status.in_([models.ShipmentStatus.DELIVERED, models.ShipmentStatus.CONFIRMED]),
            models.Shipment.delivered_at >= today_start
        )
    )
    completed_today = completed_result.scalar() or 0

    # Total completed
    total_result = await db.execute(
        select(func.count(models.Shipment.id)).where(
            models.Shipment.assigned_driver_id == user.id,
            models.Shipment.status.in_([models.ShipmentStatus.DELIVERED, models.ShipmentStatus.CONFIRMED])
        )
    )
    total_completed = total_result.scalar() or 0

    # Get assigned vehicle info
    vehicle_info = None
    veh_result = await db.execute(
        select(models.Vehicle).where(models.Vehicle.current_driver_id == user.id)
    )
    vehicle = veh_result.scalars().first()
    if vehicle:
        weight_pct = (vehicle.current_weight_used / vehicle.weight_capacity * 100) if vehicle.weight_capacity > 0 else 0
        volume_pct = (vehicle.current_volume_used / vehicle.volume_capacity * 100) if vehicle.volume_capacity > 0 else 0
        vehicle_info = {
            "id": vehicle.id,
            "name": vehicle.name,
            "plate_number": vehicle.plate_number,
            "weight_utilization": round(weight_pct, 1),
            "volume_utilization": round(volume_pct, 1),
        }

    return {
        "active_shipments": active,
        "completed_today": completed_today,
        "total_completed": total_completed,
        "vehicle": vehicle_info,
    }


# ===============================
# VEHICLE / FLEET MANAGEMENT
# ===============================

@app.post("/vehicles", response_model=schemas.VehicleResponse)
async def create_vehicle(
    req: schemas.VehicleCreate,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if user.role not in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        raise HTTPException(403, "Not authorized")

    # Check unique plate
    existing = await db.execute(select(models.Vehicle).where(models.Vehicle.plate_number == req.plate_number))
    if existing.scalars().first():
        raise HTTPException(400, "Vehicle with this plate number already exists")

    if req.current_driver_id:
        driver_check = await db.execute(select(models.Vehicle).where(models.Vehicle.current_driver_id == req.current_driver_id))
        if driver_check.scalars().first():
             raise HTTPException(400, "Driver is already assigned to another vehicle")

    vehicle = models.Vehicle(
        name=req.name,
        plate_number=req.plate_number,
        vehicle_type=req.vehicle_type,
        weight_capacity=req.weight_capacity,
        volume_capacity=req.volume_capacity,
        zone_id=req.zone_id,
        current_driver_id=req.current_driver_id,
    )
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    return vehicle



@app.get("/vehicles", response_model=List[schemas.VehicleResponse])
async def list_vehicles(
    status: Optional[List[models.VehicleStatus]] = Query(None),
    overloaded: bool = False,
    capacity_min: float = 0,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    query = select(models.Vehicle)
    
    if status:
        query = query.where(models.Vehicle.status.in_(status))

    if capacity_min > 0:
        query = query.where(models.Vehicle.weight_capacity >= capacity_min)
        
    result = await db.execute(query.order_by(models.Vehicle.created_at.desc()))
    vehicles = result.scalars().all()

    if overloaded:
        vehicles = [v for v in vehicles if v.current_weight_used > v.weight_capacity]

    return vehicles


@app.put("/vehicles/{id}", response_model=schemas.VehicleResponse)
async def update_vehicle(
    id: int,
    req: schemas.VehicleUpdate,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if user.role not in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        raise HTTPException(403, "Not authorized")

    result = await db.execute(select(models.Vehicle).where(models.Vehicle.id == id))
    vehicle = result.scalars().first()
    if not vehicle:
        raise HTTPException(404, "Vehicle not found")

    for field, value in req.dict(exclude_unset=True).items():
        if field == 'current_driver_id' and value is not None:
             driver_check = await db.execute(select(models.Vehicle).where(
                 models.Vehicle.current_driver_id == value,
                 models.Vehicle.id != id
             ))
             if driver_check.scalars().first():
                 raise HTTPException(400, "Driver is already assigned to another vehicle")
        setattr(vehicle, field, value)

    await db.commit()
    await db.refresh(vehicle)
    return vehicle


@app.get("/fleet/stats")
async def fleet_stats(
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if user.role not in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        raise HTTPException(403, "Not authorized")

    total_result = await db.execute(select(func.count(models.Vehicle.id)))
    total_vehicles = total_result.scalar() or 0

    available_result = await db.execute(
        select(func.count(models.Vehicle.id)).where(models.Vehicle.status == models.VehicleStatus.AVAILABLE)
    )
    available = available_result.scalar() or 0

    on_trip_result = await db.execute(
        select(func.count(models.Vehicle.id)).where(models.Vehicle.status == models.VehicleStatus.ON_TRIP)
    )
    on_trip = on_trip_result.scalar() or 0

    maintenance_result = await db.execute(
        select(func.count(models.Vehicle.id)).where(models.Vehicle.status == models.VehicleStatus.MAINTENANCE)
    )
    maintenance = maintenance_result.scalar() or 0

    # Active drivers
    active_drivers = await db.execute(
        select(func.count(func.distinct(models.Shipment.assigned_driver_id))).where(
            models.Shipment.status.in_([
                models.ShipmentStatus.ASSIGNED, models.ShipmentStatus.PICKED_UP, models.ShipmentStatus.IN_TRANSIT
            ])
        )
    )
    active_driver_count = active_drivers.scalar() or 0

    total_drivers = await db.execute(
        select(func.count(models.User.id)).where(models.User.role == models.UserRole.DRIVER)
    )
    total_driver_count = total_drivers.scalar() or 0

    return {
        "total_vehicles": total_vehicles,
        "available": available,
        "on_trip": on_trip,
        "maintenance": maintenance,
        "utilization_rate": round((on_trip / total_vehicles * 100) if total_vehicles > 0 else 0, 1),
        "active_drivers": active_driver_count,
        "total_drivers": total_driver_count,
    }


# ===============================
# ZONE MANAGEMENT
# ===============================

@app.post("/zones", response_model=schemas.ZoneResponse)
async def create_zone(
    req: schemas.ZoneCreate,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if user.role not in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        raise HTTPException(403, "Not authorized")

    zone = models.Zone(
        name=req.name,
        description=req.description,
        coordinates=req.coordinates,
        color=req.color,
    )
    db.add(zone)
    await db.commit()
    await db.refresh(zone)
    return zone


@app.get("/zones", response_model=List[schemas.ZoneResponse])
async def list_zones(
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    result = await db.execute(select(models.Zone).order_by(models.Zone.name))
    return result.scalars().all()


@app.put("/zones/{id}", response_model=schemas.ZoneResponse)
async def update_zone(
    id: int,
    req: schemas.ZoneUpdate,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if user.role not in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        raise HTTPException(403, "Not authorized")

    result = await db.execute(select(models.Zone).where(models.Zone.id == id))
    zone = result.scalars().first()
    if not zone:
        raise HTTPException(404, "Zone not found")

    for field, value in req.dict(exclude_unset=True).items():
        setattr(zone, field, value)

    await db.commit()
    await db.refresh(zone)
    return zone


@app.delete("/zones/{id}")
async def delete_zone(
    id: int,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if user.role not in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        raise HTTPException(403, "Not authorized")

    result = await db.execute(select(models.Zone).where(models.Zone.id == id))
    zone = result.scalars().first()
    if not zone:
        raise HTTPException(404, "Zone not found")

    await db.delete(zone)
    await db.commit()
    return {"message": "Zone deleted"}


# ===============================
# NOTIFICATIONS
# ===============================

@app.get("/notifications", response_model=List[schemas.NotificationResponse])
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    result = await db.execute(
        select(models.Notification)
        .where(models.Notification.user_id == user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()


@app.put("/notifications/{id}/read")
async def mark_notification_read(
    id: int,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    result = await db.execute(
        select(models.Notification).where(
            models.Notification.id == id, models.Notification.user_id == user.id
        )
    )
    notif = result.scalars().first()
    if not notif:
        raise HTTPException(404, "Notification not found")
    notif.read = True
    await db.commit()
    return {"message": "Marked as read"}


@app.put("/notifications/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    result = await db.execute(
        select(models.Notification).where(
            models.Notification.user_id == user.id, models.Notification.read == False
        )
    )
    for notif in result.scalars().all():
        notif.read = True
    await db.commit()
    return {"message": "All notifications marked as read"}


# ===============================
# ANALYTICS
# ===============================

@app.get("/analytics/fleet")
async def fleet_analytics(
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if user.role not in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        raise HTTPException(403, "Not authorized")

    # Vehicle utilization breakdown
    vehicles_result = await db.execute(select(models.Vehicle))
    vehicles = vehicles_result.scalars().all()

    total_vehicles = len(vehicles)
    available = sum(1 for v in vehicles if v.status == models.VehicleStatus.AVAILABLE)
    on_trip = sum(1 for v in vehicles if v.status == models.VehicleStatus.ON_TRIP)
    maintenance = sum(1 for v in vehicles if v.status == models.VehicleStatus.MAINTENANCE)

    total_weight_capacity = sum(v.weight_capacity or 0 for v in vehicles)
    total_weight_used = sum(v.current_weight_used or 0 for v in vehicles)
    utilization_rate = round((on_trip / total_vehicles * 100) if total_vehicles > 0 else 0, 1)

    return {
        "total_vehicles": total_vehicles,
        "available": available,
        "on_trip": on_trip,
        "maintenance": maintenance,
        "utilization_rate": utilization_rate,
        "total_weight_capacity": total_weight_capacity,
        "total_weight_used": total_weight_used,
    }


@app.get("/analytics/shipments")
async def shipment_analytics(
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if user.role not in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        raise HTTPException(403, "Not authorized")

    today = datetime.date.today()
    today_start = datetime.datetime.combine(today, datetime.time.min)

    # Today's shipments
    today_count = await db.execute(
        select(func.count(models.Shipment.id)).where(models.Shipment.created_at >= today_start)
    )

    # Active shipments
    active_count = await db.execute(
        select(func.count(models.Shipment.id)).where(
            models.Shipment.status.in_([
                models.ShipmentStatus.ASSIGNED, models.ShipmentStatus.PICKED_UP, models.ShipmentStatus.IN_TRANSIT
            ])
        )
    )

    # Completed shipments (all time)
    completed_count = await db.execute(
        select(func.count(models.Shipment.id)).where(
            models.Shipment.status.in_([models.ShipmentStatus.DELIVERED, models.ShipmentStatus.CONFIRMED])
        )
    )

    # Delayed (assigned but old — more than 24 hours since assignment)
    delayed_threshold = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
    delayed_count = await db.execute(
        select(func.count(models.Shipment.id)).where(
            models.Shipment.status.in_([models.ShipmentStatus.ASSIGNED, models.ShipmentStatus.PICKED_UP]),
            models.Shipment.assigned_at < delayed_threshold
        )
    )

    # Pending
    pending_count = await db.execute(
        select(func.count(models.Shipment.id)).where(models.Shipment.status == models.ShipmentStatus.PENDING)
    )

    # Completion rate
    total_non_cancelled = await db.execute(
        select(func.count(models.Shipment.id)).where(
            models.Shipment.status != models.ShipmentStatus.CANCELLED
        )
    )
    total_nc = total_non_cancelled.scalar() or 0
    completed = completed_count.scalar() or 0
    completion_rate = round((completed / total_nc * 100) if total_nc > 0 else 0, 1)

    # Cancelled
    cancelled_count = await db.execute(
        select(func.count(models.Shipment.id)).where(models.Shipment.status == models.ShipmentStatus.CANCELLED)
    )

    # Delivered (not confirmed yet)
    delivered_only = await db.execute(
        select(func.count(models.Shipment.id)).where(models.Shipment.status == models.ShipmentStatus.DELIVERED)
    )

    # Confirmed
    confirmed_count = await db.execute(
        select(func.count(models.Shipment.id)).where(models.Shipment.status == models.ShipmentStatus.CONFIRMED)
    )

    # Total
    total_count = await db.execute(select(func.count(models.Shipment.id)))

    today_end = today_start + datetime.timedelta(days=1)
    
    # Chart Data (Last 7 Days)
    chart_data = []
    for i in range(6, -1, -1):
        day = datetime.date.today() - datetime.timedelta(days=i)
        day_start = datetime.datetime.combine(day, datetime.time.min)
        day_end = datetime.datetime.combine(day, datetime.time.max)
        
        count = await db.execute(
            select(func.count(models.Shipment.id)).where(
                models.Shipment.created_at >= day_start,
                models.Shipment.created_at <= day_end
            )
        )
        chart_data.append({
            "date": day.strftime("%Y-%m-%d"),
            "count": count.scalar() or 0
        })

    return {
        "total": total_count.scalar() or 0,
        "today": today_count.scalar() or 0,
        "active": active_count.scalar() or 0,
        "completed": completed,
        "delivered": delivered_only.scalar() or 0,
        "confirmed": confirmed_count.scalar() or 0,
        "cancelled": cancelled_count.scalar() or 0,
        "delayed": delayed_count.scalar() or 0,
        "pending": pending_count.scalar() or 0,
        "completion_rate": completion_rate,
        "chart_data": chart_data,
    }


@app.get("/admin/alerts")
async def get_system_alerts(
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if user.role not in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER, models.UserRole.WAREHOUSE_OPS]:
        raise HTTPException(403, "Not authorized")

    alerts = {
        "delayed_shipments": [],
        "capacity_warnings": []
    }

    # 1. Delayed Shipments (> 24 hours in active state without completion)
    threshold = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
    delayed_result = await db.execute(
        select(models.Shipment).where(
            models.Shipment.status.in_([models.ShipmentStatus.ASSIGNED, models.ShipmentStatus.PICKED_UP]),
            models.Shipment.assigned_at < threshold
        ).options(selectinload(models.Shipment.items))
    )
    delayed_shipments = delayed_result.scalars().all()
    alerts["delayed_shipments"] = delayed_shipments

    return alerts


@app.get("/analytics/drivers")
async def driver_analytics(
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if user.role not in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        raise HTTPException(403, "Not authorized")

    drivers_result = await db.execute(
        select(models.User).where(models.User.role == models.UserRole.DRIVER)
    )
    drivers = drivers_result.scalars().all()

    driver_data = []
    for driver in drivers:
        # Total completed
        total_result = await db.execute(
            select(func.count(models.Shipment.id)).where(
                models.Shipment.assigned_driver_id == driver.id,
                models.Shipment.status.in_([models.ShipmentStatus.DELIVERED, models.ShipmentStatus.CONFIRMED])
            )
        )
        total = total_result.scalar() or 0

        # Active
        active_result = await db.execute(
            select(func.count(models.Shipment.id)).where(
                models.Shipment.assigned_driver_id == driver.id,
                models.Shipment.status.in_([
                    models.ShipmentStatus.ASSIGNED, models.ShipmentStatus.PICKED_UP, models.ShipmentStatus.IN_TRANSIT
                ])
            )
        )
        active = active_result.scalar() or 0

        driver_data.append({
            "driver_id": driver.id,
            "name": driver.name or driver.email,
            "email": driver.email,
            "total_shipments": total + active,
            "completed": total,
            "active": active,
            "avg_delivery_hours": None,  # Placeholder
        })

    return driver_data


# ===============================
# SAVED ADDRESSES (MSME)
# ===============================

@app.post("/addresses", response_model=schemas.SavedAddressResponse)
async def create_saved_address(
    req: schemas.SavedAddressCreate,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    # Only admins can set is_global=True
    is_global = req.is_global
    if is_global and user.role != models.UserRole.SUPER_ADMIN:
        is_global = False

    addr = models.SavedAddress(
        user_id=user.id,
        label=req.label,
        address=req.address,
        lat=req.lat,
        lng=req.lng,
        is_global=is_global
    )
    db.add(addr)
    await db.commit()
    await db.refresh(addr)
    return addr


@app.get("/addresses", response_model=List[schemas.SavedAddressResponse])
async def list_saved_addresses(
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    query = select(models.SavedAddress).where(
        or_(
            models.SavedAddress.user_id == user.id,
            models.SavedAddress.is_global == True
        )
    ).order_by(models.SavedAddress.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@app.delete("/addresses/{id}")
async def delete_saved_address(
    id: int,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    result = await db.execute(select(models.SavedAddress).where(models.SavedAddress.id == id))
    addr = result.scalars().first()
    if not addr:
        raise HTTPException(404, "Address not found")

    # Allow delete if owner OR (admin and is_global)
    if addr.user_id != user.id:
         if not (user.role == models.UserRole.SUPER_ADMIN and addr.is_global):
            raise HTTPException(403, "Not authorized to delete this address")

    await db.delete(addr)
    await db.commit()
    return {"message": "Address deleted"}


# ===============================
# OPERATIONS DASHBOARD (COMBINED)
# ===============================

@app.get("/operations/dashboard")
async def operations_dashboard(
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if user.role not in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        raise HTTPException(403, "Not authorized")

    # Active shipments as list of objects
    active_result = await db.execute(
        select(models.Shipment).where(
            models.Shipment.status.in_([
                models.ShipmentStatus.ASSIGNED, models.ShipmentStatus.PICKED_UP, models.ShipmentStatus.IN_TRANSIT
            ])
        ).order_by(models.Shipment.updated_at.desc())
    )
    active_list = []
    for s in active_result.scalars().all():
        active_list.append({
            "id": s.id,
            "tracking_number": s.tracking_number,
            "status": s.status.value if s.status else "PENDING",
            "pickup_address": s.pickup_address,
            "drop_address": s.drop_address,
            "assigned_driver_id": s.assigned_driver_id,
            "assigned_vehicle_id": s.assigned_vehicle_id,
            "total_weight": s.total_weight,
            "updated_at": str(s.updated_at) if s.updated_at else None,
        })

    # Vehicle status counts
    available_ct = await db.execute(
        select(func.count(models.Vehicle.id)).where(models.Vehicle.status == models.VehicleStatus.AVAILABLE)
    )
    on_trip_ct = await db.execute(
        select(func.count(models.Vehicle.id)).where(models.Vehicle.status == models.VehicleStatus.ON_TRIP)
    )
    maintenance_ct = await db.execute(
        select(func.count(models.Vehicle.id)).where(models.Vehicle.status == models.VehicleStatus.MAINTENANCE)
    )

    # Zone activity
    zones_result = await db.execute(select(models.Zone).where(models.Zone.status == models.ZoneStatus.ACTIVE))
    zone_activity = []
    for z in zones_result.scalars().all():
        veh_in_zone = await db.execute(
            select(func.count(models.Vehicle.id)).where(models.Vehicle.zone_id == z.id)
        )
        active_in_zone = await db.execute(
            select(func.count(models.Shipment.id)).where(
                models.Shipment.zone_id == z.id,
                models.Shipment.status.in_([
                    models.ShipmentStatus.ASSIGNED, models.ShipmentStatus.PICKED_UP, models.ShipmentStatus.IN_TRANSIT
                ])
            )
        )
        zone_activity.append({
            "zone_id": z.id,
            "zone_name": z.name,
            "color": z.color,
            "vehicle_count": veh_in_zone.scalar() or 0,
            "active_shipments": active_in_zone.scalar() or 0,
        })

    return {
        "active_shipments": active_list,
        "vehicle_status": {
            "available": available_ct.scalar() or 0,
            "on_trip": on_trip_ct.scalar() or 0,
            "maintenance": maintenance_ct.scalar() or 0,
        },
        "zone_activity": zone_activity,
    }


# ===============================
# EXPORT : SHIPMENTS CSV
# ===============================

@app.get("/reports/shipments/export")
async def export_shipments_csv(
    start_date: datetime.date = None,
    end_date: datetime.date = None,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if user.role not in [models.UserRole.SUPER_ADMIN, models.UserRole.FLEET_MANAGER]:
        raise HTTPException(403, "Not authorized")

    query = select(models.Shipment)
    if start_date:
        query = query.where(models.Shipment.created_at >= datetime.datetime.combine(start_date, datetime.time.min))
    if end_date:
        query = query.where(models.Shipment.created_at <= datetime.datetime.combine(end_date, datetime.time.max))

    result = await db.execute(query.order_by(models.Shipment.created_at.desc()))
    shipments = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Tracking #", "Status", "Pickup", "Drop", "Weight (kg)", "Volume (m³)",
                     "Created", "Assigned", "Delivered"])

    for s in shipments:
        writer.writerow([
            s.tracking_number, s.status.value, s.pickup_address, s.drop_address,
            s.total_weight, s.total_volume,
            str(s.created_at) if s.created_at else "",
            str(s.assigned_at) if s.assigned_at else "",
            str(s.delivered_at) if s.delivered_at else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=shipments_report.csv"}
    )

@app.get("/locations/autocomplete", response_model=List[str])
async def autocomplete_locations(
    q: str,
    limit: int = 5,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    """Suggest locations based on past shipments"""
    if not q or len(q) < 2:
        return []
    
    search = f"%{q}%"
    # Search Pickup
    res_pickup = await db.execute(
        select(models.Shipment.pickup_address)
        .where(models.Shipment.pickup_address.ilike(search))
        .distinct()
        .limit(limit)
    )
    # Search Drop
    res_drop = await db.execute(
        select(models.Shipment.drop_address)
        .where(models.Shipment.drop_address.ilike(search))
        .distinct()
        .limit(limit)
    )
    
    locations = set([r for r in res_pickup.scalars().all()] + [r for r in res_drop.scalars().all()])
    return list(locations)[:limit]
