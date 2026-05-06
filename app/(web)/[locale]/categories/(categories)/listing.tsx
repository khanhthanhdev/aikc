import { getLocale, getTranslations } from "next-intl/server";
import { CategoryCard } from "~/components/web/cards/category-card";
import { EmptyList } from "~/components/web/empty-list";
import { findCategories } from "~/server/categories/queries";

export const CategoriesListing = async () => {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "Categories" });
  const categories = await findCategories({});

  return (
    <>
      {categories.map((category) => (
        <CategoryCard
          category={category}
          href={`/categories/${category.slug}`}
          key={category.id}
        />
      ))}

      {!categories.length && <EmptyList>{t("noCategoriesFound")}</EmptyList>}
    </>
  );
};
