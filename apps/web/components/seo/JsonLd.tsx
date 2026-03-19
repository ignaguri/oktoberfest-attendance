export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data)
          .replace(/<\/(script)/gi, "\\u003C/$1")
          .replace(/<!--/g, "\\u003C!--"),
      }}
    />
  );
}
