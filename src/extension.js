import Gio from "gi://Gio";
import Shell from "gi://Shell";
import * as AppDisplay from "resource:///org/gnome/shell/ui/appDisplay.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

// Cyrillic to Latin transliteration
const cyrillicToLatinDefault = new Map([
  ["а", "f"],
  ["б", ","],
  ["в", "d"],
  ["г", "u"],
  ["д", "l"],
  ["е", "t"],
  ["ё", "`"],
  ["ж", ";"],
  ["з", "p"],
  ["и", "b"],
  ["й", "q"],
  ["к", "r"],
  ["л", "k"],
  ["м", "v"],
  ["н", "y"],
  ["о", "j"],
  ["п", "g"],
  ["р", "h"],
  ["с", "c"],
  ["т", "n"],
  ["у", "e"],
  ["ы", "s"],
  ["і", "s"],
  ["х", "["],
  ["ф", "a"],
  ["ц", "w"],
  ["ч", "x"],
  ["ш", "i"],
  ["щ", "o"],
  ["ь", "m"],
  ["ъ", "]"],
  ["ї", "]"],
  ["э", "'"],
  ["є", ""],
  ["ю", "."],
  ["я", "z"],
]);

// Default phonetic layout
const phoneticLayoutDefault = new Map([
  ["а", "a"],
  ["б", "b"],
  ["в", "w"],
  ["г", "g"],
  ["д", "d"],
  ["е", "e"],
  ["ё", "#"],
  ["ж", "v"],
  ["з", "z"],
  ["и", "i"],
  ["й", "j"],
  ["к", "k"],
  ["л", "l"],
  ["м", "m"],
  ["н", "n"],
  ["о", "o"],
  ["п", "p"],
  ["р", "r"],
  ["с", "s"],
  ["т", "t"],
  ["у", "u"],
  ["ы", "y"],
  ["х", "h"],
  ["ф", "f"],
  ["ц", "c"],
  ["ч", "="],
  ["ш", "["],
  ["щ", "]"],
  ["ь", "x"],
  ["ъ", "%"],
  ["э", "\\"],
  ["ю", "`"],
  ["я", "q"],
]);

const cyrillicToLatin = new Map(cyrillicToLatinDefault);
const latinToCyrillic = new Map();
const phoneticLayout = new Map(phoneticLayoutDefault);
const phoneticToLatin = new Map();

function generateInvertedDict(sourceMap, destMap) {
  sourceMap.forEach((value, key) => {
    destMap.set(value, key);
  });
}

function transcode(source, transcodeCharMap) {
  source = source.toLowerCase();
  return [...source].map((char) => transcodeCharMap.get(char) || char).join("");
}

let originalGetInitialResultSet = null;

export default class TranscodeAppSearchExtension extends Extension {
  enable() {
    if (originalGetInitialResultSet === null) {
      generateInvertedDict(cyrillicToLatin, latinToCyrillic);
      generateInvertedDict(phoneticLayout, phoneticToLatin);

      this._settings = this.getSettings();
      const settings = this._settings;

      originalGetInitialResultSet =
        AppDisplay.AppSearchProvider.prototype.getInitialResultSet;

      // Make async
      AppDisplay.AppSearchProvider.prototype.getInitialResultSet =
        async function (terms, cancellable) {
          let results = [];

          // await original search GNOME
          let origResults = await originalGetInitialResultSet.call(
            this,
            terms,
            cancellable,
          );
          if (Array.isArray(origResults)) {
            results = origResults;
          }

          let query = terms.join(" ");
          let groups = [];

          if (settings.get_boolean("enable-cyrillic-to-latin")) {
            groups = groups.concat(
              Gio.DesktopAppInfo.search(transcode(query, cyrillicToLatin)) ||
                [],
            );
          }

          if (settings.get_boolean("enable-latin-to-cyrillic")) {
            groups = groups.concat(
              Gio.DesktopAppInfo.search(transcode(query, latinToCyrillic)) ||
                [],
            );
          }

          if (settings.get_boolean("enable-phonetic-layout")) {
            groups = groups.concat(
              Gio.DesktopAppInfo.search(transcode(query, phoneticLayout)) || [],
            );
            groups = groups.concat(
              Gio.DesktopAppInfo.search(transcode(query, phoneticToLatin)) ||
                [],
            );
          }

          let usage = Shell.AppUsage.get_default();
          let extraResults = [];

          groups.forEach(function (group) {
            if (!Array.isArray(group)) return;

            let validApps = group.filter(function (appID) {
              let app = Gio.DesktopAppInfo.new(appID);
              return app && app.should_show();
            });

            extraResults = extraResults.concat(
              validApps.sort(function (a, b) {
                return usage.compare(a, b);
              }),
            );
          });

          let combinedResults = results.concat(extraResults);
          let seen = new Set();

          return combinedResults.filter((appID) => {
            if (seen.has(appID)) {
              return false;
            }
            seen.add(appID);
            return true;
          });
        };
    }
  }

  disable() {
    if (originalGetInitialResultSet !== null) {
      AppDisplay.AppSearchProvider.prototype.getInitialResultSet =
        originalGetInitialResultSet;
      originalGetInitialResultSet = null;
    }
    latinToCyrillic.clear();
    phoneticToLatin.clear();
    this._settings = null;
  }
}
