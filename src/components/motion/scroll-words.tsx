/**
 * A big sentence whose words light up one by one as it scrolls into view.
 * Works without JavaScript (fully lit); screen readers read the plain sentence.
 */
export function ScrollWords({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <p data-scroll="enter" className={className} style={{ "--n": words.length } as React.CSSProperties}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, i) => (
          <span key={i} className="light-word" style={{ "--w": i } as React.CSSProperties}>
            {word}{" "}
          </span>
        ))}
      </span>
    </p>
  );
}
