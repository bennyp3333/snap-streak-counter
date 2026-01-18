//@input Component.ScreenTransform extents
//@input Component.Image blankIcon
//@ui {"widget":"separator"}
//@input Asset.Texture[] blankTextures
//@ui {"widget":"separator"}
//@input Component.ScriptComponent pushButton
//@ui {"widget":"separator"}
//@input bool debug
//@input string debugName = "Spawnable" {"showIf":"debug"}
//@input Component.Text debugText {"showIf":"debug"}

// SPAWNABLE IDENTITY

// Mark this script as a spawnable (used by SpawnManager to find it)
script.isSpawnable = true;

// These are set by SpawnManager when spawned
script.spawnId = null;
script.spawnGroup = null;
script.spawnManager = null;

script.id = null;

var self = script.getSceneObject();
var selfTransform = self.getTransform();
var selfScreenTransform = self.getComponent("Component.ScreenTransform");

var selfImage = self.getComponent("Component.Image");
selfImage.extentsTarget = script.extents;
selfImage.stretchMode = StretchMode.FitHeight;

var badgeMaterial = null;
var blankMaterial = null;

var fadeTween = null;

// LIFECYCLE CALLBACKS (Override these)

/**
 * Called immediately after the object is spawned
 * Override this to run initialization logic
 */
script.onSpawned = function() {
    debugPrint("Spawned!");
};

/**
 * Called just before the object is destroyed via SpawnManager
 * Override this for cleanup logic
 */
script.onDespawn = function() {
    debugPrint("Despawning!");
};

script.setup = function(id, group, texture){
    script.id = id;
    badgeMaterial = global.utils.makeMatUnique(selfImage)[0];
    blankMaterial = global.utils.makeMatUnique(script.blankIcon)[0];
    badgeMaterial.mainPass.baseTex = texture;
    blankMaterial.mainPass.baseTex = script.blankTextures[group];
}

script.getSize = function(){
    print("Size: " + script.extents.anchors.getSize().x);
    return script.extents.anchors.getSize();
}

script.unlock = function(){
    global.utils.setAlpha(selfImage, 1);
    global.utils.setAlpha(script.blankIcon, 0);
    script.blankIcon.getSceneObject().enabled = false;
}

script.lock = function(){
    global.utils.setAlpha(selfImage, 0);
    global.utils.setAlpha(script.blankIcon, 1);
    script.blankIcon.getSceneObject().enabled = true;
}

script.onPress = function(){
    global.events.trigger("onBadgePressed", script.id);
}

script.reparent = function(newParent){
    self.setParent(newParent);
}

script.setRenderOrder = function(renderOrder){
    selfImage.setRenderOrder(renderOrder);
    script.blankIcon.setRenderOrder(renderOrder + 1);
}

script.setInteractable = function(state){
    script.pushButton.setInteractable(state);
}

// SELF-MANAGEMENT METHODS

/**
 * Destroy this spawned object (removes from SpawnManager registry)
 */
script.despawn = function() {
    if (script.spawnManager && script.spawnId) {
        script.spawnManager.destroy(script.spawnId);
    } else {
        // Fallback if not properly registered
        debugPrint("Warning: despawn called but not registered with SpawnManager", true);
        self.destroy();
    }
};

/**
 * Destroy this object after a delay
 * @param {number} delay - Delay in seconds
 */
script.despawnAfter = function(delay) {
    var delayedEvent = script.createEvent("DelayedCallbackEvent");
    delayedEvent.bind(function() {
        script.despawn();
    });
    delayedEvent.reset(delay);
};

/**
 * Get this object's spawn ID
 * @returns {string|null}
 */
script.getId = function() {
    return script.spawnId;
};

/**
 * Get this object's spawn group
 * @returns {string|null}
 */
script.getGroup = function() {
    return script.spawnGroup;
};

/**
 * Get the SceneObject this script is attached to
 * @returns {SceneObject}
 */
script.getObject = function() {
    return self;
};

// DEBUG

function debugPrint(text, force) {
    if (!force && !script.debug) return;
    var idStr = script.spawnId ? " [" + script.spawnId + "]" : "";
    var log = script.debugName + idStr + ": " + text;
    if (global.textLogger) global.logToScreen(log);
    if (script.debugText) script.debugText.text = log;
    print(log);
}