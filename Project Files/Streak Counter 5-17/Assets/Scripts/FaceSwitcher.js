//@input SceneObject[] faceObjects
//@input SceneObject[] noFaceObjects
//@ui {"widget":"separator"}
//@input bool debug
//@input string debugName = "" {"showIf":"debug"}
//@input Component.Text debugText {"showIf":"debug"}

function onFaceFound(){
    showOnFace(true);
}

function onFaceLost(){
    showOnFace(false);
}

function showOnFace(state){
    for (var i = 0; i < script.faceObjects.length; i++) {
        if (script.faceObjects[i]) {
            script.faceObjects[i].enabled = state;
        } else {
            printWarning("Face Object at index " + i + " is null or undefined, skipping");
        }
    }
    for (var i = 0; i < script.noFaceObjects.length; i++) {
        if (script.noFaceObjects[i]) {
            script.noFaceObjects[i].enabled = !state;
        } else {
            printWarning("No Face Object at index " + i + " is null or undefined, skipping");
        }
    }
}

script.createEvent("FaceFoundEvent").bind(onFaceFound);
script.createEvent("FaceLostEvent").bind(onFaceLost);

// Debug
function debugPrint(text, force) {
    if (!force && !script.debug) return;
    var newLog = (script.debugName || self.name) + ": " + text;
    if(global.textLogger) global.logToScreen(newLog);
    if(script.debugText) script.debugText.text = newLog;
    print(newLog);
}