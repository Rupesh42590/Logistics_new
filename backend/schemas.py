from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
import datetime
from models import (UserRole, DeliveryStatus, DockType, DockStatus,
                     ShipmentStatus, VehicleStatus, VehicleType, ZoneStatus)

# --- Auth ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[UserRole] = None

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

# --- Users ---
class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    role: UserRole = UserRole.VENDOR

class UserCreate(UserBase):
    password: str
    vendor_id: Optional[int] = None
    license_number: Optional[str] = None
    rating: Optional[float] = 5.0
    phone: Optional[str] = None

class UserResponse(UserBase):
    id: int
    is_active: bool = True
    vendor_id: Optional[int] = None
    license_number: Optional[str] = None
    rating: Optional[float] = 5.0
    phone: Optional[str] = None
    
    class Config:
        from_attributes = True

# --- Vendors ---
class VendorBase(BaseModel):
    name: str
    contact_email: str
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None

class VendorCreate(VendorBase):
    pass

class VendorResponse(VendorBase):
    id: int
    rating: float
    
    class Config:
        from_attributes = True

# --- Docks ---
class DockBase(BaseModel):
    name: str
    dock_type: DockType = DockType.UNLOADING
    status: DockStatus = DockStatus.AVAILABLE

class DockCreate(DockBase):
    pass

class DockResponse(DockBase):
    id: int
    
    class Config:
        from_attributes = True

# --- Deliveries ---
class DeliveryItemBase(BaseModel):
    material_name: str
    quantity_expected: float
    unit: str = "units"

class DeliveryItemCreate(DeliveryItemBase):
    pass

class DeliveryItemResponse(DeliveryItemBase):
    id: int
    quantity_received: Optional[float] = None
    shortage_reason: Optional[str] = None
    
    class Config:
        from_attributes = True

class DeliveryBase(BaseModel):
    po_number: str
    vendor_id: Optional[int] = None # Optional if user is Vendor
    expected_arrival: Optional[datetime.datetime] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None

class DeliveryCreate(DeliveryBase):
    items: List[DeliveryItemCreate]

class DeliveryUpdate(BaseModel):
    po_number: Optional[str] = None
    expected_arrival: Optional[datetime.datetime] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    items: Optional[List[DeliveryItemCreate]] = None

class DeliveryResponse(DeliveryBase):
    id: int
    vendor_id: int
    status: DeliveryStatus
    assigned_dock_id: Optional[int] = None
    time_slot_start: Optional[datetime.datetime] = None
    time_slot_end: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    
    # Timestamps
    submitted_at: Optional[datetime.datetime] = None
    scheduled_at: Optional[datetime.datetime] = None
    arrived_at: Optional[datetime.datetime] = None
    unloading_start_at: Optional[datetime.datetime] = None
    unloading_end_at: Optional[datetime.datetime] = None
    exited_at: Optional[datetime.datetime] = None
    
    items: List[DeliveryItemResponse] = []
    vendor: Optional[VendorResponse] = None
    assigned_dock: Optional[DockResponse] = None
    is_late: bool = False

    def __init__(self, **data):
        super().__init__(**data)
        # Calculate is_late: If scheduled/approved and expected_arrival < now and not arrived
        now = datetime.datetime.utcnow()
        if self.expected_arrival and self.expected_arrival < now:
            if self.status in [DeliveryStatus.SCHEDULED, DeliveryStatus.APPROVED, DeliveryStatus.SUBMITTED]:
                self.is_late = True
    
    class Config:
        from_attributes = True

# --- Actions ---
class ScheduleDeliveryRequest(BaseModel):
    dock_id: int
    time_slot_start: datetime.datetime
    time_slot_end: datetime.datetime

class GateEntryRequest(BaseModel):
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None

class WarehouseReceiveItem(BaseModel):
    id: int
    quantity_received: float
    shortage_reason: Optional[str] = None

class WarehouseReceiveRequest(BaseModel):
    items: List[WarehouseReceiveItem]

class AuditLogResponse(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: int
    details: Optional[str] = None
    timestamp: datetime.datetime
    user: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True

# ==========================================
# ENTERPRISE LOGISTICS SCHEMAS (NEW)
# ==========================================

# --- Vehicles ---
class VehicleBase(BaseModel):
    name: str
    plate_number: str
    vehicle_type: VehicleType = VehicleType.TRUCK
    weight_capacity: float = 1000.0
    volume_capacity: float = 10.0

class VehicleCreate(VehicleBase):
    zone_id: Optional[int] = None
    current_driver_id: Optional[int] = None

class VehicleUpdate(BaseModel):
    name: Optional[str] = None
    plate_number: Optional[str] = None
    vehicle_type: Optional[VehicleType] = None
    weight_capacity: Optional[float] = None
    volume_capacity: Optional[float] = None
    status: Optional[VehicleStatus] = None
    zone_id: Optional[int] = None
    current_driver_id: Optional[int] = None

class VehicleResponse(VehicleBase):
    id: int
    status: VehicleStatus
    current_weight_used: float = 0.0
    current_volume_used: float = 0.0
    current_driver_id: Optional[int] = None
    zone_id: Optional[int] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# --- Zones ---
class ZoneBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#1890ff"

class ZoneCreate(ZoneBase):
    coordinates: Optional[Any] = None  # GeoJSON polygon

class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    coordinates: Optional[Any] = None
    color: Optional[str] = None
    status: Optional[ZoneStatus] = None

class ZoneResponse(ZoneBase):
    id: int
    coordinates: Optional[Any] = None
    status: ZoneStatus
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# --- Shipments ---
class ShipmentItemBase(BaseModel):
    name: str
    quantity: int = 1
    weight: float = 0.0
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    description: Optional[str] = None

class ShipmentItemCreate(ShipmentItemBase):
    pass

class ShipmentItemResponse(ShipmentItemBase):
    id: int

    class Config:
        from_attributes = True

class ShipmentCreate(BaseModel):
    pickup_address: str
    po_number: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    pickup_contact: Optional[str] = None
    pickup_phone: Optional[str] = None
    drop_address: str
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None
    drop_contact: Optional[str] = None
    drop_phone: Optional[str] = None
    total_weight: float = 0.0
    total_volume: float = 0.0
    description: Optional[str] = None
    special_instructions: Optional[str] = None
    items: List[ShipmentItemCreate] = []

class ShipmentUpdate(BaseModel):
    po_number: Optional[str] = None
    pickup_address: Optional[str] = None
    drop_address: Optional[str] = None
    description: Optional[str] = None
    special_instructions: Optional[str] = None
    total_weight: Optional[float] = None
    total_volume: Optional[float] = None

class ShipmentTimelineResponse(BaseModel):
    id: int
    status: ShipmentStatus
    notes: Optional[str] = None
    timestamp: datetime.datetime
    updated_by: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class ShipmentResponse(BaseModel):
    id: int
    tracking_number: str
    po_number: Optional[str] = None
    sender_id: int
    pickup_address: str
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    pickup_contact: Optional[str] = None
    pickup_phone: Optional[str] = None
    drop_address: str
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None
    drop_contact: Optional[str] = None
    drop_phone: Optional[str] = None
    total_weight: float = 0.0
    total_volume: float = 0.0
    description: Optional[str] = None
    special_instructions: Optional[str] = None
    zone_id: Optional[int] = None
    assigned_vehicle_id: Optional[int] = None
    assigned_driver_id: Optional[int] = None
    status: ShipmentStatus
    created_at: datetime.datetime
    assigned_at: Optional[datetime.datetime] = None
    picked_up_at: Optional[datetime.datetime] = None
    in_transit_at: Optional[datetime.datetime] = None
    delivered_at: Optional[datetime.datetime] = None
    confirmed_at: Optional[datetime.datetime] = None
    items: List[ShipmentItemResponse] = []
    timeline: List[ShipmentTimelineResponse] = []

    class Config:
        from_attributes = True

# --- Dispatch ---
class DispatchRequest(BaseModel):
    vehicle_id: Optional[int] = None  # Optional manual override
    driver_id: Optional[int] = None

class AssignRequest(BaseModel):
    vehicle_id: int
    driver_id: int

# --- Delivery Receipts ---
class DeliveryReceiptCreate(BaseModel):
    receiver_name: str
    receiver_phone: Optional[str] = None
    photo_url: Optional[str] = None
    notes: Optional[str] = None

class DeliveryReceiptResponse(BaseModel):
    id: int
    shipment_id: int
    receiver_name: str
    receiver_phone: Optional[str] = None
    photo_url: Optional[str] = None
    notes: Optional[str] = None
    driver_confirmed: bool = False
    receiver_confirmed: bool = False
    received_at: datetime.datetime

    class Config:
        from_attributes = True

# --- Notifications ---
class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: Optional[str] = None
    read: bool = False
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# --- Saved Addresses ---
class SavedAddressCreate(BaseModel):
    label: str
    address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_global: bool = False

class SavedAddressResponse(SavedAddressCreate):
    id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# --- Global Search ---
class GlobalSearchResponse(BaseModel):
    shipments: List[ShipmentResponse] = []
    drivers: List[UserResponse] = []
    vehicles: List[VehicleResponse] = []

