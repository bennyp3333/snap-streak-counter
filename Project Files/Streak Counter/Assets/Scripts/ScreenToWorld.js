// ScreenToWorld.js
// Version: 0.2.0
// Description: Places this SceneObject at a screen position converted to world space.
//  Takes normalized screen coordinates (0-1) and a world depth value, then positions
//  the object by casting a ray from the camera through the screen point.
//  Uses manual ray projection to avoid spherical distortion issues with screenSpaceToWorldSpace.
// Author: Bennyp3333 [https://benjamin-p.dev]
//
// ----- USAGE -----
// 1. Add this script to the SceneObject you want to position
// 2. Set "Screen Position" as normalized coordinates (0,0 = top-left, 1,1 = bottom-right)
// 3. Set "World Depth" as distance from camera along the ray
// 4. Optional: Assign a specific camera, otherwise the script will auto-find one
// 5. Use script.api methods for runtime updates:
//    - script.api.setScreenPosition(x, y) - Update screen coordinates
//    - script.api.setWorldDepth(depth) - Update world depth
//    - script.api.setPosition(vec2, depth) - Update both at once
//    - script.api.update() - Reapply current values

//@input vec2 screenPosition = {0.5, 0.5} {"label": "Screen Position", "hint": "Normalized screen coords (0-1), (0,0) = top-left"}
//@input float worldDepth = 100 {"label": "World Depth", "hint": "Distance from camera along ray"}
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
var cameraTransform = null;

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

function initialize() {
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

// Build the world position manually using camera transform and FOV
function screenToWorld(screenPos, distance) {
    var fov = camera.fov; // Vertical FOV in radians
    var aspect = camera.aspect;
    
    // Convert screen (0-1, top-left origin) to centered normalized coords (-0.5 to 0.5)
    var nx = screenPos.x - 0.5;
    var ny = -(screenPos.y - 0.5); // Flip Y: screen Y down, world Y up
    
    // At distance d, the visible height is: 2 * d * tan(fov/2)
    // At distance d, the visible width is: height * aspect
    var halfHeight = distance * Math.tan(fov / 2);
    var halfWidth = halfHeight * aspect;
    
    // Convert normalized coords to world offset
    var offsetX = nx * 2 * halfWidth;
    var offsetY = ny * 2 * halfHeight;
    
    // Get camera basis vectors and position
    var camPos = cameraTransform.getWorldPosition();
    var camForward = cameraTransform.forward;
    var camRight = cameraTransform.right;
    var camUp = cameraTransform.up;
    
    // Calculate world position:
    // Start at camera, go forward by distance, then offset by right and up
    var worldPos = camPos
        .add(camForward.uniformScale(-distance)) // Forward is -Z in Lens Studio
        .add(camRight.uniformScale(offsetX))
        .add(camUp.uniformScale(offsetY));
    
    return worldPos;
}

function updatePosition() {
    if (!camera || !cameraTransform) return;
    
    var worldPos = screenToWorld(script.screenPosition, script.worldDepth);
    transform.setWorldPosition(worldPos);
    
    printDebug("Position updated to: " + worldPos.toString());
}

// Public API for runtime updates
script.api.setScreenPosition = function(x, y) {
    script.screenPosition = new vec2(x, y);
    updatePosition();
};

script.api.setWorldDepth = function(depth) {
    script.worldDepth = depth;
    updatePosition();
};

script.api.setPosition = function(screenPos, depth) {
    script.screenPosition = screenPos;
    script.worldDepth = depth;
    updatePosition();
};

script.api.update = updatePosition;

// Initialize and set initial position

var delayedEvent = script.createEvent("DelayedCallbackEvent");
delayedEvent.bind(function(eventData)
{
    if (initialize()) {
        updatePosition();
    }
});
delayedEvent.reset(1);

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