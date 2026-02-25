"""
Internal Bot API - endpoints for Telegram Bot service.
No JWT authentication required (internal network only).
These endpoints are called by the Telegram bot to fetch/update customer data.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc

from database import get_db
from database.models import Customer, CustomerDebt, Sale, SaleItem, Payment

router = APIRouter()


@router.get("/customer/by-phone/{phone}")
async def get_customer_by_phone(
        phone: str,
        db: Session = Depends(get_db)
):
    """Find customer by phone number."""
    # Normalize phone: remove spaces, dashes
    clean_phone = phone.strip().replace(" ", "").replace("-", "")

    # Try exact match first
    customer = db.query(Customer).filter(
        Customer.is_deleted == False,
        Customer.phone == clean_phone
    ).first()

    # Try with/without +998 prefix
    if not customer:
        if clean_phone.startswith("+998"):
            alt_phone = clean_phone[4:]  # Remove +998
        elif clean_phone.startswith("998"):
            alt_phone = clean_phone[3:]  # Remove 998
        else:
            alt_phone = "+998" + clean_phone

        customer = db.query(Customer).filter(
            Customer.is_deleted == False,
            (Customer.phone == alt_phone) |
            (Customer.phone == clean_phone) |
            (Customer.phone.contains(clean_phone[-9:]))
        ).first()

    if not customer:
        return {"success": False, "error": "Mijoz topilmadi"}

    return {
        "success": True,
        "data": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "company_name": customer.company_name,
            "customer_type": customer.customer_type.name if customer.customer_type else "REGULAR",
            "current_debt": float(customer.current_debt or 0),
            "advance_balance": float(customer.advance_balance or 0),
            "credit_limit": float(customer.credit_limit or 0),
            "total_purchases": float(customer.total_purchases or 0),
            "total_purchases_count": customer.total_purchases_count or 0,
            "last_purchase_date": customer.last_purchase_date.isoformat() if customer.last_purchase_date else None,
            "personal_discount_percent": float(customer.personal_discount_percent or 0),
            "telegram_id": customer.telegram_id,
            "address": customer.address,
        }
    }


@router.get("/customer/by-telegram/{telegram_id}")
async def get_customer_by_telegram_id(
        telegram_id: str,
        db: Session = Depends(get_db)
):
    """Find customer by Telegram ID."""
    customer = db.query(Customer).filter(
        Customer.is_deleted == False,
        Customer.telegram_id == telegram_id
    ).first()

    if not customer:
        return {"success": False, "error": "Mijoz topilmadi"}

    return {
        "success": True,
        "data": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "company_name": customer.company_name,
            "customer_type": customer.customer_type.name if customer.customer_type else "REGULAR",
            "current_debt": float(customer.current_debt or 0),
            "advance_balance": float(customer.advance_balance or 0),
            "credit_limit": float(customer.credit_limit or 0),
            "total_purchases": float(customer.total_purchases or 0),
            "total_purchases_count": customer.total_purchases_count or 0,
            "last_purchase_date": customer.last_purchase_date.isoformat() if customer.last_purchase_date else None,
            "personal_discount_percent": float(customer.personal_discount_percent or 0),
            "telegram_id": customer.telegram_id,
            "address": customer.address,
        }
    }


@router.post("/customer/link-telegram")
async def link_telegram_id(
        data: dict,
        db: Session = Depends(get_db)
):
    """Link Telegram ID to customer account."""
    phone = data.get("phone", "").strip().replace(" ", "").replace("-", "")
    telegram_id = str(data.get("telegram_id", ""))

    if not phone or not telegram_id:
        return {"success": False, "error": "phone va telegram_id majburiy"}

    # Check if telegram_id already linked to another customer
    existing = db.query(Customer).filter(
        Customer.telegram_id == telegram_id,
        Customer.is_deleted == False
    ).first()

    if existing:
        return {
            "success": True,
            "data": {
                "id": existing.id,
                "name": existing.name,
                "phone": existing.phone,
                "already_linked": True
            }
        }

    # Find customer by phone
    clean_phone = phone
    customer = db.query(Customer).filter(
        Customer.is_deleted == False,
        Customer.phone == clean_phone
    ).first()

    # Try alternative phone formats
    if not customer:
        last_9 = clean_phone[-9:] if len(clean_phone) >= 9 else clean_phone
        customer = db.query(Customer).filter(
            Customer.is_deleted == False,
            Customer.phone.contains(last_9)
        ).first()

    if not customer:
        return {"success": False, "error": "Bu telefon raqamli mijoz topilmadi"}

    # Link telegram_id
    customer.telegram_id = telegram_id
    db.commit()

    return {
        "success": True,
        "data": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "already_linked": False
        }
    }


@router.get("/customer/{customer_id}/info")
async def get_customer_full_info(
        customer_id: int,
        db: Session = Depends(get_db)
):
    """Get full customer info including debt summary."""
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.is_deleted == False
    ).first()

    if not customer:
        return {"success": False, "error": "Mijoz topilmadi"}

    return {
        "success": True,
        "data": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "company_name": customer.company_name,
            "customer_type": customer.customer_type.name if customer.customer_type else "REGULAR",
            "current_debt": float(customer.current_debt or 0),
            "advance_balance": float(customer.advance_balance or 0),
            "credit_limit": float(customer.credit_limit or 0),
            "total_purchases": float(customer.total_purchases or 0),
            "total_purchases_count": customer.total_purchases_count or 0,
            "last_purchase_date": customer.last_purchase_date.isoformat() if customer.last_purchase_date else None,
            "personal_discount_percent": float(customer.personal_discount_percent or 0),
            "address": customer.address,
        }
    }


@router.get("/customer/{customer_id}/purchases")
async def get_customer_purchases(
        customer_id: int,
        page: int = Query(1, ge=1),
        per_page: int = Query(10, ge=1, le=50),
        db: Session = Depends(get_db)
):
    """Get customer purchase history with items."""
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.is_deleted == False
    ).first()

    if not customer:
        return {"success": False, "error": "Mijoz topilmadi"}

    # Get sales
    query = db.query(Sale).filter(
        Sale.customer_id == customer_id,
        Sale.is_cancelled == False
    ).order_by(desc(Sale.created_at))

    total = query.count()
    offset = (page - 1) * per_page
    sales = query.offset(offset).limit(per_page).all()

    sales_data = []
    for sale in sales:
        # Get items for this sale
        items = db.query(SaleItem).filter(
            SaleItem.sale_id == sale.id
        ).all()

        items_data = []
        for item in items:
            product_name = item.product.name if item.product else "Noma'lum"
            uom_symbol = item.uom.symbol if item.uom else ""
            items_data.append({
                "product_name": product_name,
                "quantity": float(item.quantity),
                "uom": uom_symbol,
                "unit_price": float(item.unit_price or 0),
                "total_price": float(item.total_price or 0),
            })

        sales_data.append({
            "id": sale.id,
            "sale_number": sale.sale_number,
            "sale_date": sale.sale_date.isoformat() if sale.sale_date else None,
            "created_at": sale.created_at.isoformat() if sale.created_at else None,
            "total_amount": float(sale.total_amount or 0),
            "paid_amount": float(sale.paid_amount or 0),
            "debt_amount": float(sale.debt_amount or 0),
            "discount_amount": float(sale.discount_amount or 0),
            "payment_status": sale.payment_status.name if sale.payment_status else "UNKNOWN",
            "items": items_data,
        })

    return {
        "success": True,
        "data": sales_data,
        "total": total,
        "page": page,
        "per_page": per_page
    }


@router.get("/customer/{customer_id}/debt-details")
async def get_customer_debt_details(
        customer_id: int,
        db: Session = Depends(get_db)
):
    """Get detailed debt info: unpaid sales + payment history."""
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.is_deleted == False
    ).first()

    if not customer:
        return {"success": False, "error": "Mijoz topilmadi"}

    # Get unpaid sales (with debt)
    unpaid_sales = db.query(Sale).filter(
        Sale.customer_id == customer_id,
        Sale.is_cancelled == False,
        Sale.debt_amount > 0
    ).order_by(desc(Sale.created_at)).limit(20).all()

    unpaid_data = []
    for sale in unpaid_sales:
        items = db.query(SaleItem).filter(SaleItem.sale_id == sale.id).all()
        items_text = ", ".join([
            f"{item.product.name} ({float(item.quantity)} {item.uom.symbol if item.uom else ''})"
            for item in items[:3]
        ])
        if len(items) > 3:
            items_text += f" +{len(items) - 3} ta"

        unpaid_data.append({
            "sale_number": sale.sale_number,
            "sale_date": sale.sale_date.isoformat() if sale.sale_date else None,
            "total_amount": float(sale.total_amount or 0),
            "paid_amount": float(sale.paid_amount or 0),
            "debt_amount": float(sale.debt_amount or 0),
            "items_summary": items_text,
        })

    # Get recent payment history
    recent_payments = db.query(CustomerDebt).filter(
        CustomerDebt.customer_id == customer_id,
        CustomerDebt.transaction_type.in_(['PAYMENT', 'payment', 'DEBT_PAYMENT'])
    ).order_by(desc(CustomerDebt.created_at)).limit(10).all()

    payments_data = []
    for p in recent_payments:
        payments_data.append({
            "date": p.created_at.isoformat() if p.created_at else None,
            "amount": float(abs(p.amount)),
            "description": p.description,
            "balance_after": float(p.balance_after or 0),
        })

    return {
        "success": True,
        "data": {
            "current_debt": float(customer.current_debt or 0),
            "advance_balance": float(customer.advance_balance or 0),
            "credit_limit": float(customer.credit_limit or 0),
            "unpaid_sales": unpaid_data,
            "recent_payments": payments_data,
        }
    }