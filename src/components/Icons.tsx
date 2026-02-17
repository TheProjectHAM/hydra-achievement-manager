
import React from 'react';

interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

const MaterialIcon: React.FC<IconProps & { iconName: string }> = ({ className, style, iconName }) => (
  <span className={`material-symbols-outlined ${className}`} style={style}>
    {iconName}
  </span>
);

export const GameIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="sports_esports" />;
export const SearchIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="search" />;
export const SettingsIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="settings" />;
export const ArrowRightIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="arrow_forward" />;
export const PlatinumIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="emoji_events" />;
export const CloseIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="close" />;
export const MinimizeIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="remove" />;
export const MaximizeIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="fullscreen" />;
export const RestoreIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="fullscreen_exit" />;
export const TrophyIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="emoji_events" />;
export const CheckIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="check" />;
export const LockIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="lock_open" />;
export const ExportIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="upload" />;
export const ApiIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="code" />;
export const LanguageIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="language" />;
export const InfoIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="info" />;
export const SaveIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="save" />;
export const PaletteIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="palette" />;
export const LightModeIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="light_mode" />;
export const DarkModeIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="dark_mode" />;
export const ChevronLeftIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="chevron_left" />;
export const ChevronRightIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="chevron_right" />;
export const MenuIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="menu" />;
export const MenuOpenIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="menu_open" />;
export const EditIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="edit" />;
export const DeleteIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="delete" />;
export const MouseIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="mouse" />;
export const SteamIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="dns" />;
export const HydraIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="alt_route" />;
export const UpdateIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="update" />;
export const BugIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="bug_report" />;

export const SteamBrandIcon: React.FC<IconProps> = (props) => (
  <svg
    {...props}
    viewBox="0 0 32 32"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M18.102 12.129c0-0 0-0 0-0.001 0-1.564 1.268-2.831 2.831-2.831s2.831 1.268 2.831 2.831c0 1.564-1.267 2.831-2.831 2.831-0 0-0 0-0.001 0h0c-0 0-0 0-0.001 0-1.563 0-2.83-1.267-2.83-2.83 0-0 0-0 0-0.001v0zM24.691 12.135c0-2.081-1.687-3.768-3.768-3.768s-3.768 1.687-3.768 3.768c0 2.081 1.687 3.768 3.768 3.768v0c2.080-0.003 3.765-1.688 3.768-3.767v-0zM10.427 23.76l-1.841-0.762c0.524 1.078 1.611 1.808 2.868 1.808 1.317 0 2.448-0.801 2.93-1.943l0.008-0.021c0.155-0.362 0.246-0.784 0.246-1.226 0-1.757-1.424-3.181-3.181-3.181-0.405 0-0.792 0.076-1.148 0.213l0.022-0.007 1.903 0.787c0.852 0.364 1.439 1.196 1.439 2.164 0 1.296-1.051 2.347-2.347 2.347-0.324 0-0.632-0.066-0.913-0.184l0.015 0.006zM15.974 1.004c-7.857 0.001-14.301 6.046-14.938 13.738l-0.004 0.054 8.038 3.322c0.668-0.462 1.495-0.737 2.387-0.737 0.001 0 0.002 0 0.002 0h-0c0.079 0 0.156 0.005 0.235 0.008l3.575-5.176v-0.074c0.003-3.12 2.533-5.648 5.653-5.648 3.122 0 5.653 2.531 5.653 5.653s-2.531 5.653-5.653 5.653h-0.131l-5.094 3.638c0 0.065 0.005 0.131 0.005 0.199 0 0.001 0 0.002 0 0.003 0 2.342-1.899 4.241-4.241 4.241-2.047 0-3.756-1.451-4.153-3.38l-0.005-0.027-5.755-2.383c1.841 6.345 7.601 10.905 14.425 10.905 8.281 0 14.994-6.713 14.994-14.994s-6.713-14.994-14.994-14.994c-0 0-0.001 0-0.001 0h0z" />
  </svg>
);
export const TagIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="local_offer" />;
export const FolderIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="folder" />;
export const TextDecreaseIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="text_decrease" />;
export const TextFieldsIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="text_fields" />;
export const TextIncreaseIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="text_increase" />;
export const VisibilityIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="visibility" />;
export const VisibilityOffIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="visibility_off" />;


export const GithubIcon: React.FC<IconProps> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

export const TwitterIcon: React.FC<IconProps> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.602.75Zm-1.148 13.125h1.22l-7.48-10.74h-1.353l7.613 10.74Z" />
  </svg>
);

export const BrazilFlagIcon: React.FC<IconProps> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" aria-hidden="true">
    <rect width="1000" height="700" fill="#009c3b" />
    <path d="M500 66.5L140 350l360 283.5L860 350z" fill="#ffdf00" />
    <circle cx="500" cy="350" r="171.5" fill="#002776" />
  </svg>
);

export const UsaFlagIcon: React.FC<IconProps> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 400" aria-hidden="true">
    <path fill="#be123c" d="M0 0h760v400H0z" />
    <path fill="#fff" d="M0 40h760v40H0zm0 80h760v40H0zm0 80h760v40H0zm0 80h760v40H0z" />
    <path fill="#0a3161" d="M0 0h395v240H0z" />
  </svg>
);

export const FranceFlagIcon: React.FC<IconProps> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" aria-hidden="true">
    <rect width="900" height="600" fill="#fff" />
    <rect width="300" height="600" fill="#002654" />
    <rect x="600" width="300" height="600" fill="#ce1126" />
  </svg>
);

export const ItalyFlagIcon: React.FC<IconProps> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1000" aria-hidden="true">
    <rect width="1500" height="1000" fill="#009246" />
    <rect width="500" height="1000" x="500" fill="#fff" />
    <rect width="500" height="1000" x="1000" fill="#ce2b37" />
  </svg>
);

export const ChinaFlagIcon: React.FC<IconProps> = (props) => (
  <svg
    {...props}
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


export const JapanFlagIcon: React.FC<IconProps> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" aria-hidden="true">
    <rect width="900" height="600" fill="#fff" />
    <circle cx="450" cy="300" r="180" fill="#bc002d" />
  </svg>
);

export const RussiaFlagIcon: React.FC<IconProps> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" aria-hidden="true">
    <rect width="900" height="200" fill="#fff" />
    <rect width="900" height="200" y="200" fill="#0039a6" />
    <rect width="900" height="200" y="400" fill="#d52b1e" />
  </svg>
);

export const UkraineFlagIcon: React.FC<IconProps> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" aria-hidden="true">
    <rect width="1200" height="400" fill="#005bbb" />
    <rect width="1200" height="400" y="400" fill="#ffd500" />
  </svg>
);

export const PolandFlagIcon: React.FC<IconProps> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" aria-hidden="true">
    <rect width="1280" height="400" fill="#fff" />
    <rect width="1280" height="400" y="400" fill="#dc143c" />
  </svg>
);

export const SpainFlagIcon: React.FC<IconProps> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 500" aria-hidden="true">
    <rect width="750" height="500" fill="#c60b1e" />
    <rect width="750" height="250" y="125" fill="#ffc400" />
  </svg>
);

export const GridViewIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="grid_view" />;

export const ListViewIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="view_list" />;
export const PowerIcon: React.FC<IconProps> = (props) => <MaterialIcon {...props} iconName="power_settings_new" />;
