// ScreenToWorld.js
// Version: 1.0.0
// Description: Places this SceneObject at a screen position converted to world space.
//  Takes normalized screen coordinates (0-1) and a world depth value.
// Author: Bennyp3333 [https://benjamin-p.dev]
//
// ----- USAGE -----
// 1. Add this script to the SceneObject you want to position
// 2. Set "Screen Position" as normalized coordinates (0,0 = top-left, 1,1 = bottom-right)
// 3. Set "World Depth" as distance from camera's near plane
// 4. Optional: Assign a specific camera, otherwise the script will auto-find a perspective camera
//
// ----- API -----
// script.setScreenPosition(vec2) - Update screen position
// script.setWorldDepth(number) - Update world depth
// script.setPosition(vec2, number) - Update both screen position and depth
// script.update() - Reapply current values

//@input vec2 screenPosition = {0.5, 0.5} {"label": "Screen Position", "hint": "Normalized screen coords (0-1), (0,0) = top-left"}
//@input float worldDepth = 100 {"label": "World Depth", "hint": "Distance from camera near plane"}
//@input Component.Camera camera {"label": "Camera (Optional)"}

//@ui {"widget":"separator"}
//@input bool editAdvancedOptions
//@ui {"widget":"group_start", "label":"Advanced Options", "showIf":"editAdvancedOptions"}
//@input bool printDebugStatements = false
//@input bool printWarningStatements = true
//@ui {"widget":"group_end"}

var sceneObject = script.getSceneObject();
var transform = sceneObject.getTransform();
var camera = script.camera;

function findCamera() {
    for (var i = 0; i < global.scene.getRootObjectsCount(); i++) {
        var rootObject = global.scene.getRootObject(i);
        var cameras = rootObject.getComponents("Component.Camera");
        for (var j = 0; j < cameras.length; j++) {
            if (cameras[j].type == Camera.Type.Perspective) {
                printDebug("Found perspective camera: " + rootObject.name);
                return cameras[j];
            }
        }
        
        // Check children recursively
        var found = findCameraInChildren(rootObject);
        if (found) {
            return found;
        }
    }
    printWarning("No perspective camera found in scene");
    return null;
}

function findCameraInChildren(parent) {
    var childCount = parent.getChildrenCount();
    for (var i = 0; i < childCount; i++) {
        var child = parent.getChild(i);
        var cameras = child.getComponents("Component.Camera");
        for (var j = 0; j < cameras.length; j++) {
            if (cameras[j].type == Camera.Type.Perspective) {
                printDebug("Found perspective camera: " + child.name);
                return cameras[j];
            }
        }
        var found = findCameraInChildren(child);
        if (found) {
            return found;
        }
    }
    return null;
}

function init() {
    if (!camera) {
        camera = findCamera();
    }
    
    if (!camera) {
        printWarning("No camera available - cannot position object");
        return false;
    }
    
    cameraTransform = camera.getSceneObject().getTransform();
    printDebug("Initialized with camera, FOV: " + camera.fov + ", Aspect: " + camera.aspect);
    return true;
}

function updatePosition() {
    if (!camera) return;
    var worldPos = camera.screenSpaceToWorldSpace(script.screenPosition, script.worldDepth);
    transform.setWorldPosition(worldPos);
    printDebug("Position: " + worldPos.toString());
}

// ===== Public API =====
script.setScreenPosition = function(pos) {
    script.screenPosition = pos;
    updatePosition();
};

script.setWorldDepth = function(depth) {
    script.worldDepth = depth;
    updatePosition();
};

script.setPosition = function(pos, depth) {
    script.screenPosition = pos;
    script.worldDepth = depth;
    updatePosition();
};

script.update = updatePosition;

// ===== Initialize =====
if (init()) {
    updatePosition();
}

// ===== Debug Functions =====
function printDebug(message) {
    if (script.printDebugStatements) {
        var newLog = "ScreenToWorld " + sceneObject.name + " - " + message;
        if (global.textLogger) {
            global.logToScreen(newLog);
        }
        print(newLog);
    }
}

function printWarning(message) {
    if (script.printWarningStatements) {
        var warningLog = "ScreenToWorld " + sceneObject.name + " - WARNING, " + message;
        if (global.textLogger) {
            global.logError(warningLog);
        }
        print(warningLog);
    }
}