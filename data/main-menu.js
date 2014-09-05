/**
 * Copyright (c) 2014 Gerardo Moad
 */
var fetchFromYahooButton = document.getElementById("download-button");
var downloadAllJson = document.getElementById("download-all-json");
var fieldsetMain = document.querySelector("fieldset.main");
var importProgressContainer = document.querySelector('fieldset.loaded');

// globals
var width,
    height,
    json,
    importProgressEmptyHTML = importProgressContainer.innerHTML;

var reset = function () {
    json = null;
    fetchFromYahooButton.disabled = false;
    downloadAllJson.disabled = true;
    importProgressContainer.style.display = 'none';
    importProgressContainer.innerHTML = importProgressEmptyHTML;
};
fetchFromYahooButton.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    reset();
    fetchFromYahooButton.disabled = true;
    self.port.emit('reset', null);
    self.port.emit('fetch-from-yahoo-button-pressed');
    return false;
});
downloadAllJson.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    self.port.emit('download-all-json-link-clicked');
    return false;
});

self.port.on('show', function (dimensions) {
    width = dimensions.width;
    height = dimensions.height;
});
self.port.on('reset', function (json) {
    if (json && undefined !== json) {
        fetchFromYahooButton.disabled = false;
        downloadAllJson.disabled = false;
    } else {
        reset();
    }
});
self.port.on('folders-info', function (foldersInfo) {
    importProgressContainer.style.display = 'block';
    fetchFromYahooButton.disabled = true;
    foldersInfo.forEach(function (folderInfo) {
        var folder = document.createElement("div"),
            folderName = document.createElement("div"),
            folderLi = document.createElement("progress");
        folder.id = 'progress-folder-' + folderInfo.id;
        folder.classList.add("folder");
        folder.classList.add("pending");
        folderName.innerHTML = '<span class="name">' + folderInfo.name + '</span>';
        folder.appendChild(folderName);
        folder.appendChild(folderLi);
        importProgressContainer.appendChild(folder);
    });
});

self.port.on('folder-contents-ok', function (folderInfo, json) {
    var folderContents = folderInfo.contents,
        folder = document.getElementById('progress-folder-' + folderInfo.id),
        folderLi = folder.getElementsByTagName("progress")[0],
        folderName = folder.getElementsByTagName("div")[0];
    folder.classList.remove("pending");
    folderName.innerHTML += ' <span class="count">(' + folderContents.journals.count + ' notes)</span>';
    folderLi.value = 1;
    downloadAllJson.disabled = false;
});
self.port.on('folder-contents-error', function (folderInfo, json) {
    folder = document.getElementById('progress-folder-' + folderInfo.id);
    folder.classList.remove("pending");
    folder.classList.add("error");
    folderLi.innerHTML += ' <span class="count">(failed)</span>';
    folderLi.value = 1;
    downloadAllJson.disabled = false;
});
