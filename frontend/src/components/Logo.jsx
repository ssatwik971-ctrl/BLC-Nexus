/** BLC Nexus logo: crown + diamond monogram with a spaced-out "NEXUS" wordmark. */
export default function Logo({ size = 'md', showWord = true }) {
  const scale = { sm: 0.7, md: 1, lg: 1.7 }[size] || 1;
  return (
    <span className="inline-flex flex-col items-center leading-none" aria-label="BLC Nexus">
      <svg width={56 * scale} height={34 * scale} viewBox="0 0 56 34" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="blc-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f2d675" />
            <stop offset="1" stopColor="#c99a1b" />
          </linearGradient>
        </defs>
        {/* crown */}
        <path d="M4 14l9 7 15-17 15 17 9-7-5 17H9z" fill="url(#blc-gold)" />
        {/* diamond */}
        <path d="M28 27l-5-5 5-7 5 7z" fill="#0b1530" />
        <circle cx="4" cy="12" r="2.2" fill="url(#blc-gold)" />
        <circle cx="52" cy="12" r="2.2" fill="url(#blc-gold)" />
        <circle cx="28" cy="3" r="2.2" fill="url(#blc-gold)" />
      </svg>
      <span
        className="font-display font-extrabold tracking-[0.18em] gold-text"
        style={{ fontSize: `${1.35 * scale}rem`, marginTop: 2 * scale }}
      >
        BLC
      </span>
      {showWord && (
        <span
          className="font-display font-semibold text-muted"
          style={{ fontSize: `${0.55 * scale}rem`, letterSpacing: '0.55em', marginTop: 2 * scale, paddingLeft: '0.55em' }}
        >
          NEXUS
        </span>
      )}
    </span>
  );
}
