
# ===============================
# SAVED ADDRESSES
# ===============================

@app.get("/saved-addresses", response_model=List[schemas.SavedAddressResponse])
async def get_saved_addresses(
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


@app.post("/saved-addresses", response_model=schemas.SavedAddressResponse)
async def create_saved_address(
    req: schemas.SavedAddressCreate,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    # Only admins can set is_global=True
    is_global = req.is_global
    if is_global and user.role != models.UserRole.SUPER_ADMIN:
        is_global = False

    new_addr = models.SavedAddress(
        user_id=user.id,
        label=req.label,
        address=req.address,
        lat=req.lat,
        lng=req.lng,
        is_global=is_global
    )
    db.add(new_addr)
    await db.commit()
    await db.refresh(new_addr)
    return new_addr


@app.delete("/saved-addresses/{id}")
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
