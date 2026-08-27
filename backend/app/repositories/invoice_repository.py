"""Invoice persistence — the only place that queries invoices/invoice_items.

Functions take a SQLAlchemy Session and plain values; no HTTP concerns,
no business rules beyond what SQL/ORM constraints enforce.
"""
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session, contains_eager, joinedload

from app.db.models import Invoice, InvoiceItem


def _base_query(db: Session):
    return (
        db.query(Invoice)
        .outerjoin(InvoiceItem, InvoiceItem.invoice_id == Invoice.id)
        .options(
            joinedload(Invoice.business),
            joinedload(Invoice.customer),
            contains_eager(Invoice.items),
        )
    )


def list_all(db: Session) -> list[Invoice]:
    return _base_query(db).order_by(Invoice.created_at.desc()).all()


def find(db: Session, invoice_number: str) -> Optional[Invoice]:
    return _base_query(db).filter(Invoice.invoice_number == invoice_number).first()


def create(
    db: Session,
    invoice_number: str,
    business_id: int,
    customer_id: int,
    invoice_date: date,
    due_date: date,
    discount: float,
    tax_rate: float,
    totals: dict,
    items: list[dict],
) -> Invoice:
    invoice = Invoice(
        invoice_number=invoice_number,
        business_id=business_id,
        customer_id=customer_id,
        invoice_date=invoice_date,
        due_date=due_date,
        discount=discount,
        tax_rate=tax_rate,
        subtotal=totals["subtotal"],
        taxable_amount=totals["taxable_amount"],
        tax=totals["tax"],
        total=totals["total"],
    )
    invoice.items = [
        InvoiceItem(
            description=item["description"],
            quantity=item["quantity"],
            unit_price=item["unit_price"],
            item_total=item["item_total"],
        )
        for item in items
    ]
    db.add(invoice)
    db.flush()
    result = find(db, invoice_number)
    db.commit()
    return result


def update(
    db: Session,
    invoice: Invoice,
    business_id: int,
    customer_id: int,
    invoice_date: date,
    due_date: date,
    discount: float,
    tax_rate: float,
    totals: dict,
    items: list[dict],
) -> Invoice:
    invoice.business_id = business_id
    invoice.customer_id = customer_id
    invoice.invoice_date = invoice_date
    invoice.due_date = due_date
    invoice.discount = discount
    invoice.tax_rate = tax_rate
    invoice.subtotal = totals["subtotal"]
    invoice.taxable_amount = totals["taxable_amount"]
    invoice.tax = totals["tax"]
    invoice.total = totals["total"]

    invoice.items.clear()
    invoice.items = [
        InvoiceItem(
            description=item["description"],
            quantity=item["quantity"],
            unit_price=item["unit_price"],
            item_total=item["item_total"],
        )
        for item in items
    ]
    db.flush()
    result = find(db, invoice.invoice_number)
    db.commit()
    return result


def delete(db: Session, invoice_number: str) -> bool:
    invoice = db.query(Invoice).filter(Invoice.invoice_number == invoice_number).first()
    if invoice is None:
        return False
    db.delete(invoice)
    db.commit()
    return True
