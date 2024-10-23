import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
// noinspection JSFileReferences
import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';

let originalGetInitialResultSet = null;

const cyrillicToLatin = new Map([
    ['а', 'f'],
    ['б', ','],
    ['в', 'd'],
    ['г', 'u'],
    ['д', 'l'],
    ['е', 't'],
    ['ё', '`'],
    ['ж', ';'],
    ['з', 'p'],
    ['и', 'b'],
    ['й', 'q'],
    ['к', 'r'],
    ['л', 'k'],
    ['м', 'v'],
    ['н', 'y'],
    ['о', 'j'],
    ['п', 'g'],
    ['р', 'h'],
    ['с', 'c'],
    ['т', 'n'],
    ['у', 'e'],
    ['ы', 's'],
    ['і', 's'],
    ['х', '['],
    ['ф', 'a'],
    ['ц', 'w'],
    ['ч', 'x'],
    ['ш', 'i'],
    ['щ', 'o'],
    ['ь', 'm'],
    ['ъ', ']'],
    ['ї', ']'],
    ['э', ''],
    ['є', ''],
    ['ю', '.'],
    ['я', 'z']
]);

const latinToCyrillic = new Map();

function generateInvertedDict(sourceMap, destMap) {
    sourceMap.forEach((value, key) => {
        destMap.set(value, key);
    });
}

function transcode(source, transcodeCharMap) {
    source = source.toLowerCase();
    return [...source].map(char => transcodeCharMap.get(char) || char).join('');
}

function getResultSet(terms) {
    let query = terms.join(' ');
    let groups = [];
    const systemCommands = ['restart', 'poweroff', 'shutdown', 'reboot', 'logout'];

    if (systemCommands.includes(query.toLowerCase())) {
        return originalGetInitialResultSet.call(AppDisplay.AppSearchProvider, terms);
    }
    try {
        groups = Gio.DesktopAppInfo.search(query);
        groups = groups.concat(Gio.DesktopAppInfo.search(transcode(query, cyrillicToLatin)));
        groups = groups.concat(Gio.DesktopAppInfo.search(transcode(query, latinToCyrillic)));
    } catch (error) {
        console.error("An error occurred while searching:", error);
    }

    let usage = Shell.AppUsage.get_default();
    let results = [];
    groups.forEach(function (group) {
        group = group.filter(function (appID) {
            let app = Gio.DesktopAppInfo.new(appID);
            return app && app.should_show();
        });
        results = results.concat(group.sort(function (a, b) {
            return usage.compare(a, b);
        }));
    });
    return results;
}

export default class TranscodeAppSearchExtension {
    enable() {
        if (originalGetInitialResultSet === null) {
            generateInvertedDict(cyrillicToLatin, latinToCyrillic);
            originalGetInitialResultSet = AppDisplay.AppSearchProvider.prototype.getInitialResultSet;
            AppDisplay.AppSearchProvider.prototype.getInitialResultSet = getResultSet;
        }
    }

    disable() {
        if (originalGetInitialResultSet !== null) {
            AppDisplay.AppSearchProvider.prototype.getInitialResultSet = originalGetInitialResultSet;
            originalGetInitialResultSet = null;
        }
    }
}
