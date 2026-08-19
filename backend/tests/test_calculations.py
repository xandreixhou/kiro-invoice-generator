"""Unit tests for calculator.py — no I/O, no FastAPI required."""
import pytest
from decimal import Decimal

from app.services.calculator import calculate_item_total, calculate_totals


# ---------------------------------------------------------------------------
# Item totals
# ---------------------------------------------------------------------------
def test_item_total_basic():
    assert calculate_item_total(2, 1000) == 2000.0


def test_item_total_single():
    assert calculate_item_total(1, 15000) == 15000.0


# ---------------------------------------------------------------------------
# Reference example  (from the spec)
# ---------------------------------------------------------------------------
def test_reference_example():
    items = [
        {"quantity": 1, "unit_price": 15000},
        {"quantity": 2, "unit_price": 1000},
    ]
    result = calculate_totals(items, discount=1000, tax_rate=0.12)
    assert result["subtotal"] == 17000.0
    assert result["discount"] == 1000.0
    assert result["taxable_amount"] == 16000.0
    assert result["tax"] == 1920.0
    assert result["total"] == 17920.0


# ---------------------------------------------------------------------------
# Rounding
# ---------------------------------------------------------------------------
def test_round_half_up():
    # 1 × 0.005 = 0.005 → rounds UP to 0.01
    assert calculate_item_total(1, 0.005) == 0.01


def test_tax_rounding():
    # tax_rate 0.333 → taxable 100 × 0.333 = 33.30
    # Confirms quantization happens on the result, not the rate itself.
    items = [{"quantity": 1, "unit_price": 100}]
    result = calculate_totals(items, discount=0, tax_rate=0.333)
    assert result["tax"] == 33.30


# ---------------------------------------------------------------------------
# Discount capping
# ---------------------------------------------------------------------------
def test_discount_capped_at_subtotal():
    items = [{"quantity": 1, "unit_price": 100}]
    result = calculate_totals(items, discount=200, tax_rate=0.0)
    assert result["discount"] == 100.0
    assert result["taxable_amount"] == 0.0
    assert result["total"] == 0.0


def test_total_never_negative():
    items = [{"quantity": 1, "unit_price": 50}]
    result = calculate_totals(items, discount=9999, tax_rate=0.12)
    assert result["total"] >= 0.0


# ---------------------------------------------------------------------------
# Zero tax
# ---------------------------------------------------------------------------
def test_zero_tax_rate():
    items = [{"quantity": 3, "unit_price": 1000}]
    result = calculate_totals(items, discount=0, tax_rate=0.0)
    assert result["tax"] == 0.0
    assert result["total"] == 3000.0


# ---------------------------------------------------------------------------
# Validation (Pydantic model layer)
# ---------------------------------------------------------------------------
from app.models.invoice import InvoiceCreate, InvoiceItem
from datetime import date
import pytest
from pydantic import ValidationError as PydanticValidationError


def _base_payload(**overrides):
    payload = {
        "invoice_number": "INV-0001",
        "invoice_date": date(2026, 8, 16),
        "due_date": date(2026, 8, 30),
        "business_id": 1,
        "customer_id": 1,
        "items": [{"description": "Web Design", "quantity": 1, "unit_price": 15000}],
        "discount": 0,
        "tax_rate": 0.12,
    }
    payload.update(overrides)
    return payload


def test_valid_invoice_passes():
    InvoiceCreate(**_base_payload())


def test_negative_quantity_rejected():
    with pytest.raises(PydanticValidationError):
        InvoiceCreate(**_base_payload(items=[{"description": "X", "quantity": -1, "unit_price": 100}]))


def test_zero_quantity_rejected():
    with pytest.raises(PydanticValidationError):
        InvoiceCreate(**_base_payload(items=[{"description": "X", "quantity": 0, "unit_price": 100}]))


def test_negative_unit_price_rejected():
    with pytest.raises(PydanticValidationError):
        InvoiceCreate(**_base_payload(items=[{"description": "X", "quantity": 1, "unit_price": -1}]))


def test_negative_discount_rejected():
    with pytest.raises(PydanticValidationError):
        InvoiceCreate(**_base_payload(discount=-10))


def test_tax_rate_above_1_rejected():
    with pytest.raises(PydanticValidationError):
        InvoiceCreate(**_base_payload(tax_rate=1.5))


def test_empty_items_rejected():
    with pytest.raises(PydanticValidationError):
        InvoiceCreate(**_base_payload(items=[]))


def test_missing_required_field():
    payload = _base_payload()
    del payload["customer_id"]
    with pytest.raises(PydanticValidationError):
        InvoiceCreate(**payload)


def test_malformed_invoice_number():
    with pytest.raises(PydanticValidationError):
        InvoiceCreate(**_base_payload(invoice_number="INV-001"))  # only 3 digits


def test_due_date_before_invoice_date():
    with pytest.raises(PydanticValidationError):
        InvoiceCreate(**_base_payload(
            invoice_date=date(2026, 8, 30),
            due_date=date(2026, 8, 16),
        ))
