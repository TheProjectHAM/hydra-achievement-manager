import React, { useState } from "react";
import { DateFormat, TimeFormat } from "../../types";
import { useI18n, Language } from "../../contexts/I18nContext";
import TimeFormatWarningModal from "../TimeFormatWarningModal";
import {
  LanguageOption,
  SegmentedControl,
  SettingsPage,
  SettingsPanel,
  SettingsRow,
  SettingsSection,
} from "./shared";

interface LocaleSettingsProps {
  selectedLanguage: Language;
  setSelectedLanguage: (language: Language) => void;
  selectedDateFormat: DateFormat;
  setSelectedDateFormat: (format: DateFormat) => void;
  selectedTimeFormat: TimeFormat;
  setSelectedTimeFormat: (format: TimeFormat) => void;
  onSave?: (overrides?: Record<string, unknown>) => Promise<void>;
}

const LANGUAGES: { id: Language; name: string; countryCode: string }[] = [
  { id: "en-US", name: "English (US)", countryCode: "US" },
  { id: "pt-BR", name: "Português (BR)", countryCode: "BR" },
  { id: "fr-FR", name: "Français", countryCode: "FR" },
  { id: "it-IT", name: "Italiano", countryCode: "IT" },
  { id: "zh-CN", name: "中文 (简体)", countryCode: "CN" },
  { id: "ja-JP", name: "日本語", countryCode: "JP" },
  { id: "ru-RU", name: "Русский", countryCode: "RU" },
  { id: "uk-UA", name: "Українська", countryCode: "UA" },
  { id: "pl-PL", name: "Polski", countryCode: "PL" },
  { id: "es-ES", name: "Español", countryCode: "ES" },
];

const LocaleSettings: React.FC<LocaleSettingsProps> = ({
  selectedLanguage,
  setSelectedLanguage,
  selectedDateFormat,
  setSelectedDateFormat,
  selectedTimeFormat,
  setSelectedTimeFormat,
  onSave,
}) => {
  const { t } = useI18n();
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [pendingTimeFormat, setPendingTimeFormat] = useState<TimeFormat | null>(
    null,
  );

  const handleTimeFormatChange = (format: TimeFormat) => {
    if (format === selectedTimeFormat) return;
    setPendingTimeFormat(format);
    setIsWarningOpen(true);
  };

  const handleConfirmAndRestart = async () => {
    if (pendingTimeFormat) {
      setSelectedTimeFormat(pendingTimeFormat);
      if (onSave) {
        try {
          await onSave({ timeFormat: pendingTimeFormat });
        } catch (error) {
          console.error("Failed to save before restart:", error);
        }
      }
      window.location.reload();
    }
  };

  const dateExample = (format: DateFormat) => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    if (format === "DD/MM/YYYY") return `${day}/${month}/${year}`;
    if (format === "MM/DD/YYYY") return `${month}/${day}/${year}`;
    return `${year}-${month}-${day}`;
  };

  const timeExample = (format: TimeFormat) => {
    const d = new Date();
    const hour24 = d.getHours();
    const minute = String(d.getMinutes()).padStart(2, "0");
    if (format === "24h") return `${String(hour24).padStart(2, "0")}:${minute}`;
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${minute} ${hour24 >= 12 ? "PM" : "AM"}`;
  };

  return (
    <SettingsPage
      title={t("settings.language.tab")}
      description={t("settings.language.languageDesc")}
    >
      <SettingsSection title={t("settings.language.language")}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {LANGUAGES.map((lang) => (
            <LanguageOption
              key={lang.id}
              name={lang.name}
              countryCode={lang.countryCode}
              selected={selectedLanguage === lang.id}
              onSelect={() => setSelectedLanguage(lang.id)}
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={t("settings.language.dateFormat")}>
        <SettingsPanel>
          <SettingsRow
            label={t("settings.language.dateFormat")}
            description={t("settings.language.dateFormatDesc")}
          >
            <SegmentedControl
              value={selectedDateFormat}
              onChange={setSelectedDateFormat}
              options={[
                {
                  value: "DD/MM/YYYY" as DateFormat,
                  label: dateExample("DD/MM/YYYY"),
                },
                {
                  value: "MM/DD/YYYY" as DateFormat,
                  label: dateExample("MM/DD/YYYY"),
                },
                {
                  value: "YYYY-MM-DD" as DateFormat,
                  label: dateExample("YYYY-MM-DD"),
                },
              ]}
            />
          </SettingsRow>
        </SettingsPanel>
      </SettingsSection>

      <SettingsSection title={t("settings.language.timeFormat")}>
        <SettingsPanel>
          <SettingsRow
            label={t("settings.language.timeFormat")}
            description={t("settings.language.timeFormatDesc")}
          >
            <SegmentedControl
              value={selectedTimeFormat}
              onChange={handleTimeFormatChange}
              options={[
                {
                  value: "24h" as TimeFormat,
                  label: `${t("settings.language.timeFormat24")} · ${timeExample("24h")}`,
                },
                {
                  value: "12h" as TimeFormat,
                  label: `${t("settings.language.timeFormat12")} · ${timeExample("12h")}`,
                },
              ]}
            />
          </SettingsRow>
        </SettingsPanel>
      </SettingsSection>

      <TimeFormatWarningModal
        isOpen={isWarningOpen}
        onClose={() => {
          setPendingTimeFormat(null);
          setIsWarningOpen(false);
        }}
        onSaveAndRestart={handleConfirmAndRestart}
      />
    </SettingsPage>
  );
};

export default LocaleSettings;
