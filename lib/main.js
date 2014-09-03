"use moz";

var Button = require('sdk/ui/button/action');
var Panel = require('sdk/panel');
var Self = require('sdk/self');
var tabs = require("sdk/tabs");
var Request = require("sdk/request").Request;
var Base64 = require("sdk/base64");
const {promised, all, defer, resolve, reject} = require("sdk/core/promise");

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
            console.error("error: " + err);
        })
        .then(function () {
        }, function (err) {
            console.error("global error: " + err);
        });
});

mainMenuPanel.port.on("download-all-json-link-clicked", function () {
    tabs.open("data:application/json;base64," + Base64.encode(JSON.stringify(allFoldersJson, ' ', 4)));
});

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
                    throw Error("You need to be logged into Yahoo on this browser session. Please login first, then try this again.");
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
                throw Error("unexpected HTTP status response. expected '200', and got '" + res.status + "'");
            }
            return res.json;
        });
};

var pGetNotepadFolder = function (folderId, wssidAndUsername, mainJson) {
    var wssid = wssidAndUsername.wssid,
        username = wssidAndUsername.username,
        indexUrl = "https://calendar.yahoo.com/ws/v3/users/" + username + "/calendars/" + folderId + "/journals/?format=json&wssid=" + wssid;
    return asyncGet(indexUrl)
        .then(function (res) {
            if (200 !== res.status) {
                throw Error("unexpected HTTP status response. expected '200', and got '" + res.status + "'");
            }
            var folderInfo = mainJson.folders.folder.filter(function (folderInfo) {
                return folderInfo.id === folderId;
            })[0];
            folderInfo.contents = res.json;
            return mainJson;
        });
};
