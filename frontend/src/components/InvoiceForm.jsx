import { useState, useEffect, useMemo } from "react";
import InvoiceItemsTable from "./InvoiceItemsTable";
import ErrorBanner from "./ErrorBanner";
import { calculateInvoice } from "../services/invoiceApi.js";
import { getBusinesses, createBusiness } from "../services/businessApi.js";
import { getCustomers, createCustomer } from "../services/customerApi.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function inTwoWeeks() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

let _nextId = 1;
function uid() {
  return _nextId++;
}

function emptyItem() {
  return { _id: uid(), description: "", quantity: "", unit_price: "", item_total: "" };
}

function itemToRow(item) {
  return {
    _id: uid(),
    description: item.description,
    quantity: String(item.quantity),
    unit_price: String(item.unit_price),
    item_total: String(item.item_total ?? item.quantity * item.unit_price),
  };
}

export default function InvoiceForm({
  existingInvoice,
  defaultBusiness,
  nextInvoiceNumber,
  onSave,
  onBack,
}) {
  const isEdit = Boolean(existingInvoice);

  const [businessOpen, setBusinessOpen] = useState(true);

  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState(isEdit ? existingInvoice.business.id : "");
  const [showNewBusiness, setShowNewBusiness] = useState(false);
  const [newBusiness, setNewBusiness] = useState({ name: "", address: "", email: "" });

  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState(isEdit ? existingInvoice.customer.id : "");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "" });

  const [invoiceNumber] = useState(
    isEdit ? existingInvoice.invoice_number : nextInvoiceNumber
  );
  const [invoiceDate, setInvoiceDate] = useState(
    isEdit ? existingInvoice.invoice_date : today()
  );
  const [dueDate, setDueDate] = useState(
    isEdit ? existingInvoice.due_date : inTwoWeeks()
  );

  const [items, setItems] = useState(
    isEdit && existingInvoice.items.length > 0
      ? existingInvoice.items.map(itemToRow)
      : [emptyItem(), emptyItem(), emptyItem()]
  );

  const [discount, setDiscount] = useState(
    isEdit ? String(existingInvoice.discount ?? 0) : "0"
  );
  const [taxRate, setTaxRate] = useState(
    isEdit ? String(existingInvoice.tax_rate ?? 12) : "12"
  );
  const [notes, setNotes] = useState(isEdit ? existingInvoice.notes ?? "" : "");
  const [paymentMethod, setPaymentMethod] = useState(
    isEdit ? existingInvoice.payment_method ?? "" : ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getBusinesses().then(setBusinesses).catch(() => {});
    getCustomers().then(setCustomers).catch(() => {});
  }, []);

  async function handleAddBusiness() {
    if (!newBusiness.name.trim()) return;
    try {
      const created = await createBusiness(newBusiness);
      setBusinesses((prev) => [...prev, created]);
      setBusinessId(created.id);
      setNewBusiness({ name: "", address: "", email: "" });
      setShowNewBusiness(false);
    } catch (e) {
      setError(e);
    }
  }

  async function handleAddCustomer() {
    if (!newCustomer.name.trim()) return;
    try {
      const created = await createCustomer(newCustomer);
      setCustomers((prev) => [...prev, created]);
      setCustomerId(created.id);
      setNewCustomer({ name: "", email: "" });
      setShowNewCustomer(false);
    } catch (e) {
      setError(e);
    }
  }

  const totals = useMemo(() => {
    const validItems = items.filter(
      (it) => it.description.trim() && Number(it.quantity) > 0 && it.unit_price !== ""
    );

    const subtotal = validItems.reduce((sum, it) => {
      const qty = Number(it.quantity) || 0;
      const unitPrice = Number(it.unit_price) || 0;
      return sum + qty * unitPrice;
    }, 0);

    const discountValue = Number(discount) || 0;
    const taxPercent = Number(taxRate) || 0;
    const taxable = Math.max(subtotal - discountValue, 0);
    const taxValue = taxable * (taxPercent / 100);
    const total = taxable + taxValue;

    return { subtotal, discountValue, taxable, taxValue, total };
  }, [discount, items, taxRate]);

  function validate() {
    if (!businessId) return "Business is required.";
    if (!customerId) return "Customer is required.";
    const complete = items.filter(
      (it) => it.description.trim() && Number(it.quantity) > 0 && it.unit_price !== ""
    );
    if (complete.length === 0) return "At least one complete item is required.";
    for (const it of complete) {
      if (Number(it.quantity) <= 0) return "Quantity must be greater than 0.";
    }
    return null;
  }

  function buildPayload() {
    const validItems = items.filter(
      (it) => it.description.trim() && Number(it.quantity) > 0 && it.unit_price !== ""
    );
    return {
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      business_id: businessId,
      customer_id: customerId,
      items: validItems.map((it) => ({
        description: it.description,
        quantity: parseInt(it.quantity, 10),
        unit_price: parseFloat(it.unit_price),
      })),
      discount: parseFloat(discount) || 0,
      tax_rate: parseFloat(taxRate),
      notes: notes.trim() || null,
      payment_method: paymentMethod.trim() || null,
    };
  }

  async function handleSave() {
    const err = validate();
    if (err) {
      setError({ status: 422, message: err, requestId: null });
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(buildPayload());
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }

  function handleClearOrCancel() {
    if (isEdit) {
      onBack();
    } else {
      setBusinessId("");
      setCustomerId("");
      setItems([emptyItem(), emptyItem(), emptyItem()]);
      setDiscount("0");
      setTaxRate("12");
      setNotes("");
      setPaymentMethod("");
      setError(null);
    }
  }

  return (
    <div className="no-print mx-auto max-w-4xl px-4 py-6 fade-in">
      <div className="mb-6 flex flex-col gap-1">
        <button onClick={onBack} className="w-fit text-[14px] font-medium text-[#100418]/80 transition hover:text-[#380b59]">
          ← Go Back
        </button>
        <h1 className="text-[28px] font-semibold text-[#100418]">
          {isEdit ? `Edit ${invoiceNumber}` : "Create New Invoice"}
        </h1>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="rounded-[18px] border border-[#d9d0e1] bg-white p-5 shadow-[0_8px_22px_rgba(56,11,89,0.06)] md:p-7">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => setBusinessOpen(!businessOpen)}
            className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#380b59]"
          >
            Business Details
          </button>
          <button
            type="button"
            onClick={() => setBusinessOpen(!businessOpen)}
            className="flex h-6 w-6 items-center justify-center text-lg text-[#380b59]"
            aria-label="Toggle business details"
          >
            {businessOpen ? "▾" : "▸"}
          </button>
        </div>

        {businessOpen && (
          <div className="mb-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-[12px] font-medium text-[#100418]/70">
                  Business<span className="ml-1 text-[#8f67d6]">*</span>
                </label>
                <select
                  value={businessId}
                  onChange={(e) => setBusinessId(Number(e.target.value))}
                  className="h-11 w-full rounded-[8px] border border-[#d7cedd] bg-white px-3 text-sm text-[#100418] outline-none transition focus:border-[#8f67d6] focus:ring-2 focus:ring-[#c5a3ff]/60"
                >
                  <option value="">Select a business…</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setShowNewBusiness((v) => !v)}
                  className="h-11 w-full rounded-[8px] border border-[#8f67d6] px-3 text-sm font-semibold text-[#8f67d6] transition hover:bg-[#f5efff]"
                >
                  {showNewBusiness ? "Cancel" : "+ Add new"}
                </button>
              </div>
            </div>

            {showNewBusiness && (
              <div className="mt-4 grid grid-cols-1 gap-4 rounded-[10px] border border-[#e8def6] bg-[#faf7ff] p-4 md:grid-cols-3">
                <Field label="Business Name" value={newBusiness.name} onChange={(v) => setNewBusiness({ ...newBusiness, name: v })} />
                <Field label="Address" value={newBusiness.address} onChange={(v) => setNewBusiness({ ...newBusiness, address: v })} />
                <Field label="Email" type="email" value={newBusiness.email} onChange={(v) => setNewBusiness({ ...newBusiness, email: v })} />
                <div className="md:col-span-3">
                  <button
                    type="button"
                    onClick={handleAddBusiness}
                    className="rounded-[8px] bg-[#8f67d6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7a5ec4]"
                  >
                    Save business
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#100418]/70">Invoice Number</label>
            <input
              type="text"
              value={invoiceNumber}
              readOnly={isEdit}
              className={`h-11 w-full rounded-[8px] border border-[#d7cedd] bg-white px-3 text-sm text-[#100418] outline-none transition ${isEdit ? "cursor-not-allowed bg-[#f7f5fa] text-[#100418]/50" : "focus:border-[#8f67d6] focus:ring-2 focus:ring-[#c5a3ff]/60"}`}
            />
          </div>
          <Field label="Invoice Date" type="date" value={invoiceDate} onChange={setInvoiceDate} />
          <Field label="Due Date" type="date" value={dueDate} onChange={setDueDate} />
        </div>

        <div className="mb-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-[12px] font-medium text-[#100418]/70">
                Customer<span className="ml-1 text-[#8f67d6]">*</span>
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(Number(e.target.value))}
                className="h-11 w-full rounded-[8px] border border-[#d7cedd] bg-white px-3 text-sm text-[#100418] outline-none transition focus:border-[#8f67d6] focus:ring-2 focus:ring-[#c5a3ff]/60"
              >
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setShowNewCustomer((v) => !v)}
                className="h-11 w-full rounded-[8px] border border-[#8f67d6] px-3 text-sm font-semibold text-[#8f67d6] transition hover:bg-[#f5efff]"
              >
                {showNewCustomer ? "Cancel" : "+ Add new"}
              </button>
            </div>
          </div>

          {showNewCustomer && (
            <div className="mt-4 grid grid-cols-1 gap-4 rounded-[10px] border border-[#e8def6] bg-[#faf7ff] p-4 md:grid-cols-2">
              <Field label="Customer Name" value={newCustomer.name} onChange={(v) => setNewCustomer({ ...newCustomer, name: v })} />
              <Field label="Customer Email" type="email" value={newCustomer.email} onChange={(v) => setNewCustomer({ ...newCustomer, email: v })} />
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={handleAddCustomer}
                  className="rounded-[8px] bg-[#8f67d6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7a5ec4]"
                >
                  Save customer
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mb-5 rounded-[12px] border border-[#e8def6] bg-[#faf7ff] p-4">
          <InvoiceItemsTable
            items={items}
            onChange={setItems}
            onAdd={() => setItems([...items, emptyItem()])}
            onRemove={(i) => setItems(items.filter((_, idx) => idx !== i))}
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#100418]/70">Notes / payment terms</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-[8px] border border-[#d7cedd] bg-white px-3 py-2 text-sm text-[#100418] outline-none transition focus:border-[#8f67d6] focus:ring-2 focus:ring-[#c5a3ff]/60"
              placeholder="Payment terms"
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#100418]/70">Payment method</label>
              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="h-11 w-full rounded-[8px] border border-[#d7cedd] bg-white px-3 text-sm text-[#100418] outline-none transition focus:border-[#8f67d6] focus:ring-2 focus:ring-[#c5a3ff]/60"
                placeholder="Bank transfer, cash, card..."
              />
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#100418]/70">Tax Rate (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="h-11 w-full rounded-[8px] border border-[#d7cedd] bg-white px-3 text-sm text-[#100418] outline-none transition focus:border-[#8f67d6] focus:ring-2 focus:ring-[#c5a3ff]/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#100418]/70">Discount (₱)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="h-11 w-full rounded-[8px] border border-[#d7cedd] bg-white px-3 text-sm text-[#100418] outline-none transition focus:border-[#8f67d6] focus:ring-2 focus:ring-[#c5a3ff]/60"
              />
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <div className="rounded-[10px] border border-[#d7cedd] bg-[#f8f5fb] p-4">
              <div className="flex items-center justify-between text-sm text-[#100418]/75">
                <span>Subtotal</span>
                <span>₱{totals.subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-[#100418]/75">
                <span>Discount</span>
                <span>-₱{totals.discountValue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-[#100418]/75">
                <span>Tax</span>
                <span>₱{totals.taxValue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#d7cedd] pt-3 text-[18px] font-semibold text-[#100418]">
                <span>Total</span>
                <span>₱{totals.total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-[10px] bg-[#8f67d6] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#7a5ec4] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-medium text-[#100418]/70">
        {label}
        {required && <span className="ml-1 text-[#8f67d6]">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-[8px] border border-[#d7cedd] bg-white px-3 text-sm text-[#100418] outline-none transition focus:border-[#8f67d6] focus:ring-2 focus:ring-[#c5a3ff]/60"
      />
    </div>
  );
}
