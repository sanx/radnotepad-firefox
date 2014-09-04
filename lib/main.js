"use moz";

var Button = require('sdk/ui/button/action');
var Panel = require('sdk/panel');
var Self = require('sdk/self');
var tabs = require("sdk/tabs");
var Request = require("sdk/request").Request;
var Base64 = require("sdk/base64");
const {promised, all, defer, resolve, reject} = require("sdk/core/promise");
/*var zipjs = require("zip.js/WebContent/zip.js").zip;
var Deflater = require("zip.js/WebContent/deflate.js").Deflater;
zipjs.useWebWorkers = false;
zipjs.Deflater = Deflater;*/
var jszip = require("jszip/lib/index.js");
/*
const {Cu, Ci, Cc} = require("chrome");

var instance = Cc["@mozilla.org/moz/jssubscript-loader;1"];
var loader = instance.getService(Ci.mozIJSSubScriptLoader);

function loadScript (url, imports) {
    let global = Cu.Sandbox(url);
    global.imports = imports;
    global.exports = {};
    loader.loadSubScript(url, global);
    return global.exports;
};

console.log("Self.uri: " + Self.uri);
var zippy = loadScript(Self.uri+"/zip.js/WebContent/zip.js");
console.log(JSON.stringify(zippy));
*/
//var Zip = require("zip.js/WebContent/zip.js");
/*const { sandbox, evaluate, load } = require("sdk/loader/sandbox");
var blah;
var bleh;
var scope = sandbox(null, {sandboxPrototype: {"console": console}});*/
//var scope = sandbox("resource://" + Self.id.replace("@", "-at-") + "/" + Self.name + "/lib/zip.js/WebContent/zip.js", {sandboxPrototype: {"console": console}});
//load(scope, "resource://jid1-itbme678zpstxa-at-jetpack/radnotepad-firefox/lib/zip.js/WebContent/zip.js");
//load(scope, "resource://" + Self.id.replace("@", "-at-") + "/" + Self.name + "/lib/zip.js/WebContent/zip.js");
//evaluate(scope, 'console.log("this... ");', "resource://" + Self.id.replace("@", "-at-") + "/" + Self.name + "/lib/zip.js/WebContent/zip.js");
/*load(scope, "resource://" + Self.id.replace("@", "-at-") + "/" + Self.name + "/lib/zip.js/WebContent/zip.js");
evaluate(scope, 'console.log("useWebWorkers: " + JSON.stringify(zip.useWebWorkers));');
evaluate(scope, 'console.log("workerScriptsPath: " + JSON.stringify(zip.workerScriptsPath));');
evaluate(scope, 'console.log("Reader: " + JSON.stringify(zip.Reader));');
evaluate(scope, 'console.log("TextReader: " + JSON.stringify(zip.TextReader));');
evaluate(scope, 'console.log("createReader: " + JSON.stringify(zip.createReader));');
evaluate(scope, 'console.log("hola: " + JSON.stringify(zip.hola));');
evaluate(scope, 'console.log("adios: " + JSON.stringify(zip.adios));');*/
//evaluate(scope, 'console.log("keys: " + zip.keys.forEach(function (key) { console.log() }));');
//console.log("das scope.this.zip: " + JSON.stringify(scope.this.zip));
//console.log("scope.zip.createWriter: " + JSON.stringify(scope.zip.createWriter));
//console.log("blah: " + blah);
//console.log("bleh: " + bleh);

var button = Button.ActionButton({
  id: "mozilla-link",
  label: "Visit Mozilla",
  icon: {
    "16": "./icon-16.png",
    "32": "./icon-32.png",
    "64": "./icon-64.png"
  },
  onClick: handleClick
});

var mainMenuPanel = Panel.Panel({
    width: 400,
    height: 300,
    contentURL: Self.data.url("main-menu.html"),
    contentScriptFile: Self.data.url("main-menu.js")
});

var errorPanel = Panel.Panel({
    contentURL: Self.data.url("error-message.html"),
    contentScriptFile: Self.data.url("error-message.js")
});

var asyncGet = function (url) {
    var deferred = defer();
    console.log("in asyncGet. url: " + url);
    var request = Request({
        url: url,
        headers: {
            // makes no sense, since we're issuing GETs, but it's hard to unset the Content-Type header in this sdk library and this value is handled OK by the server...
            'Content-Type': 'application/json'
        },
        onComplete: function (response) {
            console.log("Request.get() completed...");
            deferred.resolve({
                text: response.text,
                json: response.json,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
        }
    });
    request.get();
    return deferred.promise;
};

function handleClick (state) {
    mainMenuPanel.show();
}

mainMenuPanel.on("show", function () {
    mainMenuPanel.port.emit("show", {width: mainMenuPanel.width, height: mainMenuPanel.height});
    mainMenuPanel.port.emit("reset", {json: allFoldersJson});
});

mainMenuPanel.port.on("reset", function () {
    allFoldersJson = undefined;
});

var allFoldersJson; // global where we'll copy the js object containing the whole yahoo notepad data once we're done importing it.
mainMenuPanel.port.on("fetch-from-yahoo-button-pressed", function () {
    console.log("they want their file...");
    pGetYahooWssidAndUsername()
        .then(function (wssidAndUsername) {
            console.log("wssid and username seems to be: " + JSON.stringify(wssidAndUsername));
            return pGetNotepadFoldersIndex(wssidAndUsername)
                .then(function (json) {
                    var journalFoldersInfo = json.folders.folder.filter(function (folderInfo) {
                        if ("JOURNAL" === folderInfo.type) {
                            return true;
                        }
                        return false;
                    });
                    json.folders.folder = journalFoldersInfo;
                    console.log("json (without non-journals): " + JSON.stringify(json));
                    return json;
                })
                .then(function (json) {
                    var journalFoldersInfo = json.folders.folder;
                    var pJson = resolve(json);
                    mainMenuPanel.port.emit("folders-info", journalFoldersInfo);
                    var folderPromisesAndIds = [];
                    journalFoldersInfo.forEach(function (folderInfo) {
                        folderPromisesAndIds.push({
                            promish: pGetNotepadFolder.bind(null, folderInfo.id, wssidAndUsername),
                            folderId: folderInfo.id
                        });
                    });
                    var newJson = folderPromisesAndIds.reduce(function (acc, promiseAndId) {
                        var promish = promiseAndId.promish,
                            folderId = promiseAndId.folderId;
                        return acc.then(promish)
                            .then(function (json) {
                                folderInfo = json.folders.folder.filter(function (folderInfo) {
                                    return folderInfo.id === folderId;
                                })[0];
                                mainMenuPanel.port.emit("folder-contents-ok", folderInfo, json);
                                allFoldersJson = json;
                                return json;
                            }, function (err) {
                                folderInfo = json.folders.folder.filter(function (folderInfo) {
                                    return folderInfo.id === folderId;
                                })[0];
                                mainMenuPanel.port.emit("folder-contents-error", folderInfo, json);
                                allFoldersJson = json;
                                throw err;
                            });
                    }, pJson);
                    return newJson;
                });
        }, function (err) {
            errorPanel.port.emit("error", err.message);
            errorPanel.show();
            console.error("err.message: " + err.message);
        })
        .then(function () {
        }, function (err) {
            errorPanel.port.emit("error", err.message);
            errorPanel.show();
            console.error("global error: " + err.message);
        });
});

mainMenuPanel.port.on("download-all-json-link-clicked", function () {
    var jsonDownloadUri = "data:application/json;base64," + Base64.encode(JSON.stringify(allFoldersJson, ' ', 4)),
        tpl = Self.data.load("download-page.html"),
        html = tpl.replace('{{json-download-uri}}', jsonDownloadUri);
    zipAllNotes2();
    tabs.open("data:text/html;base64," + Base64.encode(html));
    mainMenuPanel.hide();
});

var zipAllNotes2 = function () {
    var zip = new jszip();
    zip.file("Hello.txt", "Hello World\n");
    //var img = zip.folder("images");
    //img.file("smile.gif", imgData, {base64: true});
    var content = zip.generate({type:"base64"});
    console.log("das zip contents: " + content);
};

var zipAllNotes = function (callback) {
console.log("zipjs: " + JSON.stringify(zipjs));
//console.log("Zip.createWriter: " + JSON.stringify(Zip.createWriter));
//console.log("Zip.BlobWriter: " + JSON.stringify(Zip.BlobWriter));
    zipjs.createWriter(new zipjs.Data64URIWriter(), function (writer) {
        writer.add("archivo.txt", new zipjs.TextReader("alo!"), function () {
            writer.close(function (dataUri) {
                console.log("dater: " + dataUri);
            });
        }, function (currentIndex, totalIndex) {
        });
    }, function (error) {
        console.log("zip error: " + error);
    });
    //allFoldersJson
};

var pGetYahooWssidAndUsername = function () {
    return asyncGet("https://calendar.yahoo.com/?view=notepad")
        .then(function (res) {
            if (200 !== res.status) {
                throw Error("unexpected HTTP status response. expected '200', and got '" + res.status + "'");
            }
            var matches = res.text.match(/\"\&wssid\=([^"]+?)\"/),
                wssid = (matches && JSON.parse('"'+matches[1]+'"')) || null,
                loginRedirectMatches = res.text.match(/\stype=['"]password['"]\s/),
                usernameMatches = res.text.match(/\/ws\/v3\/users\/([a-zA-Z0-9_]+)\/calendars\//),
                username = (usernameMatches && usernameMatches[1]) || null;
            if (!wssid) {
                if (loginRedirectMatches) {
                    throw Error("You need to be logged into Yahoo on this browser session. Please login first (on this, or any other tab/window belonging to this browser session), then try this again.");
                }
                throw Error("couldn't quite get the Yahoo WSSID from the main notepad page HTML for some unknown reason...");
            }
            if (!username) {
                throw Error("couldn't determine your Yahoo username... can't go on. sorry.");
            }
            return {wssid: wssid, username: username};
        });
};

var pGetNotepadFoldersIndex = function (wssidAndUsername) {
    var wssid = wssidAndUsername.wssid,
        username = wssidAndUsername.username,
        indexUrl = "https://calendar.yahoo.com/ws/v3/users/" + username + "/calendars/?format=json&wssid=" + wssid;
    return asyncGet(indexUrl)
        .then(function (res) {
            if (200 !== res.status) {
                throw Error("unexpected HTTP status response when trying to get the list of folders. expected '200', and got '" + res.status + "'");
            }
            return res.json;
        });
};

var pGetNotepadFolder = function (folderId, wssidAndUsername, mainJson) {
    var wssid = wssidAndUsername.wssid,
        username = wssidAndUsername.username,
        indexUrl = "https://calendar.yahoo.com/ws/v3/users/" + username + "/calendars/" + folderId + "/journals/?format=json&wssid=" + wssid,
        folderInfo = mainJson.folders.folder.filter(function (folderInfo) {
            return folderInfo.id === folderId;
        })[0];
    return asyncGet(indexUrl)
        .then(function (res) {
            if (200 !== res.status) {
                throw Error("unexpected HTTP status response when trying to get the notes on folder id: '" + folderId + "', named: '" + folderInfo.name + "'. expected '200', and got '" + res.status + "'");
            }
            folderInfo.contents = res.json;
            return mainJson;
        });
};
