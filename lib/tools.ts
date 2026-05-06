export const isToolPublished = (tool: { publishedAt: Date | null }) => {
  return !!tool.publishedAt && tool.publishedAt <= new Date();
};
