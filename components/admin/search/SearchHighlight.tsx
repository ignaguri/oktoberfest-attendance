"use client";

export interface SearchHighlightProps {
  text: string;
  searchTerm: string;
  className?: string;
  highlightClassName?: string;
  caseSensitive?: boolean;
}

export function SearchHighlight({
  text,
  searchTerm,
  className,
  highlightClassName = "bg-yellow-200 font-medium",
  caseSensitive = false,
}: SearchHighlightProps) {
  if (!searchTerm.trim()) {
    return <span className={className}>{text}</span>;
  }

  const regex = new RegExp(
    `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    caseSensitive ? "g" : "gi",
  );

  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isMatch = part.match(regex) !== null;
        return (
          <span
            key={index}
            className={isMatch ? highlightClassName : undefined}
          >
            {part}
          </span>
        );
      })}
    </span>
  );
}
