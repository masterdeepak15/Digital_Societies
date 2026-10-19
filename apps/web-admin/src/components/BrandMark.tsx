/**
 * The SpyderEye mark: a spider seen from above whose body is an eye.
 * Legs and ring follow the text colour, so it works on the dark sidebar and on a white page alike.
 * The drawing is the same as brand/spydereye-mark.svg.
 */
export function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" className={className} role="img" aria-label="SpyderEye">
      <g stroke="currentColor" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round">
        <g id="se-legs">
          <polyline points="304,224 346,160 380,150" />
          <polyline points="316,246 396,206 420,214" />
          <polyline points="316,272 398,290 412,318" />
          <polyline points="304,296 350,350 360,382" />
        </g>
        <use href="#se-legs" transform="translate(512 0) scale(-1 1)" />
        <circle cx="256" cy="262" r="60" />
      </g>
      <circle cx="256" cy="262" r="37" fill="#E58F1A" />
      <circle cx="256" cy="262" r="17" fill="#12203B" />
      <circle cx="267" cy="251" r="6" fill="#FFFFFF" />
    </svg>
  )
}
