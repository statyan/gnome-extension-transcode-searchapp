const Gio = imports.gi.Gio;
const Shell = imports.gi.Shell;
const AppDisplay = imports.ui.appDisplay;

// Get Gnome-shell version
const Config = imports.misc.config;
const [major, minor] = Config.PACKAGE_VERSION.split('.').map(s => Number(s));

var originalGetInitialResultSet = null;


const TrancodeRusToEngDict = {
    'а': 'f',
    'б': ',',
    'в': 'd',
    'г': 'u',
    'д': 'l',
    'е': 't',
    'ё': '`',
    'ж': ';',
    'з': 'p',
    'и': 'b',
    'й': 'q',
    'к': 'r',
    'л': 'k',
    'м': 'v',
    'н': 'y',
    'о': 'j',
    'п': 'g',
    'р': 'h',
    'с': 'c',
    'т': 'n',
    'у': 'e',
    'ы': 's',
    'х': '[',
    'ф': 'a',
    'ц': 'w',
    'ч': 'x',
    'ш': 'i',
    'щ': 'o',
    'ь': 'm',
    'ъ': ']',
    'э': '',
    'ю': '.',
    'я': 'z'
}

const TrancodeEngToRusDict = {};

function generateIvertedDict(sourceDict, destDict) {
    for(let sourceindex in sourceDict)  {
        destDict[sourceDict[sourceindex]] = sourceindex;
    }
}

function transcode(source, dict) {
    source = source.toLowerCase();
    let result = '';
    for (let i = 0; i < source.length; i++) {
        let char = source.charAt(i);
        let foundChar = dict[char];
        if (!foundChar) {
            foundChar = char;
        }
        result = result + foundChar;
    }
    return result;
}

function getResultSet(terms, callback, cancellable) {
    let query = terms.join(' ');
    let groups = Gio.DesktopAppInfo.search(query);
    groups = groups.concat(Gio.DesktopAppInfo.search(transcode(query, TrancodeRusToEngDict)));
    groups = groups.concat(Gio.DesktopAppInfo.search(transcode(query, TrancodeEngToRusDict)));
    let usage = Shell.AppUsage.get_default();
    let results = [];
    groups.forEach(function(group) {
        group = group.filter(function(appID) {
            let app = Gio.DesktopAppInfo.new(appID);
            return app && app.should_show();
        });
        results = results.concat(group.sort(function(a, b) {
            if (major >= 44)
                return usage.compare(a, b);
            else
                return usage.compare('', a, b);
        }));
    });
    if (major >= 43)
        return results;
    else
        callback(results);
}

function init() {
}

function enable() {
    generateIvertedDict(TrancodeRusToEngDict, TrancodeEngToRusDict);
    originalGetInitialResultSet = AppDisplay.AppSearchProvider.prototype.getInitialResultSet;
    AppDisplay.AppSearchProvider.prototype.getInitialResultSet = getResultSet;
}

function disable() {
    AppDisplay.AppSearchProvider.prototype.getInitialResultSet = originalGetInitialResultSet;
    originalGetInitialResultSet = null;
}
