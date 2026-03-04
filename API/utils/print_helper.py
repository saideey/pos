"""
Print Helper - Auto queue receipt for printing.
"""
import json
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session


def queue_receipt_for_printing(
    db: Session,
    sale,
    user_id: int,
    company_name: str = "METALL BAZA",
    company_phones: list = None
) -> Optional[int]:
    """
    Queue a receipt for printing.

    Args:
        db: Database session
        sale: Sale object with items loaded
        user_id: Current user ID (seller)
        company_name: Company name for receipt header
        company_phones: List of company phone numbers

    Returns:
        print_job_id if successful, None if no printer assigned
    """
    from database.models.printer import PrintJob, PrintJobStatus, UserPrinter

    # Find user's default printer
    user_printer = db.query(UserPrinter).filter(
        UserPrinter.user_id == user_id,
        UserPrinter.is_active == True,
        UserPrinter.is_default == True
    ).first()

    if not user_printer:
        # Try any active printer for this user
        user_printer = db.query(UserPrinter).filter(
            UserPrinter.user_id == user_id,
            UserPrinter.is_active == True
        ).first()

    if not user_printer or not user_printer.printer.is_active:
        # No printer assigned to this user
        return None

    # Build receipt data
    receipt_data = {
        "company_name": company_name,
        "company_phones": company_phones or [],
        "sale_number": sale.sale_number,
        "sale_date": sale.created_at.strftime("%d.%m.%Y %H:%M") if sale.created_at else "",
        "seller_name": f"{sale.seller.first_name} {sale.seller.last_name}" if sale.seller else "",
        "customer_name": sale.customer.name if sale.customer else "",
        "items": [],
        "total_amount": float(sale.total_amount or 0),
        "discount_amount": float(sale.discount_amount or 0),
        "paid_amount": float(sale.paid_amount or 0),
        "debt_amount": float(sale.debt_amount or 0),
        "payment_type": sale.payment_type.value if sale.payment_type else "cash"
    }

    # Add items
    for item in sale.items:
        # Smart quantity format: 30.0→30, 35.1→35.1
        raw_qty = float(item.quantity or 0)
        if raw_qty == int(raw_qty):
            qty_val = int(raw_qty)
        else:
            qty_val = round(raw_qty, 4)
            # Remove trailing zeros: 35.10 → 35.1
            qty_val = float(f"{qty_val:.4f}".rstrip('0').rstrip('.'))

        item_data = {
            "name": item.product.name if item.product else "?",
            "quantity": qty_val,
            "uom": item.uom.symbol if item.uom else "",
            "unit_price": float(item.unit_price or 0),
            "total": float(item.total_price or 0),
            "discount": float(item.discount_amount or 0)
        }

        # Try to get calcInfo from item notes (stored as JSON by POS)
        if item.notes:
            try:
                calc_info = json.loads(item.notes)
                if isinstance(calc_info, dict) and 'pieces' in calc_info:
                    # Clean up pieces/perPiece values
                    p = float(calc_info.get('pieces', 0))
                    pp = float(calc_info.get('perPiece', 0))
                    item_data["calcInfo"] = {
                        "pieces": str(int(p)) if p == int(p) else str(p),
                        "perPiece": str(int(pp)) if pp == int(pp) else str(pp),
                        "uom": calc_info.get('uom', item.uom.symbol if item.uom else '')
                    }
            except (json.JSONDecodeError, TypeError, ValueError):
                pass

        # Fallback: reconstruct from product.default_per_piece
        if "calcInfo" not in item_data and item.product:
            dpp = getattr(item.product, 'default_per_piece', None)
            if dpp and float(dpp) > 0:
                per_piece = float(dpp)
                qty = float(item.quantity or 0)
                if qty > 0 and per_piece > 0:
                    pieces = qty / per_piece
                    if abs(pieces - round(pieces, 2)) < 0.001:
                        pieces_clean = int(pieces) if pieces == int(pieces) else round(pieces, 2)
                        per_piece_clean = int(per_piece) if per_piece == int(per_piece) else per_piece
                        item_data["calcInfo"] = {
                            "pieces": str(pieces_clean),
                            "perPiece": str(per_piece_clean),
                            "uom": item.uom.symbol if item.uom else ""
                        }

        receipt_data["items"].append(item_data)

    # Create print job
    job = PrintJob(
        printer_id=user_printer.printer_id,
        sale_id=sale.id,
        user_id=user_id,
        job_type="receipt",
        content=json.dumps(receipt_data, ensure_ascii=False),
        content_type="json",
        status=PrintJobStatus.PENDING,
        priority=5  # High priority for receipts
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    return job.id


def queue_test_print(db: Session, printer_id: int, user_id: int) -> int:
    """Queue a test print job."""
    from database.models.printer import PrintJob, PrintJobStatus

    test_data = {
        "company_name": "METALL BAZA",
        "company_phones": ["+998 XX XXX XX XX"],
        "sale_number": "TEST-001",
        "sale_date": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "seller_name": "Test Print",
        "customer_name": "",
        "items": [
            {
                "name": "Test mahsulot",
                "quantity": 1,
                "uom": "dona",
                "unit_price": 10000,
                "total": 10000,
                "discount": 0
            }
        ],
        "total_amount": 10000,
        "discount_amount": 0,
        "paid_amount": 10000,
        "debt_amount": 0,
        "payment_type": "cash"
    }

    job = PrintJob(
        printer_id=printer_id,
        user_id=user_id,
        job_type="test",
        content=json.dumps(test_data, ensure_ascii=False),
        content_type="json",
        status=PrintJobStatus.PENDING,
        priority=1  # Highest priority for test
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    return job.id