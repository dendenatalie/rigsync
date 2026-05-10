import { createClient } from '@/lib/supabase/client';

/**
 * Check if a specific item is available for a given date range.
 * Optionally excludes bookings for a specific quote (for editing existing quotes).
 */
export async function checkItemAvailability(
  itemId: string,
  startDate: string,
  endDate: string,
  excludeQuoteId?: string
): Promise<boolean> {
  const supabase = createClient();

  let query = supabase
    .from('rental_bookings')
    .select('id, quotes!inner(status)')
    .eq('item_id', itemId)
    .lte('rental_start', endDate)
    .gte('rental_end', startDate)
    .not('quotes.status', 'in', '("cancelled","draft")');

  if (excludeQuoteId) {
    query = query.neq('quote_id', excludeQuoteId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data?.length ?? 0) === 0;
}

/**
 * Get all booked item IDs for a date range.
 */
export async function getBookedItemIds(
  startDate: string,
  endDate: string,
  excludeQuoteId?: string
): Promise<Set<string>> {
  const supabase = createClient();

  let query = supabase
    .from('rental_bookings')
    .select('item_id, quotes!inner(status)')
    .lte('rental_start', endDate)
    .gte('rental_end', startDate)
    .not('quotes.status', 'in', '("cancelled","draft")');

  if (excludeQuoteId) {
    query = query.neq('quote_id', excludeQuoteId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return new Set((data ?? []).map((b: { item_id: string }) => b.item_id));
}

/**
 * Check availability for all items in a kit.
 */
export async function checkKitAvailability(
  kitId: string,
  startDate: string,
  endDate: string,
  excludeQuoteId?: string
): Promise<{ available: boolean; unavailableItems: string[] }> {
  const supabase = createClient();

  const { data: kitItems, error } = await supabase
    .from('kit_items')
    .select('item_id, inventory_items(name)')
    .eq('kit_id', kitId);

  if (error) throw error;
  if (!kitItems || kitItems.length === 0) return { available: true, unavailableItems: [] };

  const bookedIds = await getBookedItemIds(startDate, endDate, excludeQuoteId);
  const unavailableItems: string[] = [];

  for (const ki of kitItems) {
    if (bookedIds.has(ki.item_id)) {
      const item = (ki.inventory_items as unknown) as { name: string } | null;
      unavailableItems.push(item?.name ?? ki.item_id);
    }
  }

  return {
    available: unavailableItems.length === 0,
    unavailableItems,
  };
}
