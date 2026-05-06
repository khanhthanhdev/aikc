import type { Thing, WithContext } from "schema-dts";

interface JsonLdProps<T extends Thing> {
  data: WithContext<T>;
  key?: string;
}

export function JsonLd<T extends Thing>({ data, key }: JsonLdProps<T>) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data, null, 0),
      }}
      key={key}
      type="application/ld+json"
    />
  );
}
