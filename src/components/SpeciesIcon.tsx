import type { SpeciesId } from '../types/game';

interface SpeciesIconProps {
  species: SpeciesId;
  exotic?: boolean;
  className?: string;
}

export function SpeciesIcon({ species, exotic = false, className = 'w-6 h-6' }: SpeciesIconProps) {
  if (species === 'raccoon') {
    const coat = exotic ? '#D999A8' : '#7D7A76';
    const mask = exotic ? '#4B2938' : '#2A2726';
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
        <path d="M7 13L11 5L16 11H20L25 5L29 13C30.5 16 30.5 22 27 26C24 29 21 30 18 30C15 30 12 29 9 26C5.5 22 5.5 16 7 13Z" fill={coat} />
        <ellipse cx="12.5" cy="18.5" rx="4.5" ry="3.2" fill={mask} />
        <ellipse cx="23.5" cy="18.5" rx="4.5" ry="3.2" fill={mask} />
        <circle cx="12.8" cy="18.2" r="1.4" fill="#FAF6EE" />
        <circle cx="23.2" cy="18.2" r="1.4" fill="#FAF6EE" />
        <path d="M14 23.5C15.5 21.5 20.5 21.5 22 23.5L18 28.5L14 23.5Z" fill="#EFEAE2" />
        <circle cx="18" cy="24.2" r="2" fill="#1C1918" />
      </svg>
    );
  }

  if (species === 'gorilla') {
    const coat = exotic ? '#56412E' : '#32363C';
    const crown = exotic ? '#D9A84E' : '#9AA3AE';
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
        <circle cx="7.5" cy="18" r="3.5" fill="#26292E" />
        <circle cx="28.5" cy="18" r="3.5" fill="#26292E" />
        <rect x="8.5" y="7" width="19" height="22" rx="9" fill={coat} />
        <path d="M12 10.5C14 8 22 8 24 10.5" stroke={crown} strokeWidth="3" strokeLinecap="round" />
        <rect x="11" y="14" width="14" height="4.2" rx="2" fill="#212428" />
        <circle cx="14.5" cy="16.5" r="1.3" fill="#F4EFE6" />
        <circle cx="21.5" cy="16.5" r="1.3" fill="#F4EFE6" />
        <ellipse cx="18" cy="23.2" rx="5.5" ry="4.2" fill="#464A50" />
        <circle cx="16.2" cy="22.4" r="1" fill="#1D1F22" />
        <circle cx="19.8" cy="22.4" r="1" fill="#1D1F22" />
      </svg>
    );
  }

  if (species === 'butterfly') {
    const wing = exotic ? '#2394EB' : '#EE8624';
    const rim = exotic ? '#142A54' : '#241B15';
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
        <path d="M17 17C12 8 4 8 4 15C4 19 8 21 13 20C9 23 8 28 13 28C16 28 17 24 17 20Z" fill={wing} stroke={rim} strokeWidth="1.8" />
        <path d="M19 17C24 8 32 8 32 15C32 19 28 21 23 20C27 23 28 28 23 28C20 28 19 24 19 20Z" fill={wing} stroke={rim} strokeWidth="1.8" />
        <rect x="16.8" y="12" width="2.4" height="14" rx="1.2" fill={rim} />
        <path d="M17 12L14 8M19 12L22 8" stroke={rim} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (species === 'red_panda') {
    const fur = exotic ? '#F29A2E' : '#C44522';
    const earRim = '#FAF4E8';
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
        <circle cx="10" cy="10" r="4.5" fill={earRim} />
        <circle cx="26" cy="10" r="4.5" fill={earRim} />
        <circle cx="10" cy="10.5" r="2.8" fill={fur} />
        <circle cx="26" cy="10.5" r="2.8" fill={fur} />
        <ellipse cx="18" cy="19.5" rx="11.5" ry="10" fill={fur} />
        <ellipse cx="11.5" cy="21" rx="4.2" ry="3.2" fill={earRim} />
        <ellipse cx="24.5" cy="21" rx="4.2" ry="3.2" fill={earRim} />
        <circle cx="13.5" cy="17.2" r="1.5" fill="#231915" />
        <circle cx="22.5" cy="17.2" r="1.5" fill="#231915" />
        <ellipse cx="18" cy="23.2" rx="4.2" ry="3.2" fill={earRim} />
        <circle cx="18" cy="22.2" r="1.8" fill="#231915" />
      </svg>
    );
  }

  if (species === 'golden_fox') {
    const fur = exotic ? '#F5C445' : '#D96F24';
    const cheek = '#FCF7EC';
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
        <path d="M8 14L10 4L16 11H20L26 4L28 14L30 20L18 30L6 20L8 14Z" fill={fur} />
        <path d="M9 12L10.5 6.5L14 11Z" fill="#3D2618" />
        <path d="M27 12L25.5 6.5L22 11Z" fill="#3D2618" />
        <path d="M7.5 20L14 19L18 29.5L7.5 20Z" fill={cheek} />
        <path d="M28.5 20L22 19L18 29.5L28.5 20Z" fill={cheek} />
        <circle cx="13.5" cy="17.5" r="1.5" fill={exotic ? '#3B7DE8' : '#241B14'} />
        <circle cx="22.5" cy="17.5" r="1.5" fill={exotic ? '#3B7DE8' : '#241B14'} />
        <circle cx="18" cy="25.5" r="2.1" fill="#1F1A17" />
      </svg>
    );
  }

  if (species === 'snow_leopard') {
    const fur = exotic ? '#E3F0FA' : '#C6CFD8';
    const spot = exotic ? '#7CA6CC' : '#5F6C7A';
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
        <circle cx="10.5" cy="11" r="3.8" fill={fur} />
        <circle cx="25.5" cy="11" r="3.8" fill={fur} />
        <ellipse cx="18" cy="19.5" rx="11.2" ry="9.8" fill={fur} />
        <circle cx="12.5" cy="13.5" r="1.3" fill={spot} />
        <circle cx="23.5" cy="13.5" r="1.3" fill={spot} />
        <circle cx="18" cy="12" r="1.4" fill={spot} />
        <circle cx="10" cy="20" r="1.3" fill={spot} />
        <circle cx="26" cy="20" r="1.3" fill={spot} />
        <circle cx="13.6" cy="18.2" r="1.6" fill="#4BA3C7" />
        <circle cx="22.4" cy="18.2" r="1.6" fill="#4BA3C7" />
        <ellipse cx="18" cy="23.6" rx="4.4" ry="3.2" fill="#F6FAFD" />
        <path d="M16 22H20L18 24.4L16 22Z" fill="#46515C" />
      </svg>
    );
  }

  if (species === 'river_otter') {
    const fur = exotic ? '#88B1CA' : '#735844';
    const muzzle = exotic ? '#DFEEF7' : '#D9C6B2';
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
        <circle cx="9.5" cy="13" r="3.2" fill={fur} />
        <circle cx="26.5" cy="13" r="3.2" fill={fur} />
        <ellipse cx="18" cy="19.5" rx="11.5" ry="9.5" fill={fur} />
        <ellipse cx="18" cy="22.5" rx="6.8" ry="4.8" fill={muzzle} />
        <circle cx="13.2" cy="16.8" r="1.5" fill="#1F1915" />
        <circle cx="22.8" cy="16.8" r="1.5" fill="#1F1915" />
        <ellipse cx="18" cy="20.8" rx="2.6" ry="1.8" fill="#2A201A" />
        <path d="M10.5 22H14M22 22H25.5" stroke="#5A4535" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (species === 'tree_frog') {
    const body = exotic ? '#2A9BF0' : '#4BC45E';
    const belly = exotic ? '#FFE169' : '#D9F5B8';
    const cheek = exotic ? '#FF87A2' : '#FF94A8';
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
        <circle cx="11" cy="11.5" r="5" fill={body} />
        <circle cx="25" cy="11.5" r="5" fill={body} />
        <ellipse cx="18" cy="21" rx="12" ry="9.2" fill={body} />
        <ellipse cx="18" cy="25" rx="8.2" ry="4.5" fill={belly} />
        <circle cx="11" cy="11.5" r="3" fill="#FFFDF7" />
        <circle cx="25" cy="11.5" r="3" fill="#FFFDF7" />
        <circle cx="11.2" cy="11.5" r="1.8" fill="#1C1918" />
        <circle cx="24.8" cy="11.5" r="1.8" fill="#1C1918" />
        <circle cx="10.4" cy="10.7" r="0.7" fill="#FFFFFF" />
        <circle cx="24" cy="10.7" r="0.7" fill="#FFFFFF" />
        <ellipse cx="9.8" cy="19.5" rx="2.3" ry="1.4" fill={cheek} opacity="0.85" />
        <ellipse cx="26.2" cy="19.5" rx="2.3" ry="1.4" fill={cheek} opacity="0.85" />
        <path d="M13 21.5C15 24 21 24 23 21.5" stroke="#1E4A28" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (species === 'chameleon') {
    const main = exotic ? '#C56BF0' : '#49C26A';
    const stripe = exotic ? '#52E0D4' : '#2C8C5B';
    const crest = exotic ? '#FF9AD5' : '#7EE070';
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
        <path d="M11 11C13 5 21 5 24 10L28 18C29 23 25 28 19 28H14C9 28 7 24 8 19L11 11Z" fill={main} />
        <path d="M12 10C15 6.5 21 6.5 23 10.5" stroke={crest} strokeWidth="3.2" strokeLinecap="round" />
        <path d="M12 18H16M11 22H16" stroke={stripe} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="21.5" cy="16.5" r="4.3" fill={stripe} />
        <circle cx="21.5" cy="16.5" r="2.7" fill="#FFFDF7" />
        <circle cx="22" cy="16.5" r="1.5" fill="#1E1918" />
        <circle cx="21.2" cy="15.8" r="0.6" fill="#FFFFFF" />
        <path d="M19 23.5C22 23.8 25 23.2 27 22" stroke="#224C34" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (species === 'giant_tortoise') {
    const skin = exotic ? '#9FD9BE' : '#7FA354';
    const shell = exotic ? '#E3B044' : '#8C5B34';
    const rim = exotic ? '#FFF0B8' : '#C99B63';
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
        <path d="M6 22C6 12.5 11.5 8 18 8C24.5 8 30 12.5 30 22H6Z" fill={shell} />
        <path d="M12 12L18 9.5L24 12L23 19H13L12 12Z" fill={rim} opacity="0.45" />
        <rect x="5" y="20.5" width="26" height="3.5" rx="1.7" fill={rim} />
        <circle cx="27" cy="23.5" r="5" fill={skin} />
        <circle cx="28.5" cy="22.4" r="1.4" fill="#1E1917" />
        <circle cx="28" cy="21.9" r="0.5" fill="#FFFFFF" />
        <rect x="9.5" y="23.5" width="4.2" height="5.5" rx="2" fill={skin} />
        <rect x="19" y="23.5" width="4.2" height="5.5" rx="2" fill={skin} />
      </svg>
    );
  }

  if (species === 'bearded_dragon') {
    const body = exotic ? '#FF7A42' : '#E3A45B';
    const ruff = exotic ? '#FFD159' : '#B86A2E';
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
        <path d="M6 17L10 12L14 14L18 11L22 14L26 12L30 17L27 24L18 29L9 24L6 17Z" fill={ruff} />
        <path d="M9 15C11 9.5 25 9.5 27 15C28 19.5 24 25.5 18 26.5C12 25.5 8 19.5 9 15Z" fill={body} />
        <circle cx="13.5" cy="16.5" r="2.1" fill="#F5B82E" />
        <circle cx="22.5" cy="16.5" r="2.1" fill="#F5B82E" />
        <circle cx="13.5" cy="16.5" r="1.2" fill="#1F1814" />
        <circle cx="22.5" cy="16.5" r="1.2" fill="#1F1814" />
        <circle cx="13" cy="16" r="0.5" fill="#FFFFFF" />
        <circle cx="22" cy="16" r="0.5" fill="#FFFFFF" />
        <path d="M13.5 22C15.5 23.6 20.5 23.6 22.5 22" stroke="#6B3A18" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  // Wolf
  const fur = exotic ? '#D9E8F6' : '#77818A';
  const dark = exotic ? '#8EB2D4' : '#4A535C';
  return (
    <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
      <path d="M9 15L10.5 5.5L16 11.5H20L25.5 5.5L27 15L29 21L18 30.5L7 21L9 15Z" fill={fur} />
      <path d="M11 12L18 9L25 12L22 18H14L11 12Z" fill={dark} />
      <circle cx="13.8" cy="18" r="1.5" fill={exotic ? '#2DA9E6' : '#E5A12D'} />
      <circle cx="22.2" cy="18" r="1.5" fill={exotic ? '#2DA9E6' : '#E5A12D'} />
      <path d="M14.5 22L18 29L21.5 22H14.5Z" fill="#F2EFEA" />
      <circle cx="18" cy="24.2" r="2" fill="#1C2024" />
    </svg>
  );
}
