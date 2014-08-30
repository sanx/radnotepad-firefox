var fetchFromYahooButton = document.getElementById("download-button");
var downloadAllJson = document.getElementById("download-all-json");

fetchFromYahooButton.addEventListener('click', function (event) {
    self.port.emit('download-button-pressed');
});
downloadAllJson.addEventListener('click', function (event) {
    event.preventDefault();
    var clickEvent;
    clickEvent = document.createEvent("MouseEvent");
    console.log("window: " + window);
    console.log("typeof window: " + typeof window);
    clickEvent.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    this.dispatchEvent(clickEvent);
    //this.click();
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
    downloadAllA.href = btoa(JSON.stringify(json, ' ', 4));
    //downloadAllA.download = "yahoo-notepad-";
});
self.port.on('folder-contents-error', function (folderInfo, json) {
    folderLi = document.getElementById('progress-folder-' + folderInfo.id);
    folderLi.className = "error";
    folderLi.innerHTML += " (failed)";
});
