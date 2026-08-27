"""Business logic layer — orchestrates calculator and repositories.

Rules:
  - No direct database access (that's invoice_repository's job).
  - No HTTP concerns (that's the route's job).
  - Receives Pydantic models, returns plain dicts shaped like InvoiceResponse.
"""
import logging

from sqlalchemy.orm import Session

from app.models.business import BusinessResponse
from app.models.customer import CustomerResponse
from app.models.invoice import InvoiceCreate
from app.repositories import business_repository, customer_repository, invoice_repository
from app.services import calculator
from app.utils.errors import (
    BusinessNotFoundError,
    CustomerNotFoundError,
    DuplicateInvoiceError,
    InvoiceNotFoundError,
)

logger = logging.getLogger(__name__)


def _verify_business_and_customer(db: Session, business_id: int, customer_id: int) -> None:
    if business_repository.find(db, business_id) is None:
        raise BusinessNotFoundError(f"Business {business_id} was not found.")
    if customer_repository.find(db, customer_id) is None:
        raise CustomerNotFoundError(f"Customer {customer_id} was not found.")


def _items_out(data: InvoiceCreate) -> list[dict]:
    return [
        {
            "description": item.description,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "item_total": calculator.calculate_item_total(item.quantity, item.unit_price),
        }
        for item in data.items
    ]


def _to_response_dict(invoice) -> dict:
    return {
        "invoice_number": invoice.invoice_number,
        "invoice_date": invoice.invoice_date,
        "due_date": invoice.due_date,
        "business": BusinessResponse.model_validate(invoice.business),
        "customer": CustomerResponse.model_validate(invoice.customer),
        "items": [
            {
                "description": item.description,
                "quantity": int(item.quantity),
                "unit_price": float(item.unit_price),
                "item_total": float(item.item_total),
            }
            for item in invoice.items
        ],
        "discount": float(invoice.discount),
        "tax_rate": float(invoice.tax_rate),
        "totals": {
            "subtotal": float(invoice.subtotal),
            "discount": float(invoice.discount),
            "taxable_amount": float(invoice.taxable_amount),
            "tax": float(invoice.tax),
            "total": float(invoice.total),
        },
        "created_at": invoice.created_at,
        "updated_at": invoice.updated_at,
    }


def get_all_invoices(db: Session) -> list[dict]:
    invoices = invoice_repository.list_all(db)
    logger.debug("Service: retrieved %d invoices", len(invoices))
    return [_to_response_dict(inv) for inv in invoices]


def get_invoice(db: Session, invoice_number: str) -> dict:
    invoice = invoice_repository.find(db, invoice_number)
    if invoice is None:
        logger.info("Service: invoice %s not found", invoice_number)
        raise InvoiceNotFoundError(f"Invoice {invoice_number} was not found.")
    return _to_response_dict(invoice)


def calculate(data: InvoiceCreate) -> dict:
    """Compute totals without writing anything. Returns totals dict."""
    logger.debug("Service: calculating for %s, item count: %d", data.invoice_number, len(data.items))
    items_as_dicts = [{"quantity": i.quantity, "unit_price": i.unit_price} for i in data.items]
    return calculator.calculate_totals(items_as_dicts, data.discount, data.tax_rate)


def create_invoice(db: Session, data: InvoiceCreate) -> dict:
    """Verify business/customer exist, calculate, check for duplicates, persist."""
    logger.debug("Service: create invoice %s", data.invoice_number)

    if invoice_repository.find(db, data.invoice_number) is not None:
        raise DuplicateInvoiceError(f"Invoice {data.invoice_number} already exists.")

    _verify_business_and_customer(db, data.business_id, data.customer_id)

    items_as_dicts = [{"quantity": i.quantity, "unit_price": i.unit_price} for i in data.items]
    totals = calculator.calculate_totals(items_as_dicts, data.discount, data.tax_rate)

    invoice = invoice_repository.create(
        db,
        invoice_number=data.invoice_number,
        business_id=data.business_id,
        customer_id=data.customer_id,
        invoice_date=data.invoice_date,
        due_date=data.due_date,
        discount=data.discount,
        tax_rate=data.tax_rate,
        totals=totals,
        items=_items_out(data),
    )
    logger.debug("Service: invoice %s created successfully", data.invoice_number)
    return _to_response_dict(invoice)


def update_invoice(db: Session, invoice_number: str, data: InvoiceCreate) -> dict:
    """Recalculate, overwrite the stored invoice, return the updated invoice dict.

    Rules:
      - invoice_number in body must match the path parameter (enforced in the route).
      - created_at is preserved automatically (DB column, never reassigned).
      - updated_at is set automatically on commit (onupdate=func.now()).
      - totals are always recalculated from the incoming data — never carried over.
      - business_id/customer_id only change which row the invoice references —
        the referenced business/customer row itself is never modified here.
    """
    logger.debug("Service: update invoice %s", invoice_number)

    existing = invoice_repository.find(db, invoice_number)
    if existing is None:
        logger.info("Service: update — invoice %s not found", invoice_number)
        raise InvoiceNotFoundError(f"Invoice {invoice_number} was not found.")

    _verify_business_and_customer(db, data.business_id, data.customer_id)

    items_as_dicts = [{"quantity": i.quantity, "unit_price": i.unit_price} for i in data.items]
    totals = calculator.calculate_totals(items_as_dicts, data.discount, data.tax_rate)

    invoice = invoice_repository.update(
        db,
        existing,
        business_id=data.business_id,
        customer_id=data.customer_id,
        invoice_date=data.invoice_date,
        due_date=data.due_date,
        discount=data.discount,
        tax_rate=data.tax_rate,
        totals=totals,
        items=_items_out(data),
    )
    logger.debug("Service: invoice %s updated successfully", invoice_number)
    return _to_response_dict(invoice)


def delete_invoice(db: Session, invoice_number: str) -> None:
    """Delete invoice or raise InvoiceNotFoundError."""
    deleted = invoice_repository.delete(db, invoice_number)
    if not deleted:
        logger.info("Service: delete — invoice %s not found", invoice_number)
        raise InvoiceNotFoundError(f"Invoice {invoice_number} was not found.")
    logger.debug("Service: deleted invoice %s", invoice_number)
