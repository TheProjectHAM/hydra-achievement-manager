
import React from 'react';

interface IconProps {
  className?: string;
}

const MaterialIcon: React.FC<IconProps & { iconName: string }> = ({ className, iconName }) => (
    <span className={`material-symbols-outlined ${className}`}>
        {iconName}
    </span>
);

export const GameIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="sports_esports" />;
  
export const SearchIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="search" />;

export const SettingsIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="settings" />;

export const ArrowRightIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="arrow_forward" />;

export const PlatinumIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="emoji_events" />;

export const CloseIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="close" />;

export const MinimizeIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="remove" />;

export const MaximizeIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="check_box_outline_blank" />;

export const TrophyIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="emoji_events" />;

export const CheckIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="check" />;

export const LockIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="lock_open" />;

export const ExportIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="upload" />;

export const ApiIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="code" />;

export const LanguageIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="language" />;

export const InfoIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="info" />;

export const SaveIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="save" />;

export const PaletteIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="palette" />;

export const LightModeIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="light_mode" />;

export const DarkModeIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="dark_mode" />;

export const ChevronLeftIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="chevron_left" />;

export const ChevronRightIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="chevron_right" />;

export const MenuIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="menu" />;

export const MenuOpenIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="menu_open" />;

export const EditIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="edit" />;

export const DeleteIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="delete" />;

export const MouseIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="mouse" />;

export const SteamIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="dns" />;

export const HydraIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="alt_route" />;

export const UpdateIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="update" />;

export const TagIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="local_offer" />;

export const FolderIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="folder" />;

export const TextDecreaseIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="text_decrease" />;

export const TextFieldsIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="text_fields" />;

export const TextIncreaseIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="text_increase" />;

export const VisibilityIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="visibility" />;

export const VisibilityOffIcon: React.FC<IconProps> = ({ className }) => <MaterialIcon className={className} iconName="visibility_off" />;


export const GithubIcon: React.FC<IconProps> = ({ className }) => (
    <svg
        className={className}
        viewBox="0 0 16 16"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
);

export const TwitterIcon: React.FC<IconProps> = ({ className }) => (
    <svg
        className={className}
        viewBox="0 0 16 16"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.602.75Zm-1.148 13.125h1.22l-7.48-10.74h-1.353l7.613 10.74Z"/>
    </svg>
);

export const BrazilFlagIcon: React.FC<IconProps> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" aria-hidden="true">
      <rect width="1000" height="700" fill="#009c3b"/>
      <path d="M500 66.5L140 350l360 283.5L860 350z" fill="#ffdf00"/>
      <circle cx="500" cy="350" r="171.5" fill="#002776"/>
    </svg>
);
  
export const UsaFlagIcon: React.FC<IconProps> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 400" aria-hidden="true">
        <path fill="#be123c" d="M0 0h760v400H0z"/>
        <path fill="#fff" d="M0 40h760v40H0zm0 80h760v40H0zm0 80h760v40H0zm0 80h760v40H0z"/>
        <path fill="#0a3161" d="M0 0h395v240H0z"/>
    </svg>
);

export const FranceFlagIcon: React.FC<IconProps> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" aria-hidden="true">
      <rect width="900" height="600" fill="#fff"/>
      <rect width="300" height="600" fill="#002654"/>
      <rect x="600" width="300" height="600" fill="#ce1126"/>
    </svg>
);

export const ItalyFlagIcon: React.FC<IconProps> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1000" aria-hidden="true">
      <rect width="1500" height="1000" fill="#009246"/>
      <rect width="500" height="1000" x="500" fill="#fff"/>
      <rect width="500" height="1000" x="1000" fill="#ce2b37"/>
    </svg>
);

export const ChinaFlagIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 55.2 38.4"
    aria-hidden="true"
  >
    <g>
      <path
        className="st0"
        fill="#DE2910"
        d="M3.01,0h49.17c1.66,0.01,3.01,1.37,3.01,3.03v32.33c0,1.66-1.35,3.02-3.01,3.03L3,38.4
           c-1.65-0.02-3-1.38-3-3.03V3.03C0,1.37,1.35,0.01,3.01,0L3.01,0z"
      />
      <polygon
        className="st1"
        fill="#FFDE00"
        points="8.4,3.84 11.79,14.26 2.92,7.82 13.88,7.82 5.01,14.26 8.4,3.84"
      />
      <polygon
        className="st1"
        fill="#FFDE00"
        points="18.75,2.07 18.43,5.71 16.55,2.58 19.91,4.01 16.35,4.83 18.75,2.07"
      />
      <polygon
        className="st1"
        fill="#FFDE00"
        points="23.22,6.34 21.51,9.57 20.99,5.96 23.54,8.58 19.94,7.95 23.22,6.34"
      />
      <polygon
        className="st1"
        fill="#FFDE00"
        points="23.64,12.78 20.77,15.03 21.77,11.52 23.02,14.95 19.99,12.91 23.64,12.78"
      />
      <polygon
        className="st1"
        fill="#FFDE00"
        points="18.68,15.48 18.51,19.13 16.5,16.08 19.92,17.37 16.4,18.34 18.68,15.48"
      />
    </g>
  </svg>
);


export const JapanFlagIcon: React.FC<IconProps> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" aria-hidden="true">
      <rect width="900" height="600" fill="#fff"/>
      <circle cx="450" cy="300" r="180" fill="#bc002d"/>
    </svg>
);

export const RussiaFlagIcon: React.FC<IconProps> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" aria-hidden="true">
      <rect width="900" height="200" fill="#fff"/>
      <rect width="900" height="200" y="200" fill="#0039a6"/>
      <rect width="900" height="200" y="400" fill="#d52b1e"/>
    </svg>
);

export const UkraineFlagIcon: React.FC<IconProps> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" aria-hidden="true">
      <rect width="1200" height="400" fill="#005bbb"/>
      <rect width="1200" height="400" y="400" fill="#ffd500"/>
    </svg>
);

export const PolandFlagIcon: React.FC<IconProps> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" aria-hidden="true">
      <rect width="1280" height="400" fill="#fff"/>
      <rect width="1280" height="400" y="400" fill="#dc143c"/>
    </svg>
);

export const SpainFlagIcon: React.FC<IconProps> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 500" aria-hidden="true">
      <rect width="750" height="500" fill="#c60b1e"/>
      <rect width="750" height="250" y="125" fill="#ffc400"/>
    </svg>
);
