import { getCategories } from "@/lib/queries";
import { CategoryList } from "./category-list";

export default async function CategoriasPage() {
  const categories = await getCategories({ includeHidden: true });

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold lg:text-2xl">Categorías</h1>
        <p className="text-sm text-muted-foreground">
          Predefinidas y personalizadas · {categories.length} en total
        </p>
      </header>

      <CategoryList categories={categories} />
    </div>
  );
}
