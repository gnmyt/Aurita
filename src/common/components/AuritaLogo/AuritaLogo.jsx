export const AuritaLogo = ({size = 28}) => {
    return (
        <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-label="Aurita">
            <defs>
                <linearGradient id="au-grad" gradientUnits="userSpaceOnUse" x1="120" y1="120" x2="420" y2="420">
                    <stop offset="0" stopColor="#F25CA8"/>
                    <stop offset="1" stopColor="#6C3BE0"/>
                </linearGradient>
            </defs>
            <g fill="url(#au-grad)" stroke="url(#au-grad)">
                <path
                    stroke="none"
                    d="M88 262 C88 142 162 72 256 72 C350 72 424 142 424 262
             C424 284 402 292 382 284 C361 276 341 276 320 284 C299 292 277 292 256 284
             C235 276 213 276 192 284 C171 292 151 292 130 284 C109 276 88 276 88 262 Z"
                />
                <g fill="none" strokeWidth="30" strokeLinecap="round">
                    <path d="M196 332 C184 372 208 396 192 440"/>
                    <path d="M316 332 C328 372 304 396 320 440"/>
                </g>
            </g>
        </svg>
    );
}
