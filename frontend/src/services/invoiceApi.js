/**
 * Invoice-specific API calls.
 *
 * Tax conversion rule (single source of truth):
 *   UI stores tax as percent (12).
 *   API expects decimal (0.12).
 *   Convert OUT when sending, convert BACK IN when receiving.
 */
import { request } from "./apiClient.js";

/** Convert invoice payload: percent → decimal for tax_rate */
function toApiPayload(data) {
  return {
    ...data,
    tax_rate: data.tax_rate / 100,
  };
}

/** Convert invoice response: decimal → percent for tax_rate */
function fromApiInvoice(inv) {
  if (!inv) return inv;
  return {
    ...inv,
    tax_rate: inv.tax_rate * 100,
  };
}

export function getInvoices() {
  return request("/api/invoices");
}

export function getInvoice(invoiceNumber) {
  return request(`/api/invoices/${encodeURIComponent(invoiceNumber)}`).then(fromApiInvoice);
}

export function calculateInvoice(data) {
  return request("/api/invoices/calculate", {
    method: "POST",
    body: JSON.stringify(toApiPayload(data)),
  });
}

export function createInvoice(data) {
  return request("/api/invoices", {
    method: "POST",
    body: JSON.stringify(toApiPayload(data)),
  }).then(fromApiInvoice);
}

export function updateInvoice(invoiceNumber, data) {
  return request(`/api/invoices/${encodeURIComponent(invoiceNumber)}`, {
    method: "PUT",
    body: JSON.stringify(toApiPayload(data)),
  }).then(fromApiInvoice);
}

export function deleteInvoice(invoiceNumber) {
  return request(`/api/invoices/${encodeURIComponent(invoiceNumber)}`, {
    method: "DELETE",
  });
}
