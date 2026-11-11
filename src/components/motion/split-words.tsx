/** Headline whose words rise into view one after another. Screen readers get the plain sentence. */
export function SplitWords({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, i) => (
          <span key={i}>
            <span className="split-word">
              <span style={{ "--w": i } as React.CSSProperties}>{word}</span>
            </span>
            {i < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </>
  );
}
