//@input SceneObject badgeTemplate
//@input SceneObject spawnParent
//@input Asset.Texture[] badgeTextures
//@ui {"widget":"separator"}
//@input float padding = 0.05
//@input float swipeMultiplier = 1
//@ui {"widget":"separator"}
//@input bool debug
//@input string debugName = "" {"showIf":"debug"}
//@input Component.Text debugText {"showIf":"debug"}

var badges = [
    {id: "1", name: "It Begins", group: 0},
    {id: "2", name: "Keep It Up", group: 0},
    {id: "3", name: "On A Roll", group: 0},
    {id: "7", name: "Lucky Number 7", group: 0},
    {id: "8", name: "Infinity Vibes", group: 0},
    {id: "10", name: "Ten Days", group: 0},
    {id: "14", name: "Routine", group: 0},
    {id: "30", name: "One Month", group: 0},
    {id: "50", name: "Fifty Days", group: 0},
    {id: "69", name: "Nice", group: 0},
    {id: "100", name: "One Hundred Days", group: 0},
    {id: "365", name: "A Whole Year", group: 0},
    {id: "420", name: "Weed Number", group: 0},
    {id: "666", name: "Cursed Streak", group: 0},
    {id: "777", name: "Jackpot", group: 0},
    {id: "999", name: "Almost There", group: 0},
    {id: "1000", name: "One Thousand Days!", group: 0},
    {id: "birthday", name: "Your Birthday!", group: 1},
    {id: "christmas", name: "Christmas", group: 1},
    {id: "easter", name: "Easter", group: 1},
    {id: "halloween", name: "Halloween", group: 1},
    {id: "july4th", name: "4th Of July", group: 1},
    {id: "newYears", name: "New Years Eve", group: 1},
    {id: "stPatricks", name: "Saint Patrick's Day", group: 1},
    {id: "thanksgiving", name: "Thanksgiving", group: 1},
    {id: "valentines", name: "Valentine's Day", group: 1},
    {id: "freshStart", name: "A Fresh Start", group: 2},
    {id: "makeAWish", name: "Make A Wish", group: 2},
    {id: "noSleepClub", name: "No Sleep Club", group: 2},
    {id: "secretBadge", name: "Secret", group: 2},
    {id: "unstableEnergy", name: "Unstable Energy", group: 2},
    {id: "wheredYouGo", name: "Where'd You Go?", group: 2},
];

var self = script.getSceneObject();

// Persistent storage
var store = global.persistentStorageSystem.store;
var storageKey = "unlockedBadges";

var badgeWidthOverride = 0.4;

// Runtime state
var spawnedBadges = []; // { id, obj, script, priority, unlocked, ... }
var unlockedIds = [];
var badgePositions = [];
var totalWidth = 0;

// Drag state
var isDragging = false;
var dragStartX = 0;
var dragOffsetX = 0;
var offsetX = 0;
var snapSpeed = 10;

function init() {
    loadUnlockedBadges();
    spawnAllBadges();
    applyUnlockedState();
    setupSwipeInput();
    sortAndLayout();

    global.events.add("onBadgePressed", onBadgePressed);
    unlockBadge("1");

    debugPrint("Initialized with " + spawnedBadges.length + " badges");
}

function loadUnlockedBadges() {
    unlockedIds = store.getStringArray(storageKey);
    debugPrint("Loaded " + unlockedIds.length + " unlocked badges");
}

function saveUnlockedBadges() {
    store.putStringArray(storageKey, unlockedIds);
    debugPrint("Saved " + unlockedIds.length + " unlocked badges");
}

store.onStoreFull = function() {
    debugPrint("Warning: Storage full!", true);
};

function applyUnlockedState() {
    for (var i = 0; i < spawnedBadges.length; i++) {
        var badge = spawnedBadges[i];
        if (unlockedIds.indexOf(badge.id) !== -1) {
            badge.unlocked = true;
            badge.script.unlock();
        }
    }
}

function spawnAllBadges() {
    for (var i = 0; i < badges.length; i++) {
        var badge = badges[i];
        var spawned = global.spawn.create(script.badgeTemplate, script.spawnParent, "badges");
        
        if (!spawned || !spawned.obj) {
            debugPrint("Failed to spawn badge: " + badge.id, true);
            continue;
        }
        
        var badgeData = {
            id: badge.id,
            name: badge.name,
            obj: spawned.obj,
            script: spawned.script,
            priority: i,
            group: badge.group,
            unlocked: false
        };
        
        spawned.script.setup(badge.id, badge.group, script.badgeTextures[i]);
        spawnedBadges.push(badgeData);
    }
}

function setupSwipeInput() {
    self.createComponent("Component.TouchComponent");
    script.createEvent("TouchStartEvent").bind(onTouchStart);
    script.createEvent("TouchMoveEvent").bind(onTouchMove);
    script.createEvent("TouchEndEvent").bind(onTouchEnd);
}

function onTouchStart(eventData) {
    isDragging = true;
    dragStartX = eventData.getTouchPosition().x;
    dragOffsetX = 0;
}

function onTouchMove(eventData) {
    if (!isDragging) return;
    
    var currentX = eventData.getTouchPosition().x;
    var pixelDelta = currentX - dragStartX;
    dragOffsetX = pixelDelta * script.swipeMultiplier;
    
    applyPositions();
}

function onTouchEnd(eventData) {
    if (!isDragging) return;
    isDragging = false;
    
    // Commit drag to offset
    offsetX += dragOffsetX;
    dragOffsetX = 0;
}

function sortAndLayout() {
    spawnedBadges.sort(function(a, b) {
        // Unlocked first
        if (a.unlocked !== b.unlocked) {
            return a.unlocked ? -1 : 1;
        }
        
        // Both unlocked: reverse priority (higher index first, most recent unlock at front)
        if (a.unlocked) {
            return b.priority - a.priority;
        }
        
        // Both locked: normal priority (lower index first)
        return a.priority - b.priority;
    });
    
    calculateLayout();
    applyPositions();
}
function calculateLayout() {
    badgePositions = [];
    var currentX = -1 + (script.padding / 2);
    
    for (var i = 0; i < spawnedBadges.length; i++) {
        //var width = spawnedBadges[i].script.getSize().x;
        var width = badgeWidthOverride;
        badgePositions.push(currentX + width / 2);
        currentX += width + script.padding;
    }
    
    // Total scrollable width (subtract 1 to account for starting at -1, subtract visible area)
    totalWidth = currentX - script.padding - 1;
}

function applyPositions() {
    var combinedOffset = offsetX + dragOffsetX;
    
    for (var i = 0; i < spawnedBadges.length; i++) {
        var st = spawnedBadges[i].obj.getComponent("Component.ScreenTransform");
        var x = badgePositions[i] + combinedOffset;
        st.anchors.setCenter(new vec2(x, 0));
    }
}

function onUpdate() {
    if (isDragging) return;
    
    // Clamp offset to valid scroll range
    var targetOffsetX = global.utils.clamp(offsetX, -totalWidth, 0);
    
    // Snap back if out of bounds
    if (Math.abs(offsetX - targetOffsetX) > 0.0001) {
        offsetX += (targetOffsetX - offsetX) * snapSpeed * getDeltaTime();
        applyPositions();
    }
}

function onBadgePressed(badgeId){
    debugPrint("Badge tapped: " + badgeId);
}

function unlockBadge(badgeId) {
    for (var i = 0; i < spawnedBadges.length; i++) {
        if (spawnedBadges[i].id !== badgeId) continue;
        if (spawnedBadges[i].unlocked) return true; // Already unlocked
        
        spawnedBadges[i].unlocked = true;
        spawnedBadges[i].script.unlock();
        
        if (unlockedIds.indexOf(badgeId) === -1) {
            unlockedIds.push(badgeId);
            saveUnlockedBadges();
        }
        
        sortAndLayout();
        return true;
    }
    return false;
}

function lockBadge(badgeId) {
    for (var i = 0; i < spawnedBadges.length; i++) {
        if (spawnedBadges[i].id !== badgeId) continue;
        if (!spawnedBadges[i].unlocked) return true; // Already locked
        
        spawnedBadges[i].unlocked = false;
        if (spawnedBadges[i].script.lock) {
            spawnedBadges[i].script.lock();
        }
        
        var idx = unlockedIds.indexOf(badgeId);
        if (idx !== -1) {
            unlockedIds.splice(idx, 1);
            saveUnlockedBadges();
        }
        
        sortAndLayout();
        return true;
    }
    return false;
}

function isUnlocked(badgeId) {
    return unlockedIds.indexOf(badgeId) !== -1;
}

function getBadge(badgeId) {
    for (var i = 0; i < spawnedBadges.length; i++) {
        if (spawnedBadges[i].id === badgeId) {
            return spawnedBadges[i];
        }
    }
    return null;
}

function clearAllUnlocks() {
    for (var i = 0; i < spawnedBadges.length; i++) {
        spawnedBadges[i].unlocked = false;
        if (spawnedBadges[i].script.lock) {
            spawnedBadges[i].script.lock();
        }
    }
    unlockedIds = [];
    saveUnlockedBadges();
    sortAndLayout();
    debugPrint("All unlocks cleared");
}

script.createEvent("OnStartEvent").bind(init);
script.createEvent("UpdateEvent").bind(onUpdate);

script.unlockBadge = unlockBadge;
script.lockBadge = lockBadge;
script.isUnlocked = isUnlocked;
script.getBadge = getBadge;
script.clearAllUnlocks = clearAllUnlocks;

function debugPrint(text, force) {
    if (!force && !script.debug) return;
    var log = (script.debugName || self.name) + ": " + text;
    if (global.textLogger) global.logToScreen(log);
    if (script.debugText) script.debugText.text = log;
    print(log);
}