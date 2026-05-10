import jsPDF from 'jspdf';
import { Quote, QuoteItem, Customer } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface BrandSettings {
  company_name: string;
  company_tagline: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  company_address: string;
  company_city: string;
  company_state: string;
  company_zip: string;
  tax_id: string;
  primary_color: string;
  secondary_color: string;
  invoice_footer: string;
  payment_terms: string;
  project_terms: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [67, 56, 202];
}

export async function generateInvoicePdf(quote: Quote): Promise<void> {
  // Fetch branding settings
  const supabase = createClient();
  const { data: s } = await supabase.from('app_settings').select('*').limit(1).single();
  const brand: BrandSettings = {
    company_name: s?.company_name ?? 'RigSync',
    company_tagline: s?.company_tagline ?? '',
    company_phone: s?.company_phone ?? '',
    company_email: s?.company_email ?? '',
    company_website: s?.company_website ?? '',
    company_address: s?.company_address ?? '',
    company_city: s?.company_city ?? '',
    company_state: s?.company_state ?? '',
    company_zip: s?.company_zip ?? '',
    tax_id: s?.tax_id ?? '',
    primary_color: s?.primary_color ?? '#4338CA',
    secondary_color: s?.secondary_color ?? '#6366F1',
    invoice_footer: s?.invoice_footer ?? 'Thank you for your business!',
    payment_terms: s?.payment_terms ?? '',
    project_terms: s?.project_terms ?? '',
  };

  const brandRgb = hexToRgb(brand.primary_color);
  const secondaryRgb = hexToRgb(brand.secondary_color);

  // Per-quote terms override global settings
  const quoteData = quote as unknown as { payment_terms_text?: string; project_terms_text?: string };
  const paymentTerms = quoteData.payment_terms_text ?? brand.payment_terms;
  const projectTerms = quoteData.project_terms_text ?? brand.project_terms;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const cust = quote.customers as Customer | null;
  const items = (quote.quote_items as QuoteItem[]) ?? [];

  const marginL = 20;
  const marginR = 215.9 - 20;
  const pageWidth = 215.9;
  let y = 20;

  const text = (t: string, x: number, yPos: number, opts?: { align?: 'left' | 'right' | 'center'; size?: number; bold?: boolean; color?: [number, number, number] }) => {
    doc.setFontSize(opts?.size ?? 10);
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    if (opts?.color) doc.setTextColor(...opts.color);
    else doc.setTextColor(30, 30, 30);
    doc.text(t, x, yPos, { align: opts?.align ?? 'left' });
  };

  // ── Header ──
  doc.setFillColor(...brandRgb);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(brand.company_name.toUpperCase(), marginL, 14);

  if (brand.company_tagline) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text(brand.company_tagline, marginL, 20);
  }

  // Company contact info in header
  const contactLines: string[] = [];
  if (brand.company_address) contactLines.push(brand.company_address);
  const cityLine = [brand.company_city, brand.company_state, brand.company_zip].filter(Boolean).join(', ');
  if (cityLine) contactLines.push(cityLine);
  if (brand.company_phone) contactLines.push(brand.company_phone);
  if (brand.company_email) contactLines.push(brand.company_email);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  contactLines.forEach((line, i) => {
    doc.text(line, marginL, 25 + i * 4);
  });

  // Doc type + number (right side)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  const docTitle = quote.status === 'invoiced' || quote.status === 'paid' ? 'INVOICE' : 'QUOTE';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(docTitle, marginR, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(quote.quote_number, marginR, 19, { align: 'right' });
  doc.text(`Date: ${formatDate(quote.created_at)}`, marginR, 25, { align: 'right' });
  if (quote.due_date) doc.text(`Due: ${formatDate(quote.due_date)}`, marginR, 31, { align: 'right' });
  doc.setTextColor(30, 30, 30);

  y = 52;

  // ── Bill To & Event Info ──
  text('BILL TO', marginL, y, { bold: true, size: 8, color: [100, 100, 100] });
  if (quote.status === 'invoiced' || quote.status === 'paid') {
    text('EVENT DETAILS', 120, y, { bold: true, size: 8, color: [100, 100, 100] });
  }
  y += 6;

  if (cust) {
    if (cust.company_name) text(cust.company_name, marginL, y, { bold: true });
    else text(`${cust.first_name} ${cust.last_name}`, marginL, y, { bold: true });
    y += 5;
    if (cust.company_name) { text(`${cust.first_name} ${cust.last_name}`, marginL, y); y += 5; }
    if (cust.email) { text(cust.email, marginL, y); y += 5; }
    if (cust.phone) { text(cust.phone, marginL, y); y += 5; }
  }

  const infoY = 58;
  if (quote.event_name) { text('Event:', 120, infoY); text(quote.event_name, 148, infoY, { bold: true }); }
  text('Start:', 120, infoY + 6); text(formatDate(quote.rental_start), 148, infoY + 6);
  text('End:', 120, infoY + 12); text(formatDate(quote.rental_end), 148, infoY + 12);
  text('Days:', 120, infoY + 18); text(String(quote.rental_days), 148, infoY + 18);

  y = Math.max(y, infoY + 28);
  y += 6;

  // ── Table header — tinted secondary color ──
  const tint = (c: number) => Math.round(c * 0.12 + 255 * 0.88);
  doc.setFillColor(tint(secondaryRgb[0]), tint(secondaryRgb[1]), tint(secondaryRgb[2]));
  doc.rect(marginL, y, pageWidth - 40, 8, 'F');
  const colDesc = marginL + 2;
  const colQty = 115;
  const colRate = 145;
  const colDays = 165;
  const colTotal = marginR;

  text('Description', colDesc, y + 5.5, { bold: true, size: 9, color: secondaryRgb });
  text('Qty', colQty, y + 5.5, { bold: true, size: 9, align: 'right', color: secondaryRgb });
  text('Rate/Day', colRate, y + 5.5, { bold: true, size: 9, align: 'right', color: secondaryRgb });
  text('Days', colDays, y + 5.5, { bold: true, size: 9, align: 'right', color: secondaryRgb });
  text('Total', colTotal, y + 5.5, { bold: true, size: 9, align: 'right', color: secondaryRgb });
  y += 10;

  // ── Line items ──
  items.forEach((item, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(marginL, y - 1, pageWidth - 40, 8, 'F');
    }
    text(item.description, colDesc, y + 5);
    text(String(item.quantity), colQty, y + 5, { align: 'right' });
    text(formatCurrency(item.daily_rate), colRate, y + 5, { align: 'right' });
    text(String(item.days), colDays, y + 5, { align: 'right' });
    text(formatCurrency(item.line_total), colTotal, y + 5, { align: 'right' });
    y += 8;

    if (y > 240) { doc.addPage(); y = 20; }
  });

  // ── Totals ──
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(120, y, marginR, y);
  y += 6;

  const totalsX = 140;
  const totalsV = marginR;

  const rowTotal = (label: string, value: number, opts?: { color?: [number, number, number]; bold?: boolean }) => {
    text(label, totalsX, y, { align: 'right', size: 9 });
    text(formatCurrency(value), totalsV, y, { align: 'right', size: 9, ...opts });
    y += 6;
  };

  rowTotal('Subtotal', quote.subtotal);
  if (quote.discount_amount > 0) rowTotal(`Discount (${quote.discount_pct}%)`, -quote.discount_amount, { color: [20, 150, 80] });
  if (quote.labor_cost > 0) rowTotal('Labor', quote.labor_cost);
  if (quote.delivery_fee > 0) rowTotal('Delivery / Setup', quote.delivery_fee);
  if (quote.tax_amount > 0) rowTotal(`Tax (${quote.tax_rate}%)`, quote.tax_amount);

  y += 2;
  doc.setFillColor(...brandRgb);
  doc.rect(120, y, pageWidth - 140, 10, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL', totalsX, y + 7, { align: 'right' });
  doc.text(formatCurrency(quote.total), totalsV, y + 7, { align: 'right' });
  y += 16;

  // ── Status banner ──
  if (quote.status === 'paid') {
    doc.setFontSize(28);
    doc.setTextColor(20, 150, 80);
    doc.setFont('helvetica', 'bold');
    doc.text('PAID', pageWidth / 2, y + 6, { align: 'center' });
    y += 14;
  } else if (quote.status === 'overdue') {
    doc.setFontSize(16);
    doc.setTextColor(200, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.text('OVERDUE — PAYMENT REQUIRED', pageWidth / 2, y + 6, { align: 'center' });
    y += 12;
  }

  doc.setTextColor(30, 30, 30);

  // ── Notes ──
  if (quote.notes) {
    y += 4;
    text('Notes', marginL, y, { bold: true, size: 9 });
    y += 5;
    const noteLines = doc.splitTextToSize(quote.notes, pageWidth - 40);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(noteLines, marginL, y);
    y += noteLines.length * 5 + 4;
  }

  // ── Footer on all pages ──
  // ── Project T&C ──
  if (projectTerms) {
    y += 6;
    text('Terms & Conditions', marginL, y, { bold: true, size: 9, color: secondaryRgb });
    y += 5;
    const tcLines = doc.splitTextToSize(projectTerms, pageWidth - 40);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(tcLines, marginL, y);
    y += tcLines.length * 4 + 4;
  }

  // ── Footer on all pages ──
  const footerText = brand.invoice_footer || 'Thank you for your business!';
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Footer color bar
    doc.setFillColor(...brandRgb);
    doc.rect(0, 265, pageWidth, 1, 'F');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, 271, { align: 'center' });
    doc.text(footerText, pageWidth / 2, 276, { align: 'center' });
    if (paymentTerms) {
      doc.setFontSize(7);
      doc.text(paymentTerms, pageWidth / 2, 280, { align: 'center' });
    }
    if (brand.tax_id) {
      doc.setFontSize(7);
      doc.text(`Tax ID: ${brand.tax_id}`, pageWidth / 2, 284, { align: 'center' });
    }
  }

  doc.save(`${quote.quote_number}.pdf`);
}
