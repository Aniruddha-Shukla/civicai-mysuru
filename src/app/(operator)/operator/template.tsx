/** Re-mounts on every navigation, so each page glides in instead of popping. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-in fade-in-0 slide-in-from-bottom-3 duration-500 ease-out motion-reduce:animate-none">{children}</div>;
}
