"""Pure calculation logic — no I/O, no FastAPI, fully testable in isolation.

All money arithmetic uses decimal.Decimal with ROUND_HALF_UP at each step.
Results are returned as float for JSON serialisation.

Reference example:
  Web Design        1 × 15000 = 15000
  Website Hosting   2 × 1000  =  2000
  Subtotal                      17000
  Discount                       1000
  Taxable                       16000
  Tax (12%)                      1920
  TOTAL                         17920
"""
import logging
from decimal import ROUND_HALF_UP, Decimal
from typing import List

logger = logging.getLogger(__name__)

_CENTS = Decimal("0.01")


def _q(value: Decimal) -> Decimal:
    """Quantize to 2 decimal places with ROUND_HALF_UP."""
    return value.quantize(_CENTS, rounding=ROUND_HALF_UP)


def calculate_item_total(quantity: int, unit_price: float) -> float:
    """Return quantity × unit_price, quantized."""
    result = _q(Decimal(str(quantity)) * Decimal(str(unit_price)))
    return float(result)


def calculate_totals(
    items: List[dict],
    discount: float,
    tax_rate: float,
) -> dict:
    """Calculate invoice totals from a list of item dicts.

    Each item dict must have 'quantity' and 'unit_price'.
    Returns a dict matching InvoiceTotals schema.

    Discount is capped at subtotal — taxable_amount never goes negative.
    """
    # --- item totals ---
    item_totals = []
    for idx, item in enumerate(items):
        qty = item["quantity"]
        price = item["unit_price"]
        total = _q(Decimal(str(qty)) * Decimal(str(price)))
        logger.debug("Item %d: qty=%s unit_price=%s item_total=%s", idx, qty, price, total)
        item_totals.append(total)

    subtotal = _q(sum(item_totals, Decimal("0")))
    logger.info("Subtotal: %s", subtotal)

    # --- discount ---
    raw_discount = _q(Decimal(str(discount)))
    if raw_discount > subtotal:
        logger.warning(
            "Discount %s exceeds subtotal %s — capping to subtotal",
            raw_discount,
            subtotal,
        )
        raw_discount = subtotal
    discount_amount = raw_discount
    logger.info("Discount applied: %s", discount_amount)

    # --- taxable / tax / total ---
    taxable_amount = _q(subtotal - discount_amount)
    logger.info("Taxable amount: %s", taxable_amount)

    tax_rate_d = Decimal(str(tax_rate))
    tax_amount = _q(taxable_amount * tax_rate_d)
    logger.info("Tax rate: %s  Tax amount: %s", tax_rate_d, tax_amount)

    total = _q(taxable_amount + tax_amount)
    logger.info("Final total: %s", total)

    return {
        "subtotal": float(subtotal),
        "discount": float(discount_amount),
        "taxable_amount": float(taxable_amount),
        "tax": float(tax_amount),
        "total": float(total),
    }
