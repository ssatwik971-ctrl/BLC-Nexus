/** BLC Nexus logo: the Billionaires Club crest mark with a spaced-out "BLC NEXUS" wordmark. */
export default function Logo({ size = 'md', showWord = true }) {
  const scale = { sm: 0.7, md: 1, lg: 1.7 }[size] || 1;
  return (
    <span className="inline-flex items-center gap-3 leading-none" aria-label="BLC Nexus">
      <img
        src="/crest-mark.png"
        alt=""
        aria-hidden="true"
        width={Math.round(48 * scale)}
        height={Math.round(48 * scale)}
        className="rounded-xl ring-1 ring-gold/50 shadow-glow"
      />
      <span className="flex flex-col items-start">
        <span className="font-display font-extrabold tracking-[0.2em] gold-text" style={{ fontSize: `${1.3 * scale}rem` }}>
          BLC
        </span>
        {showWord && (
          <span
            className="font-display font-semibold text-muted"
            style={{ fontSize: `${0.52 * scale}rem`, letterSpacing: '0.5em', marginTop: 3 * scale }}
          >
            NEXUS
          </span>
        )}
      </span>
    </span>
  );
}
