import { cacheLife, cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { CategoryCard } from "~/components/web/cards/category-card";
import { EmptyList } from "~/components/web/empty-list";
import { findCategories } from "~/server/categories/queries";

const getCategories = async () => {
  "use cache";

  cacheLife("max");
  cacheTag("categories", "tools");

  return await findCategories({});
};

export const CategoriesListing = async () => {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "Categories" });
  const categories = await getCategories();

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
