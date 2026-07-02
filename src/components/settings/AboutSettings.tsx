import React from "react";
import { GithubIcon, TwitterIcon } from "../Icons";
import { useI18n } from "../../contexts/I18nContext";
import packageJson from "../../../package.json";
import { Button } from "@/components/ui/button";
import {
  SettingsPage,
  SettingsPanel,
  SettingsRow,
  SettingsSection,
} from "./shared";

const openExternal = (url: string) => {
  const w = window as Window & {
    electronAPI?: { openExternal: (url: string) => void };
  };
  if (w.electronAPI?.openExternal) {
    w.electronAPI.openExternal(url);
  } else {
    window.open(url, "_blank");
  }
};

const CreatorCard: React.FC<{
  name: string;
  role: string;
  imageUrl: string;
  githubLink: string;
  twitterLink: string;
}> = ({ name, role, imageUrl, githubLink, twitterLink }) => (
  <div className="flex items-center justify-between gap-4 px-4 py-4">
    <div className="flex min-w-0 items-center gap-3">
      <img
        src={imageUrl}
        alt={name}
        className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-border"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{role}</p>
      </div>
    </div>
    <div className="flex shrink-0 gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => openExternal(githubLink)}
        title="GitHub"
      >
        <GithubIcon className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => openExternal(twitterLink)}
        title="Twitter"
      >
        <TwitterIcon className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

const AboutSettings: React.FC = () => {
  const { t } = useI18n();
  const currentVersionLabel = `v${packageJson.version}${packageJson.versionDateTag ? ` ${packageJson.versionDateTag}` : ""}`;

  const TRANSLATORS = [
    {
      name: "SterTheStar",
      language: "Global",
      countryCode: "US",
      link: "https://github.com/SterTheStar",
    },
    {
      name: "lilithmki",
      language: "Italian",
      countryCode: "IT",
      link: "https://github.com/lilithmki",
    },
  ];

  return (
    <SettingsPage
      title={t("settings.about.tab")}
      description={t("settings.about.footerRights")}
    >
      <SettingsPanel>
        <SettingsRow
          label={t("settings.about.appBuild")}
          description={t("settings.about.stableRelease")}
        >
          <span className="text-sm font-medium text-foreground">
            {currentVersionLabel}
          </span>
        </SettingsRow>
        <SettingsRow
          label={t("settings.about.legalLicense")}
          description="GNU General Public License v3"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              openExternal("https://www.gnu.org/licenses/gpl-3.0.en.html")
            }
          >
            LICENSE
          </Button>
        </SettingsRow>
      </SettingsPanel>

      <SettingsSection title={t("settings.about.creators")}>
        <SettingsPanel>
          <CreatorCard
            name="Esther"
            role={t("settings.about.mainDeveloper")}
            githubLink="https://github.com/SterTheStar"
            twitterLink="https://x.com/onlysterbr"
            imageUrl="https://avatars.githubusercontent.com/u/151816213?v=4"
          />
          <CreatorCard
            name="Levynsk"
            role={t("settings.about.mainDeveloper")}
            githubLink="https://github.com/Levynsk/"
            twitterLink="https://x.com/Levynskshy"
            imageUrl="https://avatars.githubusercontent.com/u/199530525?v=4"
          />
        </SettingsPanel>
      </SettingsSection>

      <SettingsSection title={t("settings.about.translators")}>
        <SettingsPanel>
          {TRANSLATORS.map((translator) => (
            <div
              key={translator.name}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <button
                type="button"
                onClick={() => openExternal(translator.link)}
                className="text-sm font-medium text-foreground hover:underline"
              >
                {translator.name}
              </button>
              <div className="flex items-center gap-2">
                <img
                  src={`${import.meta.env.VITE_FLAGS_API_URL || "https://flagsapi.com"}/${translator.countryCode}/flat/64.png`}
                  alt=""
                  className="h-4 w-6 rounded-sm object-cover"
                />
                <span className="text-xs text-muted-foreground">
                  {translator.language}
                </span>
              </div>
            </div>
          ))}
        </SettingsPanel>
      </SettingsSection>

      <div className="flex items-center justify-between gap-4 pt-2">
        <p className="text-xs text-muted-foreground">
          {t("settings.about.footerRights")}
        </p>
        <Button
          onClick={() =>
            openExternal("https://github.com/Levynsk/hydra-achievement-manager")
          }
        >
          <GithubIcon className="h-4 w-4" />
          {t("settings.about.buildRepository")}
        </Button>
      </div>
    </SettingsPage>
  );
};

export default AboutSettings;
