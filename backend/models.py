from sqlalchemy import Column, Integer, String, Float, Enum, ForeignKey, Boolean, DateTime, Text, JSON
from sqlalchemy.orm import relationship
import enum
import datetime
from database import Base

# --- Enums ---

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    VENDOR = "VENDOR"
    MSME = "MSME"
    DRIVER = "DRIVER"
    FLEET_MANAGER = "FLEET_MANAGER"

class DeliveryStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    SCHEDULED = "SCHEDULED"
    ARRIVED = "ARRIVED"
    UNLOADING = "UNLOADING"
    RECEIVED = "RECEIVED"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"

class DockType(str, enum.Enum):
    LOADING = "LOADING"
    UNLOADING = "UNLOADING"
    BOTH = "BOTH"

class DockStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    OCCUPIED = "OCCUPIED"
    MAINTENANCE = "MAINTENANCE"

class ShipmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"

class VehicleStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    ON_TRIP = "ON_TRIP"
    MAINTENANCE = "MAINTENANCE"
    INACTIVE = "INACTIVE"

class VehicleType(str, enum.Enum):
    TRUCK = "TRUCK"
    VAN = "VAN"
    PICKUP = "PICKUP"
    FLATBED = "FLATBED"
    CONTAINER = "CONTAINER"

class ZoneStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"

# --- Core Models ---

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True, index=True)
    hashed_password = Column(String, nullable=True)
    role = Column(Enum(UserRole), default=UserRole.VENDOR)
    is_active = Column(Boolean, default=True)
    license_number = Column(String, unique=True, nullable=True) # For Drivers
    rating = Column(Float, default=5.0) # For Drivers/Vendors
    phone = Column(String, nullable=True) # For everyone
    
    # Links
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    
    # Relationships
    vendor = relationship("Vendor", back_populates="users")
    audit_logs = relationship("AuditLog", back_populates="user")

class Vendor(Base):
    __tablename__ = "vendors"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    contact_email = Column(String, nullable=False)
    contact_phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    gst_number = Column(String, nullable=True)
    rating = Column(Float, default=5.0)
    
    users = relationship("User", back_populates="vendor")
    deliveries = relationship("Delivery", back_populates="vendor")

class Dock(Base):
    __tablename__ = "docks"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False) # e.g. "Dock A1"
    dock_type = Column(Enum(DockType), default=DockType.UNLOADING)
    status = Column(Enum(DockStatus), default=DockStatus.AVAILABLE)
    
    deliveries = relationship("Delivery", back_populates="assigned_dock")

class Delivery(Base):
    __tablename__ = "deliveries"
    
    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String, index=True, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    
    # Logistics Details
    vehicle_number = Column(String, nullable=True)
    driver_name = Column(String, nullable=True)
    driver_phone = Column(String, nullable=True)
    
    # Schedule
    expected_arrival = Column(DateTime, nullable=True, index=True)
    assigned_dock_id = Column(Integer, ForeignKey("docks.id"), nullable=True)
    time_slot_start = Column(DateTime, nullable=True)
    time_slot_end = Column(DateTime, nullable=True)
    
    # Workflow
    status = Column(Enum(DeliveryStatus), default=DeliveryStatus.DRAFT, index=True)
    
    # Timestamps for Lifecycle
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    scheduled_at = Column(DateTime, nullable=True)
    arrived_at = Column(DateTime, nullable=True) # Gate Entry
    unloading_start_at = Column(DateTime, nullable=True)
    unloading_end_at = Column(DateTime, nullable=True) # Received
    exited_at = Column(DateTime, nullable=True) # Gate Exit
    
    # Relationships
    vendor = relationship("Vendor", back_populates="deliveries")
    assigned_dock = relationship("Dock", back_populates="deliveries")
    items = relationship("DeliveryItem", back_populates="delivery", cascade="all, delete-orphan")
    # logs = relationship("AuditLog", back_populates="delivery")
    attachments = relationship("Attachment", back_populates="delivery", cascade="all, delete-orphan")

class DeliveryItem(Base):
    __tablename__ = "delivery_items"
    
    id = Column(Integer, primary_key=True, index=True)
    delivery_id = Column(Integer, ForeignKey("deliveries.id"), nullable=False)
    material_name = Column(String, nullable=False)
    quantity_expected = Column(Float, nullable=False)
    quantity_received = Column(Float, nullable=True) # Filled by Warehouse
    unit = Column(String, default="units") # kg, boxes, pallets
    shortage_reason = Column(String, nullable=True)
    
    delivery = relationship("Delivery", back_populates="items")

class Attachment(Base):
    __tablename__ = "attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    delivery_id = Column(Integer, ForeignKey("deliveries.id"), nullable=False)
    file_name = Column(String, nullable=False)
    file_url = Column(String, nullable=False)
    uploaded_by_role = Column(String, nullable=True) # VENDOR, WAREHOUSE
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    delivery = relationship("Delivery", back_populates="attachments")

# AuditLog moved to unified model below

# ==========================================
# ENTERPRISE LOGISTICS MODELS (NEW)
# ==========================================

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # e.g. "Truck-01"
    plate_number = Column(String, unique=True, nullable=False, index=True)
    vehicle_type = Column(Enum(VehicleType), default=VehicleType.TRUCK, index=True)
    weight_capacity = Column(Float, default=1000.0)  # kg
    volume_capacity = Column(Float, default=10.0)  # cubic meters
    current_weight_used = Column(Float, default=0.0)
    current_volume_used = Column(Float, default=0.0)
    status = Column(Enum(VehicleStatus), default=VehicleStatus.AVAILABLE, index=True)
    current_driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    current_driver = relationship("User", foreign_keys=[current_driver_id])
    zone = relationship("Zone", back_populates="vehicles")
    shipments = relationship("Shipment", back_populates="assigned_vehicle")


class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    coordinates = Column(JSON, nullable=True)  # GeoJSON polygon
    color = Column(String, default="#1890ff")  # Map display color
    status = Column(Enum(ZoneStatus), default=ZoneStatus.ACTIVE)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    vehicles = relationship("Vehicle", back_populates="zone")
    shipments = relationship("Shipment", back_populates="zone")


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True, index=True)
    tracking_number = Column(String, unique=True, index=True, nullable=False)
    po_number = Column(String, nullable=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Pickup
    pickup_address = Column(String, nullable=False, index=True)
    pickup_lat = Column(Float, nullable=True)
    pickup_lng = Column(Float, nullable=True)
    pickup_contact = Column(String, nullable=True)
    pickup_phone = Column(String, nullable=True)

    # Drop
    drop_address = Column(String, nullable=False, index=True)
    drop_lat = Column(Float, nullable=True)
    drop_lng = Column(Float, nullable=True)
    drop_contact = Column(String, nullable=True)
    drop_phone = Column(String, nullable=True)

    # Cargo
    total_weight = Column(Float, default=0.0)
    total_volume = Column(Float, default=0.0)
    description = Column(String, nullable=True)
    special_instructions = Column(String, nullable=True)

    # Assignment
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)
    assigned_vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    assigned_driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Status
    status = Column(Enum(ShipmentStatus), default=ShipmentStatus.PENDING, index=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    assigned_at = Column(DateTime, nullable=True)
    picked_up_at = Column(DateTime, nullable=True)
    in_transit_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    confirmed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])
    zone = relationship("Zone", back_populates="shipments")
    assigned_vehicle = relationship("Vehicle", back_populates="shipments")
    assigned_driver = relationship("User", foreign_keys=[assigned_driver_id])
    items = relationship("ShipmentItem", back_populates="shipment", cascade="all, delete-orphan")
    timeline = relationship("ShipmentTimeline", back_populates="shipment", cascade="all, delete-orphan")
    receipt = relationship("DeliveryReceipt", back_populates="shipment", uselist=False)


class ShipmentItem(Base):
    __tablename__ = "shipment_items"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False)
    name = Column(String, nullable=False)
    quantity = Column(Integer, default=1)
    weight = Column(Float, default=0.0)  # kg
    length = Column(Float, nullable=True)  # cm
    width = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    description = Column(String, nullable=True)

    shipment = relationship("Shipment", back_populates="items")


class ShipmentTimeline(Base):
    __tablename__ = "shipment_timeline"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False)
    status = Column(Enum(ShipmentStatus), nullable=False)
    notes = Column(String, nullable=True)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    shipment = relationship("Shipment", back_populates="timeline")
    updated_by = relationship("User")


class DeliveryReceipt(Base):
    __tablename__ = "delivery_receipts"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False, unique=True)
    receiver_name = Column(String, nullable=False)
    receiver_phone = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    driver_confirmed = Column(Boolean, default=False)
    receiver_confirmed = Column(Boolean, default=False)
    received_at = Column(DateTime, default=datetime.datetime.utcnow)

    shipment = relationship("Shipment", back_populates="receipt")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String)  # e.g., "SHIPMENT_CREATED", "STATUS_UPDATE"
    entity_type = Column(String) # e.g., "SHIPMENT", "USER"
    entity_id = Column(Integer)
    details = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")


# --- Schemas (Pydantic) moved to schemas.py to avoid circular imports, 
# but models are here. 
# We will use SQLAlchemy models directly in main.py for DB ops.
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False)  # DELAY, OVERLOAD, ASSIGNMENT, ALERT
    title = Column(String, nullable=False)
    message = Column(String, nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User")


class SavedAddress(Base):
    __tablename__ = "saved_addresses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    label = Column(String, nullable=False)  # e.g. "Office", "Warehouse"
    address = Column(String, nullable=False)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    is_global = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User")
