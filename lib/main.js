"use moz";
/**
 * Copyright (c) 2014 Gerardo Moad
 */

var Button = require('sdk/ui/button/action');
var Panel = require('sdk/panel');
var Self = require('sdk/self');
var tabs = require("sdk/tabs");
var Request = require("sdk/request").Request;
var Base64 = require("sdk/base64");
const {promised, all, defer, resolve, reject} = require("sdk/core/promise");
var jszip = require("jszip/lib/index.js");

var button = Button.ActionButton({
  id: "radnotepad-link",
  label: "RAD Notepad Yahoo Notepad Exporter",
  icon: {
    "16": "./radnotepad_logo-16.png",
    "32": "./radnotepad_logo-32.png",
    "64": "./radnotepad_logo-64.png"
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
    mainMenuPanel.port.emit("reset", allFoldersJson);
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
                    //console.log("json (without non-journals): " + JSON.stringify(json));
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
        zipDownloadUri = "data:application/zip;base64," + zipAllNotes(allFoldersJson),
        tpl = Self.data.load("download-page.html"),
        html = tpl.replace('{{json-download-uri}}', jsonDownloadUri).replace('{{zip-download-uri}}', zipDownloadUri);
    tabs.open("data:text/html;base64," + Base64.encode(html));
    mainMenuPanel.hide();
});

var zipAllNotes = function (allFolders) {
    var zip = new jszip();
    allFolders.folders.folder.forEach(function (folder) {
        var sub = zip.folder(folder.name);
        folder.contents.journals.journal.forEach(function (journal) {
            var filename = journal.summary.replace(/([^a-zA-Z0-9\-\_])/g, "_") + ".txt";
                contents = "****\n** Summary: " + journal.summary + "\n****\n\n" + journal.description;
            //console.log("adding file: " + filename + " to folder: " + folder.name);
            sub.file(filename, contents);
        });
    });
    //var img = zip.folder("images");
    //img.file("smile.gif", imgData, {base64: true});
    var generated =  zip.generate({type: "base64", compression: "STORE", comment: "made with love by gerardomoad.com. donate!"});
    //console.log("generated base64: " + generated);
    return generated;
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
                    throw Error("You need to be logged into Yahoo on this browser session. Please login first (on this, or any other tab/window belonging to this browser session), then try again.");
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
