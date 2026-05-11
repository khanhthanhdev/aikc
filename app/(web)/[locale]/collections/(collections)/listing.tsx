import { cacheLife, cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { CategoryCard } from "~/components/web/cards/category-card";
import { EmptyList } from "~/components/web/empty-list";
import { findCollections } from "~/server/collections/queries";

const getCollections = async () => {
  "use cache";

  cacheLife("max");
  cacheTag("collections", "tools");

  return await findCollections({});
};

export const CollectionsListing = async () => {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "Collections" });
  const collections = await getCollections();

  return (
    <>
      {collections.map((collection) => (
        <CategoryCard
          category={collection}
          href={`/collections/${collection.slug}`}
          key={collection.id}
        />
      ))}

      {!collections.length && <EmptyList>{t("noCollectionsFound")}</EmptyList>}
    </>
  );
};
