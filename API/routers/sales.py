"""
Sales router - Sale operations with proportional discount support.
"""

from typing import Optional
from decimal import Decimal
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from database import get_db
from database.models import User, PermissionType
from core.dependencies import get_current_active_user, PermissionChecker
from schemas.sale import (
    SaleCreate, SaleResponse, SaleListResponse, SaleSearchParams,
    PaymentCreate, SaleCancelRequest, QuickSaleRequest
)
from schemas.base import SuccessResponse
from services.sale import SaleService


router = APIRouter()


@router.get(
    "",
    summary="Sotuvlar ro'yxati"
)
async def get_sales(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    customer_id: Optional[int] = Query(None),
    seller_id: Optional[int] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    payment_status: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    is_cancelled: bool = Query(False),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get paginated sales list with filters."""
    service = SaleService(db)
    
    sales, total, summary = service.get_sales(
        page=page,
        per_page=per_page,
        customer_id=customer_id,
        seller_id=seller_id,
        warehouse_id=warehouse_id,
        payment_status=payment_status,
        start_date=start_date,
        end_date=end_date,
        is_cancelled=is_cancelled
    )
    
    data = [{
        "id": s.id,
        "sale_number": s.sale_number,
        "sale_date": s.sale_date.isoformat(),
        "customer_id": s.customer_id,
        "customer_name": s.customer.name if s.customer else None,
        "seller_name": f"{s.seller.first_name} {s.seller.last_name}",
        "total_amount": s.total_amount,
        "paid_amount": s.paid_amount,
        "debt_amount": s.debt_amount,
        "payment_status": s.payment_status.value,
        "items_count": s.items.count(),
        "is_cancelled": s.is_cancelled,
        "created_at": s.created_at.isoformat()
    } for s in sales]
    
    return {
        "success": True,
        "data": data,
        "total": total,
        "page": page,
        "per_page": per_page,
        "summary": {
            "total_amount": summary["total_amount"],
            "total_paid": summary["total_paid"],
            "total_debt": summary["total_debt"]
        }
    }


@router.get(
    "/daily-summary",
    summary="Kunlik hisobot"
)
async def get_daily_summary(
    sale_date: Optional[date] = None,
    warehouse_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get daily sales summary."""
    service = SaleService(db)
    
    if not sale_date:
        sale_date = date.today()
    
    summary = service.get_daily_summary(sale_date, warehouse_id)
    
    return {"success": True, "data": summary}


@router.get(
    "/seller-summary",
    summary="Sotuvchi hisoboti"
)
async def get_seller_summary(
    seller_id: int,
    start_date: date,
    end_date: date,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get sales summary for specific seller."""
    service = SaleService(db)
    summary = service.get_seller_summary(seller_id, start_date, end_date)
    
    return {"success": True, "data": summary}


@router.get(
    "/{sale_id}",
    summary="Sotuv ma'lumotlari"
)
async def get_sale(
    sale_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get sale by ID with full details."""
    service = SaleService(db)
    sale = service.get_sale_by_id(sale_id)
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sotuv topilmadi")
    
    # Build response
    items = [{
        "id": item.id,
        "product_id": item.product_id,
        "product_name": item.product.name,
        "product_article": item.product.article,
        "quantity": item.quantity,
        "uom_id": item.uom_id,
        "uom_symbol": item.uom.symbol,
        "base_quantity": item.base_quantity,
        "original_price": item.original_price,
        "unit_price": item.unit_price,
        "discount_percent": item.discount_percent,
        "discount_amount": item.discount_amount,
        "total_price": item.total_price,
        "unit_cost": item.unit_cost,
        "notes": item.notes
    } for item in sale.items]
    
    payments = [{
        "id": p.id,
        "payment_number": p.payment_number,
        "payment_date": p.payment_date.isoformat(),
        "payment_type": p.payment_type.value,
        "amount": p.amount,
        "is_confirmed": p.is_confirmed
    } for p in sale.payments]
    
    return {
        "success": True,
        "data": {
            "id": sale.id,
            "sale_number": sale.sale_number,
            "sale_date": sale.sale_date.isoformat(),
            "customer_id": sale.customer_id,
            "customer_name": sale.customer.name if sale.customer else None,
            "customer_phone": sale.customer.phone if sale.customer else None,
            "seller_id": sale.seller_id,
            "seller_name": f"{sale.seller.first_name} {sale.seller.last_name}",
            "warehouse_id": sale.warehouse_id,
            "warehouse_name": sale.warehouse.name,
            "subtotal": sale.subtotal,
            "discount_amount": sale.discount_amount,
            "discount_percent": sale.discount_percent,
            "total_amount": sale.total_amount,
            "paid_amount": sale.paid_amount,
            "debt_amount": sale.debt_amount,
            "payment_status": sale.payment_status.value,
            "payment_type": sale.payment_type.value if sale.payment_type else None,
            "items": items,
            "payments": payments,
            "requires_delivery": sale.requires_delivery,
            "delivery_address": sale.delivery_address,
            "delivery_date": sale.delivery_date.isoformat() if sale.delivery_date else None,
            "delivery_cost": sale.delivery_cost,
            "is_vip_sale": sale.is_vip_sale,
            "is_cancelled": sale.is_cancelled,
            "cancelled_reason": sale.cancelled_reason,
            "notes": sale.notes,
            "created_at": sale.created_at.isoformat()
        }
    }


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Sotuv yaratish",
    dependencies=[Depends(PermissionChecker([PermissionType.SALE_CREATE]))]
)
async def create_sale(
    data: SaleCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create new sale with optional proportional discount.
    
    If `final_total` is provided and less than calculated subtotal,
    the discount will be distributed proportionally across all items.
    
    Example:
    - Items total: 3,500,000 so'm
    - final_total: 3,000,000 so'm
    - Each item gets ~14.3% discount proportionally
    """
    service = SaleService(db)
    
    # Prepare items
    items = [item.model_dump() for item in data.items]
    
    # Prepare payments
    payments = [p.model_dump() for p in data.payments] if data.payments else []
    
    sale, message = service.create_sale(
        seller_id=current_user.id,
        warehouse_id=data.warehouse_id,
        items=items,
        customer_id=data.customer_id,
        final_total=data.final_total,
        payments=payments,
        notes=data.notes,
        requires_delivery=data.requires_delivery,
        delivery_address=data.delivery_address,
        delivery_date=data.delivery_date,
        delivery_cost=data.delivery_cost
    )
    
    if not sale:
        raise HTTPException(status_code=400, detail=message)
    
    return {
        "success": True,
        "message": message,
        "data": {
            "id": sale.id,
            "sale_number": sale.sale_number,
            "total_amount": sale.total_amount,
            "paid_amount": sale.paid_amount,
            "debt_amount": sale.debt_amount,
            "discount_amount": sale.discount_amount,
            "discount_percent": sale.discount_percent,
            "payment_status": sale.payment_status.value
        }
    }


@router.post(
    "/quick",
    status_code=status.HTTP_201_CREATED,
    summary="Tezkor sotuv (POS)",
    dependencies=[Depends(PermissionChecker([PermissionType.SALE_CREATE]))]
)
async def quick_sale(
    data: QuickSaleRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Quick sale for POS - simplified creation with single payment.
    """
    service = SaleService(db)
    
    items = [item.model_dump() for item in data.items]
    
    # Single payment
    payments = [{
        "payment_type": data.payment_type,
        "amount": data.payment_amount
    }]
    
    sale, message = service.create_sale(
        seller_id=current_user.id,
        warehouse_id=data.warehouse_id,
        items=items,
        customer_id=data.customer_id,
        final_total=data.final_total,
        payments=payments,
        notes=data.notes
    )
    
    if not sale:
        raise HTTPException(status_code=400, detail=message)
    
    # Calculate change
    change = max(Decimal("0"), data.payment_amount - sale.total_amount)
    
    return {
        "success": True,
        "message": message,
        "data": {
            "id": sale.id,
            "sale_number": sale.sale_number,
            "total_amount": sale.total_amount,
            "paid_amount": sale.paid_amount,
            "change": change,
            "payment_status": sale.payment_status.value
        }
    }


@router.post(
    "/{sale_id}/payment",
    summary="To'lov qo'shish",
    dependencies=[Depends(PermissionChecker([PermissionType.PAYMENT_CREATE]))]
)
async def add_payment(
    sale_id: int,
    data: PaymentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add payment to existing sale."""
    service = SaleService(db)
    
    payment, message = service.add_payment(
        sale_id=sale_id,
        payment_type=data.payment_type,
        amount=data.amount,
        received_by_id=current_user.id,
        transaction_id=data.transaction_id,
        notes=data.notes
    )
    
    if not payment:
        raise HTTPException(status_code=400, detail=message)
    
    sale = service.get_sale_by_id(sale_id)
    
    return {
        "success": True,
        "message": message,
        "data": {
            "payment_id": payment.id,
            "payment_number": payment.payment_number,
            "remaining_debt": sale.debt_amount,
            "payment_status": sale.payment_status.value
        }
    }


@router.post(
    "/{sale_id}/cancel",
    summary="Sotuvni bekor qilish",
    dependencies=[Depends(PermissionChecker([PermissionType.SALE_CANCEL]))]
)
async def cancel_sale(
    sale_id: int,
    data: SaleCancelRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel sale and optionally return items to stock."""
    service = SaleService(db)
    
    success, message = service.cancel_sale(
        sale_id=sale_id,
        reason=data.reason,
        return_to_stock=data.return_to_stock,
        cancelled_by_id=current_user.id
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return SuccessResponse(message=message)


@router.get(
    "/{sale_id}/receipt",
    summary="Chek ma'lumotlari"
)
async def get_receipt(
    sale_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get receipt data for printing."""
    service = SaleService(db)
    sale = service.get_sale_by_id(sale_id)
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sotuv topilmadi")
    
    # Get company info from settings (simplified)
    company_name = "Metall Basa"
    company_address = "Toshkent sh."
    company_phone = "+998 90 123 45 67"
    
    items = [{
        "name": item.product.name,
        "quantity": float(item.quantity),
        "uom": item.uom.symbol,
        "price": float(item.unit_price),
        "total": float(item.total_price)
    } for item in sale.items]
    
    # Calculate change
    total_paid = sum(p.amount for p in sale.payments)
    change = max(Decimal("0"), total_paid - sale.total_amount)
    
    return {
        "success": True,
        "data": {
            "sale_number": sale.sale_number,
            "sale_date": sale.created_at.isoformat(),
            "company_name": company_name,
            "company_address": company_address,
            "company_phone": company_phone,
            "customer_name": sale.customer.name if sale.customer else "Noma'lum mijoz",
            "customer_phone": sale.customer.phone if sale.customer else None,
            "seller_name": f"{sale.seller.first_name} {sale.seller.last_name}",
            "items": items,
            "subtotal": float(sale.subtotal),
            "discount_amount": float(sale.discount_amount),
            "discount_percent": float(sale.discount_percent),
            "total_amount": float(sale.total_amount),
            "paid_amount": float(sale.paid_amount),
            "debt_amount": float(sale.debt_amount),
            "change_amount": float(change),
            "payment_type": sale.payment_type.value if sale.payment_type else "MIXED",
            "thank_you_message": "Xaridingiz uchun rahmat!"
        }
    }
