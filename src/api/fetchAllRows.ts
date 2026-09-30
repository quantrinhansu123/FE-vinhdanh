/**
 * Fetch all rows from a PostgREST query in bounded pages. Supabase's API
 * commonly caps each response at 1,000 rows, so increasing `.limit()` alone
 * does not reliably return the rest of a table.
 */
export async function fetchAllRows<T>(query: any, pageSize = 1000): Promise<{ data: T[] | null; error: any }> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) return { data: null, error };

    const batch = (data || []) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return { data: rows, error: null };
}
