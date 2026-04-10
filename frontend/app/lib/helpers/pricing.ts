// Discount Percent Function
export function getDiscountPercent(
  salePrice: number | null | undefined,
  regularPrice: number | null | undefined
): number | null {
  if (salePrice == null || regularPrice == null || regularPrice <= 0) return null;
  return Math.round((1 - salePrice / regularPrice) * 100);
}
