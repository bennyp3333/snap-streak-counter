//@input Component.ScriptComponent streakController
//@input Component.ScriptComponent badgeCarousel
//@ui {"widget":"separator"}
//@input bool debug
//@input string debugName = "" {"showIf":"debug"}
//@input Component.Text debugText {"showIf":"debug"}

var self = script.getSceneObject();

// Streak milestone badge IDs
var streakMilestones = ["1", "2", "3", "7", "8", "10", "14", "30", "50", "69", "100", "365", "420", "666", "777", "999", "1000"];

// Holiday definitions (month is 0-indexed)
var holidays = [
    {id: "newYears", month: 11, day: 31},       // Dec 31
    {id: "valentines", month: 1, day: 14},      // Feb 14
    {id: "stPatricks", month: 2, day: 17},      // Mar 17
    {id: "easter", month: 3, day: 20},          // ~Apr 20 (varies, using approximate)
    {id: "july4th", month: 6, day: 4},          // Jul 4
    {id: "halloween", month: 9, day: 31},       // Oct 31
    {id: "thanksgiving", month: 10, day: 28},   // ~Nov 28 (varies, using approximate)
    {id: "christmas", month: 11, day: 25}       // Dec 25
];

// State tracking
var faceLostTime = null;

function init() {
    // Streak-based badges
    script.streakController.onReady(function(data) {
        checkAllBadges(data);
    });

    script.streakController.onStreakChanged(function(data) {
        checkAllBadges(data);
    });

    // Streak broken badge
    script.streakController.onStreakBroken(function(data) {
        if (data.brokenByUserIndex == script.streakController.getCurrentUserIndex()) {
            script.badgeCarousel.unlockBadge("streakBroken");
        }
    });

    // Face tracking for "Where'd You Go?" badge
    script.createEvent("FaceFoundEvent").bind(onFaceFound);
    script.createEvent("FaceLostEvent").bind(onFaceLost);

    // Touch events for secret badge
    script.createEvent("TouchStartEvent").bind(onTouchStart);
    script.createEvent("TouchEndEvent").bind(onTouchEnd);

    debugPrint("Initialized!");
}

function checkAllBadges(data) {
    var streak = data.currentStreak || 0;

    // Check streak milestones
    unlockStreakBadges(streak);

    // Check time-based badges
    checkTimeBadges();

    // Check holiday badges
    checkHolidayBadges();

    // Check unstable energy badge
    checkUnstableEnergy();

    // Check fresh start badge (restarted streak after breaking it)
    checkFreshStart(data);
}

// ===== Streak Badges =====

function unlockStreakBadges(streakCount) {
    for (var i = 0; i < streakMilestones.length; i++) {
        var milestoneId = streakMilestones[i];
        var milestoneValue = parseInt(milestoneId);

        if (streakCount >= milestoneValue) {
            script.badgeCarousel.unlockBadge(milestoneId);
        }
    }
    debugPrint("Checked streak badges for streak: " + streakCount);
}

// ===== Time-Based Badges =====

function checkTimeBadges() {
    var now = new Date();
    var hours = now.getHours();
    var minutes = now.getMinutes();

    // Make A Wish - 11:11 or 12:12 (with 2 minute window)
    var isWishTime = (hours === 11 && minutes >= 10 && minutes <= 12) ||
                     (hours === 12 && minutes >= 11 && minutes <= 13) ||
                     (hours === 23 && minutes >= 10 && minutes <= 12); // 11:11 PM too
    
    if (isWishTime) {
        script.badgeCarousel.unlockBadge("makeAWish");
        debugPrint("Make A Wish badge unlocked at " + hours + ":" + minutes);
    }

    // No Sleep Club - Between 1am and 5am
    if (hours >= 1 && hours < 5) {
        script.badgeCarousel.unlockBadge("noSleepClub");
        debugPrint("No Sleep Club badge unlocked at " + hours + ":" + minutes);
    }
}

// ===== Holiday Badges =====

function checkHolidayBadges() {
    var now = new Date();
    var month = now.getMonth();
    var day = now.getDate();

    for (var i = 0; i < holidays.length; i++) {
        var holiday = holidays[i];

        // Allow a window of +/- 1 day for holidays
        var isHoliday = (month === holiday.month) && 
                        (day >= holiday.day - 1 && day <= holiday.day + 1);

        if (isHoliday) {
            script.badgeCarousel.unlockBadge(holiday.id);
            debugPrint("Holiday badge unlocked: " + holiday.id);
        }
    }
}

// ===== Fresh Start Badge =====

function checkFreshStart(data) {
    // Fresh Start - awarded when restarting a streak after breaking it
    // Current streak is 1 and there was a previous streak that was broken
    var context = script.streakController.getMemoContext();

    if (data.currentStreak === 1 && context.previousStreak >= 1) {
        script.badgeCarousel.unlockBadge("freshStart");
        debugPrint("Fresh Start badge unlocked - restarted after " + context.previousStreak + " day streak");
    }
}

// ===== Unstable Energy Badge =====

function checkUnstableEnergy() {
    var context = script.streakController.getMemoContext();

    // Check for "unstable" patterns:
    // 1. Highly variable response times (one user much faster/slower than other)
    // 2. Streak has been broken multiple times
    // 3. Unusual activity patterns

    // Check response time variance
    var currentStats = context.currentUserStats;
    var otherStats = context.otherUserStats;

    if (currentStats && otherStats && 
        currentStats.responseCount > 3 && otherStats.responseCount > 3) {

        var currentAvg = currentStats.totalResponseTime / currentStats.responseCount;
        var otherAvg = otherStats.totalResponseTime / otherStats.responseCount;

        // If response times differ by more than 5x, that's unstable energy
        var ratio = Math.max(currentAvg, otherAvg) / Math.max(Math.min(currentAvg, otherAvg), 1);
        if (ratio > 5) {
            script.badgeCarousel.unlockBadge("unstableEnergy");
            debugPrint("Unstable Energy badge unlocked - response time ratio: " + ratio.toFixed(2));
            return;
        }
    }

    // If streak was broken and previous streak was decent (5+), that's unstable
    if (context.streakBroken && context.previousStreak >= 5) {
        script.badgeCarousel.unlockBadge("unstableEnergy");
        debugPrint("Unstable Energy badge unlocked - streak broken after " + context.previousStreak);
        return;
    }

    // Multiple rounds in one day shows intense/unstable usage
    if (context.roundsCompletedToday >= 5) {
        script.badgeCarousel.unlockBadge("unstableEnergy");
        debugPrint("Unstable Energy badge unlocked - " + context.roundsCompletedToday + " rounds today");
    }
}

// ===== Where'd You Go Badge (Face Tracking) =====

function onFaceFound() {
    if (faceLostTime !== null) {
        var elapsed = getTime() - faceLostTime;
        if (elapsed >= 5) {
            script.badgeCarousel.unlockBadge("wheredYouGo");
            debugPrint("Where'd You Go badge unlocked - face lost for " + elapsed.toFixed(1) + "s");
        }
        faceLostTime = null;
    }
}

function onFaceLost() {
    faceLostTime = getTime();
}

// ===== Secret Badge (Long Press) =====

var secretHoldEvent = null;

function onTouchStart(eventData) {
    // Cancel any existing delayed event
    if (secretHoldEvent) {
        secretHoldEvent.enabled = false;
        secretHoldEvent = null;
    }

    // Create delayed event that fires after 10 seconds
    secretHoldEvent = script.createEvent("DelayedCallbackEvent");
    secretHoldEvent.bind(function() {
        script.badgeCarousel.unlockBadge("secretBadge");
        debugPrint("Secret badge unlocked - held for 10s");
        secretHoldEvent = null;
    });
    secretHoldEvent.reset(10);
}

function onTouchEnd(eventData) {
    // Cancel the delayed event if touch ends before 10 seconds
    if (secretHoldEvent) {
        secretHoldEvent.enabled = false;
        secretHoldEvent = null;
    }
}

// ===== Initialize =====

script.createEvent("OnStartEvent").bind(init);

// ===== Debug =====

function debugPrint(text, force) {
    if (!force && !script.debug) return;
    var newLog = (script.debugName || self.name) + ": " + text;
    if (global.textLogger) global.logToScreen(newLog);
    if (script.debugText) script.debugText.text = newLog;
    print(newLog);
}