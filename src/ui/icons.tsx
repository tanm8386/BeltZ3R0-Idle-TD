import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 18): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'square' as const,
  strokeLinejoin: 'miter' as const,
  'aria-hidden': true,
});

export const IconMetal = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M12 2.8 20 7v10l-8 4.2L4 17V7l8-4.2Z" />
    <path d="M4 7l8 4.2L20 7M12 11.2v10" opacity=".5" />
  </svg>
);
export const IconCrystal = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M12 2.5 19 9l-7 12.5L5 9l7-6.5Z" />
    <path d="M5 9h14M12 2.5V21.5" opacity=".45" />
  </svg>
);
export const IconTech = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="6" y="6" width="12" height="12" />
    <path d="M9 9h6v6H9z" opacity=".55" />
    <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
  </svg>
);
export const IconEssence = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="m12 2.6 2.6 6.4 6.8.4-5.3 4.3 1.8 6.6-5.9-3.7-5.9 3.7 1.8-6.6L2.6 9.4l6.8-.4L12 2.6Z" />
  </svg>
);
export const IconSettings = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M9.5 3.5h5l1 2.6 2.5 1.4 2.6-.8 2.5 4.3-2 2v2.9l2 2-2.5 4.3-2.6-.8-2.5 1.4-1 2.6h-5l-1-2.6-2.5-1.4-2.6.8-2.5-4.3 2-2v-2.9l-2-2 2.5-4.3 2.6.8 2.5-1.4 1-2.6Z" />
    <circle cx="12" cy="13" r="3.3" />
  </svg>
);
export const IconHelp = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M4 4h16v16H4z" />
    <path d="M9.5 9a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.7v.4" />
    <path d="M12 17.1v.4" />
  </svg>
);
export const IconBuild = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M3 21h18M5 21V9l7-5 7 5v12" />
    <path d="M12 9v8M8 13h8" />
  </svg>
);
export const IconCards = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="7" y="3" width="12" height="16" />
    <path d="M5 6v15h12" opacity=".6" />
    <path d="M10 7h6M10 10h6M10 13h4" opacity=".7" />
  </svg>
);
export const IconCommander = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M12 2.8 15 8l5.8.8-4.2 4.1 1 5.8-5.6-3-5.6 3 1-5.8L3.2 8.8 9 8l3-5.2Z" />
    <path d="M12 9.2v4.2" opacity=".6" />
  </svg>
);
export const IconPrestige = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M20 8.5A8.5 8.5 0 0 0 5.6 6L3 8.5" />
    <path d="M3 4v4.5h4.5" />
    <path d="M4 15.5A8.5 8.5 0 0 0 18.4 18l2.6-2.5" />
    <path d="M21 20v-4.5h-4.5" />
    <path d="M12 8v8M9 11l3-3 3 3" opacity=".6" />
  </svg>
);
export const IconClose = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M5 5l14 14M19 5 5 19" />
  </svg>
);
export const IconRecenter = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="6.5" />
    <path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);
export const IconZoomIn = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.3 15.3 5 5M7.5 10.5h6M10.5 7.5v6" />
  </svg>
);
export const IconZoomOut = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.3 15.3 5 5M7.5 10.5h6" />
  </svg>
);
export const IconLock = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="5" y="10" width="14" height="11" />
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10M12 14v3" />
  </svg>
);
export const IconOrbital = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M12 2v7M9 5l3-3 3 3" />
    <path d="M4 19.5 8 12h8l4 7.5" />
    <path d="M7.5 19.5h9" opacity=".5" />
  </svg>
);
export const IconEmp = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="2.2" />
    <path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9" />
    <path d="M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8" opacity=".55" />
  </svg>
);
export const IconShield = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M12 2.8 20 6v6.5c0 4.4-3.2 7.3-8 8.7-4.8-1.4-8-4.3-8-8.7V6l8-3.2Z" />
    <path d="m8.5 12.2 2.2 2.2 4.8-5" />
  </svg>
);
export const IconChevron = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="m8 5 7 7-7 7" />
  </svg>
);
export const IconClock = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.5l3.5 2" />
  </svg>
);
