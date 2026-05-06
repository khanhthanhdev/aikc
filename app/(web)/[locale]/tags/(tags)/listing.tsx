import { getLocale, getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { TagCard } from "~/components/web/cards/tag-card";
import { EmptyList } from "~/components/web/empty-list";
import { Pagination } from "~/components/web/pagination";
import { countTags, findTags } from "~/server/tags/queries";
import { searchParamsCache } from "~/server/tags/search-params";

interface TagsListingProps {
  searchParams: Promise<SearchParams>;
}

export const TagsListing = async ({ searchParams }: TagsListingProps) => {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "Tags" });
  const params = await searchParams;
  const { page, perPage } = searchParamsCache.parse({
    perPage: "96",
    ...params,
  });

  const skip = (page - 1) * perPage;
  const take = perPage;

  const [tags, totalCount] = await Promise.all([
    findTags({ skip, take }),
    countTags({}),
  ]);

  return (
    <>
      {tags.map((tag) => (
        <TagCard key={tag.id} tag={tag} />
      ))}

      {!tags.length && <EmptyList>{t("noTagsFound")}</EmptyList>}

      <Pagination
        className="col-span-full mt-4"
        pageSize={perPage}
        totalCount={totalCount}
      />
    </>
  );
};
