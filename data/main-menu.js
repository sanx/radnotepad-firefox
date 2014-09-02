var fetchFromYahooButton = document.getElementById("download-button");
var downloadAllJson = document.getElementById("download-all-json");

fetchFromYahooButton.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    self.port.emit('fetch-from-yahoo-button-pressed');
    return false;
});
downloadAllJson.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    self.port.emit('download-all-json-link-clicked');
    return false;
});

self.port.on('folders-info', function (foldersInfo) {
    var importProgressContainer = document.getElementById("import-progress");
    importProgressContainer.style.display = 'block';
    foldersInfo.forEach(function (folderInfo) {
        var folderLi = document.createElement("li");
        folderLi.id = 'progress-folder-' + folderInfo.id;
        folderLi.className = "pending";
        folderLi.innerHTML = folderInfo.name;
        importProgressContainer.appendChild(folderLi);
    });
});

self.port.on('folder-contents-ok', function (folderInfo, json) {
    var folderContents = folderInfo.contents;
    folderLi = document.getElementById('progress-folder-' + folderInfo.id);
    folderLi.className = "";
    folderLi.innerHTML += " (" + folderContents.journals.count + " notes)";
    var downloadAllA = document.getElementById('download-all-json');
    downloadAllA.style.display = 'inline';
    //downloadAllA.href = 'data:application/json;base64,' + btoa(JSON.stringify(json, ' ', 4));
    //downloadAllA.download = "yahoo-notepad-";
});
self.port.on('folder-contents-error', function (folderInfo, json) {
    folderLi = document.getElementById('progress-folder-' + folderInfo.id);
    folderLi.className = "error";
    folderLi.innerHTML += " (failed)";
});
