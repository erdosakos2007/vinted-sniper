export const vintedCategories = [
  { id: "all", label: "All categories", path: "/catalog" },
  { id: "sweaters", label: "Sweaters", path: "/catalog/267-hoodies-and-sweaters" },
  { id: "outerwear", label: "Jackets", path: "/catalog/581-outerwear" },
  { id: "shoes", label: "Shoes", path: "/catalog/1231-papoutsia" },
  { id: "trousers", label: "Trousers", path: "/catalog/1820-chinot" },
  { id: "sportswear", label: "Tracksuits", path: "/catalog/1821-joggers-sweatpants" },
];

export function makeVintedSearch(query: string, categoryId = "all") {
  const category = vintedCategories.find((item) => item.id === categoryId) || vintedCategories[0];
  const url = new URL(`https://www.vinted.hu${category.path}`);
  if (query.trim()) url.searchParams.set("search_text", query.trim());
  url.searchParams.set("order", "newest_first");
  return url.toString();
}
