function fmt(amount) {
  if (amount === "" || amount === null || isNaN(amount)) return "";
  return "₱" + Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 });
}

export default function InvoiceItemsTable({ items, onChange, onAdd, onRemove }) {
  function handleField(index, field, value) {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, [field]: value };
      const qty = parseFloat(next.quantity) || 0;
      const price = parseFloat(next.unit_price) || 0;
      next.item_total = qty > 0 && price >= 0 ? qty * price : "";
      return next;
    });
    onChange(updated);
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(100px,0.7fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)] gap-3 pb-2 text-[12px] font-medium text-[#100418]/70">
        <span>Item description</span>
        <span className="text-center">Quantity</span>
        <span className="text-center">Unit Cost</span>
        <span className="text-center">Amount</span>
      </div>

      {items.map((item, i) => (
        <div key={item._id} className="mb-3 grid grid-cols-[minmax(0,1.5fr)_minmax(100px,0.7fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)] items-center gap-3">
          <input
            className="h-11 rounded-[8px] border border-[#d7cedd] bg-white px-3 text-sm text-[#100418] outline-none transition focus:border-[#8f67d6] focus:ring-2 focus:ring-[#c5a3ff]/60"
            value={item.description}
            placeholder="Item description"
            onChange={(e) => handleField(i, "description", e.target.value)}
          />

          <input
            type="number"
            min="1"
            className="h-11 rounded-[8px] border border-[#d7cedd] bg-white px-3 text-center text-sm text-[#100418] outline-none transition focus:border-[#8f67d6] focus:ring-2 focus:ring-[#c5a3ff]/60"
            value={item.quantity}
            onChange={(e) => handleField(i, "quantity", e.target.value)}
          />

          <input
            type="number"
            min="0"
            step="0.01"
            className="h-11 rounded-[8px] border border-[#d7cedd] bg-white px-3 text-center text-sm text-[#100418] outline-none transition focus:border-[#8f67d6] focus:ring-2 focus:ring-[#c5a3ff]/60"
            value={item.unit_price}
            onChange={(e) => handleField(i, "unit_price", e.target.value)}
          />

          <div className="flex items-center gap-2">
            <div className="flex h-11 w-full items-center justify-center rounded-[8px] border border-[#d7cedd] bg-[#f7f5fa] px-3 text-sm font-medium text-[#100418]">
              {fmt(item.item_total)}
            </div>

            {items.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#8f67d6] bg-[#f5efff] text-[18px] leading-none text-[#8f67d6] transition hover:bg-[#efe3ff]"
                title="Remove row"
                aria-label="Remove row"
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="mt-2 rounded-[8px] border border-[#8f67d6] bg-[#f5efff] px-4 py-2 text-[12px] font-medium text-[#8f67d6] transition hover:bg-[#efe3ff]"
      >
        + Add Item
      </button>
    </div>
  );
}
