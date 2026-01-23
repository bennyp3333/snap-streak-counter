// StreakController.js
// Version: 1.0.0
// Description: Manages streak counting, statistics, and game state using the Turn Based component.
//              Tracks streaks between two users with a 24hr rolling window + grace period.
//              Provides APIs for stats display, memo context, and badge unlocking.
// Author: Bennyp3333 [https://benjamin-p.dev]
//

// @input Component.ScriptComponent turnBased {"label": "Turn Based Component"}
// @input Component.ScriptComponent badgeCarousel {"label": "Badge Carousel", "hint": "Optional - for unlocking streak badges"}

// @ui {"widget": "separator"}
// @ui {"widget": "label", "label": "Timing Configuration"}
// @input float streakWindowHours = 24 {"label": "Streak Window (hours)", "hint": "Time limit to respond before streak breaks"}
// @input float graceWindowHours = 4 {"label": "Grace Period (hours)", "hint": "Extra buffer time added to streak window"}

// @ui {"widget": "separator"}
// @ui {"widget": "label", "label": "Debug"}
// @input bool printDebugStatements = false {"label": "Print Debug Statements"}

// @ui {"widget": "separator"}
// @ui {"widget": "label", "label": "Testing Mode (Editor Only)"}
// @input bool enableTestingMode = false {"label": "Enable Testing Mode", "hint": "Bypasses 1-per-day limit and enables test controls"}
// @input bool forceStreakValue = false {"label": "Force Streak Value", "showIf": "enableTestingMode"}
// @input int forcedStreak = 0 {"label": "Forced Streak", "showIf": "forceStreakValue", "min": 0}
// @input bool forceStreakBroken = false {"label": "Force Streak Broken", "showIf": "enableTestingMode"}
// @input int brokenByUserIndex = 0 {"label": "Broken By User Index", "showIf": "forceStreakBroken", "min": 0, "max": 1}
// @input bool forceStats = false {"label": "Force Stats", "showIf": "enableTestingMode"}
// @input int forcedLongestStreak = 0 {"label": "Longest Streak", "showIf": "forceStats", "min": 0}
// @input int forcedTotalSnaps = 0 {"label": "Total Snaps", "showIf": "forceStats", "min": 0}
// @input int forcedUser0StreaksBroken = 0 {"label": "User 0 Streaks Broken", "showIf": "forceStats", "min": 0}
// @input int forcedUser1StreaksBroken = 0 {"label": "User 1 Streaks Broken", "showIf": "forceStats", "min": 0}
// @input bool forceTimeRemaining = false {"label": "Force Time Remaining", "showIf": "enableTestingMode"}
// @input float forcedHoursRemaining = 12 {"label": "Hours Remaining", "showIf": "forceTimeRemaining", "min": 0, "max": 28}

// ===== Constants =====

var STAGE_RECAP = 'recap';
var STAGE_CAPTURE = 'capture';

var MS_PER_HOUR = 1000 * 60 * 60;
var MS_PER_DAY = MS_PER_HOUR * 24;

// ===== State Variables =====

var isInitialized = false;
var hasTurnEnded = false;
var currentStage = STAGE_RECAP;
var currentUserIndex = -1;
var turnCount = 0;

// Cached stats for quick access
var cachedStreakStats = null;
var cachedCurrentUserStats = null;
var cachedOtherUserStats = null;
var cachedDisplayNames = { current: '', other: '' };

// Calculated values
var pendingStreakIncrement = false;
var streakBrokenThisTurn = false;
var previousStreakValue = 0;

// Event callbacks
var onStreakChangedCallbacks = [];
var onStreakBrokenCallbacks = [];
var onStreakReadyCallbacks = [];

// ===== Debug Functions =====

function printDebug(message) {
    if (script.printDebugStatements) {
        var newLog = '[StreakController] ' + message;
        if (global.textLogger) {
            global.logToScreen(newLog);
        }
        print(newLog);
    }
}

function printWarning(message) {
    var warningLog = '[StreakController WARNING] ' + message;
    if (global.textLogger) {
        global.logError(warningLog);
    }
    print(warningLog);
}

// ===== Testing Functions =====

function applyTestingOverrides() {
    if (!script.enableTestingMode) return;
    
    printDebug('Testing mode enabled - applying overrides');
    
    // Force streak value
    if (script.forceStreakValue) {
        var oldStreak = cachedStreakStats.currentStreak;
        cachedStreakStats.currentStreak = script.forcedStreak;
        previousStreakValue = Math.max(0, script.forcedStreak - 1);
        pendingStreakIncrement = true;
        printDebug('Forced streak to: ' + script.forcedStreak);
        
        // Update longest if needed
        if (cachedStreakStats.currentStreak > cachedStreakStats.longestStreak) {
            cachedStreakStats.longestStreak = cachedStreakStats.currentStreak;
        }
        
        // Trigger badge check for forced value
        checkStreakBadges(cachedStreakStats.currentStreak);
        
        // Fire streak changed callback
        if (oldStreak !== cachedStreakStats.currentStreak) {
            fireStreakChangedCallbacks(cachedStreakStats.currentStreak, oldStreak);
        }
    }
    
    // Force streak broken state
    if (script.forceStreakBroken) {
        streakBrokenThisTurn = true;
        previousStreakValue = cachedStreakStats.currentStreak;
        cachedStreakStats.lastStreakBrokenBy = script.brokenByUserIndex;
        printDebug('Forced streak broken by user: ' + script.brokenByUserIndex);
        
        // Fire streak broken callback
        fireStreakBrokenCallbacks(script.brokenByUserIndex, previousStreakValue);
    }
    
    // Force stats
    if (script.forceStats) {
        cachedStreakStats.longestStreak = script.forcedLongestStreak;
        cachedStreakStats.totalSnaps = script.forcedTotalSnaps;
        cachedStreakStats.user0StreaksBroken = script.forcedUser0StreaksBroken;
        cachedStreakStats.user1StreaksBroken = script.forcedUser1StreaksBroken;
        printDebug('Forced stats - Longest: ' + script.forcedLongestStreak + ', Snaps: ' + script.forcedTotalSnaps);
    }
    
    // Force time remaining (handled in getTimeRemainingMs)
    if (script.forceTimeRemaining) {
        printDebug('Forced time remaining: ' + script.forcedHoursRemaining + ' hours');
    }
}

// ===== Event Callback Helpers =====

function fireStreakChangedCallbacks(newStreak, oldStreak) {
    var eventData = {
        currentStreak: newStreak,
        previousStreak: oldStreak,
        longestStreak: cachedStreakStats.longestStreak,
        didIncrement: newStreak > oldStreak,
        didReset: newStreak < oldStreak
    };
    
    for (var i = 0; i < onStreakChangedCallbacks.length; i++) {
        try {
            onStreakChangedCallbacks[i](eventData);
        } catch (e) {
            printWarning('Error in onStreakChanged callback: ' + e);
        }
    }
}

function fireStreakBrokenCallbacks(brokenByUserIndex, streakLost) {
    var eventData = {
        brokenByUserIndex: brokenByUserIndex,
        brokenByName: brokenByUserIndex === currentUserIndex 
            ? cachedDisplayNames.current 
            : cachedDisplayNames.other,
        streakLost: streakLost
    };
    
    for (var i = 0; i < onStreakBrokenCallbacks.length; i++) {
        try {
            onStreakBrokenCallbacks[i](eventData);
        } catch (e) {
            printWarning('Error in onStreakBroken callback: ' + e);
        }
    }
}

function fireStreakReadyCallbacks() {
    var eventData = {
        currentStreak: cachedStreakStats.currentStreak,
        longestStreak: cachedStreakStats.longestStreak,
        streakBroken: streakBrokenThisTurn,
        currentUserIndex: currentUserIndex
    };
    
    for (var i = 0; i < onStreakReadyCallbacks.length; i++) {
        try {
            onStreakReadyCallbacks[i](eventData);
        } catch (e) {
            printWarning('Error in onStreakReady callback: ' + e);
        }
    }
}

// ===== Initialization =====

script.createEvent('OnStartEvent').bind(async function() {
    try {
        await initialize();
    } catch (e) {
        printWarning('Initialization failed: ' + e);
    }
});

// Automatically end turn when user captures a snap
script.createEvent('SnapRecordStopEvent').bind(function() {
    if (!isInitialized) return;
    printDebug('SnapRecordStopEvent - ending turn');
    script.endTurn();
});

script.createEvent('SnapImageCaptureEvent').bind(function() {
    if (!isInitialized) return;
    printDebug('SnapImageCaptureEvent - ending turn');
    script.endTurn();
});

async function initialize() {
    if (!script.turnBased) {
        printWarning('Turn Based component not assigned!');
        return;
    }

    // Listen for turn events
    script.turnBased.onTurnStart.add(onTurnStart);
    script.turnBased.onTurnEnd.add(onTurnEnd);
    script.turnBased.onGameOver.add(onGameOver);
    script.turnBased.onError.add(onError);

    printDebug('Initialized, waiting for turn start...');
}

// ===== Turn Event Handlers =====

async function onTurnStart(eventData) {
    printDebug('Turn started - User: ' + eventData.currentUserIndex + ', Turn: ' + eventData.turnCount);

    currentUserIndex = eventData.currentUserIndex;
    turnCount = eventData.turnCount;
    currentStage = STAGE_RECAP;
    hasTurnEnded = false;

    // Load display names
    cachedDisplayNames.current = await script.turnBased.getCurrentUserDisplayName();
    try {
        cachedDisplayNames.other = await script.turnBased.getOtherUserDisplayName();
    } catch (e) {
        cachedDisplayNames.other = 'Friend';
    }

    // Initialize or load stats
    await loadOrInitializeStats();

    // Process the turn - check timing, update streak
    await processTurn();

    // Apply any testing overrides (editor only)
    applyTestingOverrides();

    isInitialized = true;

    // Fire streak ready callbacks
    fireStreakReadyCallbacks();
    
    // Legacy callback support
    if (script.onStreakReady) {
        script.onStreakReady();
    }
}

function onTurnEnd() {
    printDebug('Turn ended');
}

function onGameOver() {
    printDebug('Game over');
}

function onError(errorData) {
    printWarning('Turn Based Error: ' + errorData.code + ' - ' + errorData.description);
}

// ===== Stats Management =====

async function loadOrInitializeStats() {
    // Load global stats (all async calls)
    var results = await Promise.all([
        script.turnBased.getGlobalVariable('currentStreak'),
        script.turnBased.getGlobalVariable('longestStreak'),
        script.turnBased.getGlobalVariable('totalSnaps'),
        script.turnBased.getGlobalVariable('streakStartTimestamp'),
        script.turnBased.getGlobalVariable('lastStreakBrokenBy'),
        script.turnBased.getGlobalVariable('user0StreaksBroken'),
        script.turnBased.getGlobalVariable('user1StreaksBroken'),
        script.turnBased.getGlobalVariable('lastRoundCompletedDate'),
        script.turnBased.getGlobalVariable('roundsCompletedToday')
    ]);

    cachedStreakStats = {
        currentStreak: results[0] || 0,
        longestStreak: results[1] || 0,
        totalSnaps: results[2] || 0,
        streakStartTimestamp: results[3] || Date.now(),
        lastStreakBrokenBy: results[4] !== undefined ? results[4] : -1,
        user0StreaksBroken: results[5] || 0,
        user1StreaksBroken: results[6] || 0,
        lastRoundCompletedDate: results[7] || '',
        roundsCompletedToday: results[8] || 0
    };

    // Load user stats
    cachedCurrentUserStats = await loadUserStats(currentUserIndex);
    var otherUserIndex = currentUserIndex === 0 ? 1 : 0;
    cachedOtherUserStats = await loadUserStats(otherUserIndex);

    previousStreakValue = cachedStreakStats.currentStreak;

    printDebug('Loaded global stats: ' + JSON.stringify(cachedStreakStats));
}

async function loadUserStats(userIndex) {
    var results = await Promise.all([
        script.turnBased.getUserVariable(userIndex, 'lastSendTimestamp'),
        script.turnBased.getUserVariable(userIndex, 'totalResponseTime'),
        script.turnBased.getUserVariable(userIndex, 'responseCount'),
        script.turnBased.getUserVariable(userIndex, 'fastestResponse')
    ]);

    var userStats = {
        lastSendTimestamp: results[0] || 0,
        totalResponseTime: results[1] || 0,
        responseCount: results[2] || 0,
        fastestResponse: results[3] || Infinity
    };

    printDebug('Loaded user ' + userIndex + ' stats: ' + JSON.stringify(userStats));

    return userStats
}

function saveGlobalStats() {
    script.turnBased.setGlobalVariable('currentStreak', cachedStreakStats.currentStreak);
    script.turnBased.setGlobalVariable('longestStreak', cachedStreakStats.longestStreak);
    script.turnBased.setGlobalVariable('totalSnaps', cachedStreakStats.totalSnaps);
    script.turnBased.setGlobalVariable('streakStartTimestamp', cachedStreakStats.streakStartTimestamp);
    script.turnBased.setGlobalVariable('lastStreakBrokenBy', cachedStreakStats.lastStreakBrokenBy);
    script.turnBased.setGlobalVariable('user0StreaksBroken', cachedStreakStats.user0StreaksBroken);
    script.turnBased.setGlobalVariable('user1StreaksBroken', cachedStreakStats.user1StreaksBroken);
    script.turnBased.setGlobalVariable('lastRoundCompletedDate', cachedStreakStats.lastRoundCompletedDate);
    script.turnBased.setGlobalVariable('roundsCompletedToday', cachedStreakStats.roundsCompletedToday);

    printDebug('Saved global stats: ' + JSON.stringify(cachedStreakStats));
}

function saveUserStats(userIndex, userStats) {
    script.turnBased.setUserVariable(userIndex, 'lastSendTimestamp', userStats.lastSendTimestamp);
    script.turnBased.setUserVariable(userIndex, 'totalResponseTime', userStats.totalResponseTime);
    script.turnBased.setUserVariable(userIndex, 'responseCount', userStats.responseCount);
    script.turnBased.setUserVariable(userIndex, 'fastestResponse', userStats.fastestResponse);

    printDebug('Loaded user ' + userIndex + ' stats: ' + JSON.stringify(userStats));
}

// ===== Turn Processing & Streak Logic =====

async function processTurn() {
    printDebug('Processing Turn');
    
    var now = Date.now();
    streakBrokenThisTurn = false;
    pendingStreakIncrement = false;

    // First turn ever - initialize
    if (turnCount === 0) {
        printDebug('First turn - initializing streak');
        cachedStreakStats.streakStartTimestamp = now;
        cachedStreakStats.currentStreak = 0;
        saveGlobalStats();
        return;
    }

    var previousTurnVars = await script.turnBased.getPreviousTurnVariables();

    // Get timing info from previous turn
    var prevSendTimestamp = previousTurnVars.sendTimestamp || 0;
    var prevSenderIndex = previousTurnVars.senderIndex !== undefined ? previousTurnVars.senderIndex : -1;

    if (prevSendTimestamp === 0) {
        printDebug('No previous send timestamp found');
        return;
    } else {
        printDebug('Previous time stamp: ' + prevSendTimestamp);
    }

    // Calculate response time
    var timeSinceLastSnap = now - prevSendTimestamp;
    var streakWindowMs = (script.streakWindowHours + script.graceWindowHours) * MS_PER_HOUR;

    printDebug('Time since last snap: ' + formatTime(timeSinceLastSnap) + ', Window: ' + formatTime(streakWindowMs));

    // Check if streak is broken (current user took too long to open)
    if (timeSinceLastSnap > streakWindowMs) {
        handleStreakBroken(currentUserIndex, prevSendTimestamp);
        return;
    }

    // Update response time stats for current user
    updateResponseTimeStats(timeSinceLastSnap);

    // Check if this completes a round (both users have sent)
    if (turnCount > 0) {
        checkAndIncrementStreak(now);
    }
}

function handleStreakBroken(userWhoWasLate, lastSnapTimestamp) {
    printDebug('Streak broken by user ' + userWhoWasLate + ' (took too long to respond)');

    var oldStreak = cachedStreakStats.currentStreak;
    
    streakBrokenThisTurn = true;
    previousStreakValue = cachedStreakStats.currentStreak;

    // Record who broke it
    cachedStreakStats.lastStreakBrokenBy = userWhoWasLate;
    if (userWhoWasLate === 0) {
        cachedStreakStats.user0StreaksBroken++;
    } else {
        cachedStreakStats.user1StreaksBroken++;
    }

    // Reset streak
    cachedStreakStats.currentStreak = 0;
    cachedStreakStats.streakStartTimestamp = Date.now();
    cachedStreakStats.lastRoundCompletedDate = '';
    cachedStreakStats.roundsCompletedToday = 0;

    saveGlobalStats();
    
    // Fire callbacks
    fireStreakBrokenCallbacks(userWhoWasLate, oldStreak);
    fireStreakChangedCallbacks(0, oldStreak);
}

function checkAndIncrementStreak(now) {
    // Get today's date string for comparison
    var todayDate = new Date(now).toDateString();
    var lastRoundDate = cachedStreakStats.lastRoundCompletedDate;

    // Reset daily round counter if it's a new day
    if (lastRoundDate !== todayDate) {
        cachedStreakStats.roundsCompletedToday = 0;
    }

    // Testing mode bypasses the 1-per-day limit
    var bypassDailyLimit = script.enableTestingMode;
    
    // Only increment streak once per day (matching Snapchat behavior) unless testing
    if (lastRoundDate !== todayDate || bypassDailyLimit) {
        var oldStreak = cachedStreakStats.currentStreak;
        
        pendingStreakIncrement = true;
        cachedStreakStats.currentStreak++;
        cachedStreakStats.roundsCompletedToday++;
        
        // Only update the date if not bypassing (so we can keep incrementing in test mode)
        if (!bypassDailyLimit) {
            cachedStreakStats.lastRoundCompletedDate = todayDate;
        }

        // Update longest streak
        if (cachedStreakStats.currentStreak > cachedStreakStats.longestStreak) {
            cachedStreakStats.longestStreak = cachedStreakStats.currentStreak;
        }

        printDebug('Streak incremented to ' + cachedStreakStats.currentStreak + (bypassDailyLimit ? ' (testing mode)' : ''));

        // Trigger badge unlock for streak milestones
        checkStreakBadges(cachedStreakStats.currentStreak);
        
        // Fire streak changed callback
        fireStreakChangedCallbacks(cachedStreakStats.currentStreak, oldStreak);
    } else {
        printDebug('Round completed but streak already incremented today');
        cachedStreakStats.roundsCompletedToday++;
    }

    saveGlobalStats();
}

function updateResponseTimeStats(responseTimeMs) {
    cachedCurrentUserStats.totalResponseTime += responseTimeMs;
    cachedCurrentUserStats.responseCount++;

    if (responseTimeMs < cachedCurrentUserStats.fastestResponse) {
        cachedCurrentUserStats.fastestResponse = responseTimeMs;
    }

    saveUserStats(currentUserIndex, cachedCurrentUserStats);
}

function checkStreakBadges(streak) {
    if (!script.badgeCarousel) return;

    // Just pass in the streak number - badgeCarousel.unlockBadge filters if badge exists
    script.badgeCarousel.unlockBadge(streak.toString());
    printDebug('Attempted badge unlock for streak: ' + streak);
}

// ===== Utility Functions =====

function formatTime(ms) {
    if (ms === Infinity || ms === null || isNaN(ms)) return null;

    var seconds = Math.floor(ms / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);

    if (hours > 0) {
        var remainingMinutes = minutes % 60;
        return hours + 'h ' + remainingMinutes + 'm';
    } else if (minutes > 0) {
        var remainingSeconds = seconds % 60;
        return minutes + 'm ' + remainingSeconds + 's';
    } else {
        return seconds + 's';
    }
}

// ===== Public API - Snap Actions =====

script.prepareSnapData = function() {
    var now = Date.now();

    // Update total snaps
    cachedStreakStats.totalSnaps++;
    saveGlobalStats();

    // Update this user's last send timestamp
    cachedCurrentUserStats.lastSendTimestamp = now;
    saveUserStats(currentUserIndex, cachedCurrentUserStats);

    // Set turn variables to pass to next user
    script.turnBased.setCurrentTurnVariable('sendTimestamp', now);
    script.turnBased.setCurrentTurnVariable('senderIndex', currentUserIndex);

    printDebug('Snap data prepared - timestamp: ' + now);
};

script.endTurn = function() {
    if (hasTurnEnded) {
        printDebug('Turn already ended, ignoring duplicate endTurn call');
        return;
    }
    
    hasTurnEnded = true;
    script.prepareSnapData();
    script.turnBased.endTurn();
};

// ===== Public API - Stage Management =====

script.setStage = function(stage) {
    if (stage === STAGE_RECAP || stage === STAGE_CAPTURE) {
        currentStage = stage;
        printDebug('Stage set to: ' + stage);
    }
};

script.getStage = function() {
    return currentStage;
};

script.STAGE_RECAP = STAGE_RECAP;
script.STAGE_CAPTURE = STAGE_CAPTURE;

// ===== Public API - Event Subscriptions =====

// Subscribe to streak changes (increment or reset)
// Callback receives: { currentStreak, previousStreak, longestStreak, didIncrement, didReset }
script.onStreakChanged = function(callback) {
    if (typeof callback === 'function') {
        onStreakChangedCallbacks.push(callback);
        printDebug('Registered onStreakChanged callback');
        
        // If already initialized, fire immediately with current state
        if (isInitialized && cachedStreakStats) {
            callback({
                currentStreak: cachedStreakStats.currentStreak,
                previousStreak: previousStreakValue,
                longestStreak: cachedStreakStats.longestStreak,
                didIncrement: pendingStreakIncrement,
                didReset: streakBrokenThisTurn
            });
        }
    }
    return script; // Allow chaining
};

// Subscribe to streak broken events
// Callback receives: { brokenByUserIndex, brokenByName, streakLost }
script.onStreakBroken = function(callback) {
    if (typeof callback === 'function') {
        onStreakBrokenCallbacks.push(callback);
        printDebug('Registered onStreakBroken callback');
        
        // If already initialized and streak was broken this turn, fire immediately
        if (isInitialized && streakBrokenThisTurn) {
            callback({
                brokenByUserIndex: cachedStreakStats.lastStreakBrokenBy,
                brokenByName: cachedStreakStats.lastStreakBrokenBy === currentUserIndex 
                    ? cachedDisplayNames.current 
                    : cachedDisplayNames.other,
                streakLost: previousStreakValue
            });
        }
    }
    return script; // Allow chaining
};

// Subscribe to streak ready event (fires when turn data is loaded)
// Callback receives: { currentStreak, longestStreak, streakBroken, currentUserIndex }
script.onReady = function(callback) {
    if (typeof callback === 'function') {
        onStreakReadyCallbacks.push(callback);
        printDebug('Registered onReady callback');
        
        // If already initialized, fire immediately
        if (isInitialized) {
            callback({
                currentStreak: cachedStreakStats.currentStreak,
                longestStreak: cachedStreakStats.longestStreak,
                streakBroken: streakBrokenThisTurn,
                currentUserIndex: currentUserIndex
            });
        }
    }
    return script; // Allow chaining
};

// Unsubscribe a callback
script.offStreakChanged = function(callback) {
    var index = onStreakChangedCallbacks.indexOf(callback);
    if (index > -1) {
        onStreakChangedCallbacks.splice(index, 1);
        printDebug('Unregistered onStreakChanged callback');
    }
    return script;
};

script.offStreakBroken = function(callback) {
    var index = onStreakBrokenCallbacks.indexOf(callback);
    if (index > -1) {
        onStreakBrokenCallbacks.splice(index, 1);
        printDebug('Unregistered onStreakBroken callback');
    }
    return script;
};

script.offReady = function(callback) {
    var index = onStreakReadyCallbacks.indexOf(callback);
    if (index > -1) {
        onStreakReadyCallbacks.splice(index, 1);
        printDebug('Unregistered onReady callback');
    }
    return script;
};

// ===== Public API - Stats Getters =====

script.getCurrentStreak = function() {
    return cachedStreakStats ? cachedStreakStats.currentStreak : 0;
};

script.getLongestStreak = function() {
    return cachedStreakStats ? cachedStreakStats.longestStreak : 0;
};

script.getTotalSnaps = function() {
    return cachedStreakStats ? cachedStreakStats.totalSnaps : 0;
};

script.getPreviousStreak = function() {
    return previousStreakValue;
};

script.wasStreakBroken = function() {
    return streakBrokenThisTurn;
};

script.didStreakIncrement = function() {
    return pendingStreakIncrement;
};

script.getStreakBrokenByName = function() {
    if (!streakBrokenThisTurn) return null;
    return cachedStreakStats.lastStreakBrokenBy === currentUserIndex
        ? cachedDisplayNames.current
        : cachedDisplayNames.other;
};

// ===== Public API - Time Remaining =====

script.getTimeRemainingMs = function() {
    // Testing override
    if (script.enableTestingMode && script.forceTimeRemaining) {
        return script.forcedHoursRemaining * MS_PER_HOUR;
    }
    
    if (!cachedOtherUserStats || cachedOtherUserStats.lastSendTimestamp === 0) {
        return Infinity; // First turn, no deadline yet
    }

    var streakWindowMs = (script.streakWindowHours + script.graceWindowHours) * MS_PER_HOUR;
    var elapsed = Date.now() - cachedOtherUserStats.lastSendTimestamp;
    return Math.max(0, streakWindowMs - elapsed);
};

script.getTimeRemainingFormatted = function() {
    var remaining = script.getTimeRemainingMs();
    if (remaining === Infinity) return null;
    return formatTime(remaining);
};

// ===== Public API - Response Time Stats =====

script.getFastestResponse = async function() {
    var user0Stats = await loadUserStats(0);
    var user1Stats = await loadUserStats(1);

    var user0Fastest = user0Stats.fastestResponse === Infinity ? null : user0Stats.fastestResponse;
    var user1Fastest = user1Stats.fastestResponse === Infinity ? null : user1Stats.fastestResponse;
    
    var winnerId = null;
    var winnerTime = null;

    if (user0Fastest !== null && user1Fastest !== null) {
        if (user0Fastest <= user1Fastest) {
            winnerId = 0;
            winnerTime = user0Fastest;
        } else {
            winnerId = 1;
            winnerTime = user1Fastest;
        }
    } else if (user0Fastest !== null) {
        winnerId = 0;
        winnerTime = user0Fastest;
    } else if (user1Fastest !== null) {
        winnerId = 1;
        winnerTime = user1Fastest;
    }

    return {
        winnerId: winnerId,
        timeMs: winnerTime,
        timeFormatted: winnerTime ? formatTime(winnerTime) : null
    };
};

script.getAverageResponseTime = function(userIndex) {
    var stats = userIndex === currentUserIndex ? cachedCurrentUserStats : cachedOtherUserStats;
    if (!stats || stats.responseCount === 0) return null;

    var avgMs = stats.totalResponseTime / stats.responseCount;
    return {
        timeMs: avgMs,
        timeFormatted: formatTime(avgMs)
    };
};

script.getAverageResponseTimes = function() {
    return {
        currentUser: script.getAverageResponseTime(currentUserIndex),
        otherUser: script.getAverageResponseTime(currentUserIndex === 0 ? 1 : 0),
        user1: script.getAverageResponseTime(0),
        user2: script.getAverageResponseTime(1)
    };
};

// ===== Public API - User Info =====

script.getCurrentUserIndex = function() {
    return currentUserIndex;
};

script.getCurrentUserDisplayName = function() {
    return cachedDisplayNames.current;
};

script.getOtherUserDisplayName = function() {
    return cachedDisplayNames.other;
};

script.getStreaksBrokenCount = function(userIndex) {
    if (userIndex === 0) return cachedStreakStats.user0StreaksBroken;
    if (userIndex === 1) return cachedStreakStats.user1StreaksBroken;
    return 0;
};

script.getWhoBreaksMoreStreaks = function() {
    var u0 = cachedStreakStats.user0StreaksBroken;
    var u1 = cachedStreakStats.user1StreaksBroken;

    if (u0 === 0 && u1 === 0) return null;

    if (u0 > u1) {
        return {
            userIndex: 0,
            displayName: currentUserIndex === 0 ? cachedDisplayNames.current : cachedDisplayNames.other,
            count: u0
        };
    } else if (u1 > u0) {
        return {
            userIndex: 1,
            displayName: currentUserIndex === 1 ? cachedDisplayNames.current : cachedDisplayNames.other,
            count: u1
        };
    }

    return { tie: true, count: u0 };
};

// ===== Public API - Memo Context =====

script.getMemoContext = function() {
    var now = Date.now();
    var hourOfDay = new Date(now).getHours();

    // Calculate last response time (how long other user took)
    var lastResponseTimeMs = null;
    var prevTurnVars = script.turnBased.getPreviousTurnVariables
        ? script.turnBased.getPreviousTurnVariables()
        : null;

    if (prevTurnVars && prevTurnVars.sendTimestamp) {
        lastResponseTimeMs = prevTurnVars.responseTimeMs || null;
    }

    return {
        stage: currentStage,
        currentStreak: cachedStreakStats ? cachedStreakStats.currentStreak : 0,
        previousStreak: previousStreakValue,
        streakBroken: streakBrokenThisTurn,
        streakBrokenBy: script.getStreakBrokenByName(),
        timeRemainingMs: script.getTimeRemainingMs(),
        currentUserIndex: currentUserIndex,
        currentUserDisplayName: cachedDisplayNames.current,
        otherUserDisplayName: cachedDisplayNames.other,
        hourOfDay: hourOfDay,
        roundsCompletedToday: cachedStreakStats ? cachedStreakStats.roundsCompletedToday : 0,
        lastResponseTimeMs: lastResponseTimeMs,
        currentUserStats: cachedCurrentUserStats,
        otherUserStats: cachedOtherUserStats,
        longestStreak: cachedStreakStats ? cachedStreakStats.longestStreak : 0,
        totalSnaps: cachedStreakStats ? cachedStreakStats.totalSnaps : 0,
        whoBreaksMore: script.getWhoBreaksMoreStreaks(),
        isInitialized: isInitialized
    };
};

// ===== Public API - Full Stats Object =====

script.getFullStats = async function() {
    return {
        currentStreak: script.getCurrentStreak(),
        longestStreak: script.getLongestStreak(),
        totalSnaps: script.getTotalSnaps(),
        fastestResponse: await script.getFastestResponse(),
        averageResponseTimes: script.getAverageResponseTimes(),
        timeRemaining: script.getTimeRemainingFormatted(),
        whoBreaksMore: script.getWhoBreaksMoreStreaks()
    };
};

// ===== Public API - Testing Controls =====

// Manually set the streak (testing only)
script.testSetStreak = function(value) {
    if (!script.enableTestingMode) {
        printWarning('testSetStreak requires enableTestingMode to be true');
        return false;
    }
    
    var oldStreak = cachedStreakStats.currentStreak;
    cachedStreakStats.currentStreak = value;
    if (value > cachedStreakStats.longestStreak) {
        cachedStreakStats.longestStreak = value;
    }
    saveGlobalStats();
    checkStreakBadges(value);
    
    if (oldStreak !== value) {
        fireStreakChangedCallbacks(value, oldStreak);
    }
    
    printDebug('Test: Set streak to ' + value);
    return true;
};

// Manually increment the streak (testing only, bypasses daily limit)
script.testIncrementStreak = function() {
    if (!script.enableTestingMode) {
        printWarning('testIncrementStreak requires enableTestingMode to be true');
        return false;
    }
    
    var oldStreak = cachedStreakStats.currentStreak;
    cachedStreakStats.currentStreak++;
    if (cachedStreakStats.currentStreak > cachedStreakStats.longestStreak) {
        cachedStreakStats.longestStreak = cachedStreakStats.currentStreak;
    }
    pendingStreakIncrement = true;
    saveGlobalStats();
    checkStreakBadges(cachedStreakStats.currentStreak);
    
    fireStreakChangedCallbacks(cachedStreakStats.currentStreak, oldStreak);
    
    printDebug('Test: Incremented streak to ' + cachedStreakStats.currentStreak);
    return true;
};

// Manually trigger a streak break (testing only)
script.testBreakStreak = function(brokenByUserIndex) {
    if (!script.enableTestingMode) {
        printWarning('testBreakStreak requires enableTestingMode to be true');
        return false;
    }
    
    var userIndex = brokenByUserIndex !== undefined ? brokenByUserIndex : currentUserIndex;
    var oldStreak = cachedStreakStats.currentStreak;
    previousStreakValue = cachedStreakStats.currentStreak;
    streakBrokenThisTurn = true;
    cachedStreakStats.lastStreakBrokenBy = userIndex;
    
    if (userIndex === 0) {
        cachedStreakStats.user0StreaksBroken++;
    } else {
        cachedStreakStats.user1StreaksBroken++;
    }
    
    cachedStreakStats.currentStreak = 0;
    saveGlobalStats();
    
    fireStreakBrokenCallbacks(userIndex, oldStreak);
    fireStreakChangedCallbacks(0, oldStreak);
    
    printDebug('Test: Broke streak (was ' + previousStreakValue + '), blamed user ' + userIndex);
    return true;
};

// Reset all stats (testing only)
script.testResetAllStats = function() {
    if (!script.enableTestingMode) {
        printWarning('testResetAllStats requires enableTestingMode to be true');
        return false;
    }
    
    cachedStreakStats = {
        currentStreak: 0,
        longestStreak: 0,
        totalSnaps: 0,
        streakStartTimestamp: Date.now(),
        lastStreakBrokenBy: -1,
        user0StreaksBroken: 0,
        user1StreaksBroken: 0,
        lastRoundCompletedDate: '',
        roundsCompletedToday: 0
    };
    
    cachedCurrentUserStats = {
        lastSendTimestamp: 0,
        totalResponseTime: 0,
        responseCount: 0,
        fastestResponse: Infinity
    };
    
    cachedOtherUserStats = {
        lastSendTimestamp: 0,
        totalResponseTime: 0,
        responseCount: 0,
        fastestResponse: Infinity
    };
    
    previousStreakValue = 0;
    streakBrokenThisTurn = false;
    pendingStreakIncrement = false;
    
    saveGlobalStats();
    saveUserStats(0, cachedCurrentUserStats);
    saveUserStats(1, cachedOtherUserStats);
    
    printDebug('Test: Reset all stats');
    return true;
};

// Simulate multiple rounds quickly (testing only)
script.testSimulateRounds = function(numRounds) {
    if (!script.enableTestingMode) {
        printWarning('testSimulateRounds requires enableTestingMode to be true');
        return false;
    }
    
    var oldStreak = cachedStreakStats.currentStreak;
    
    for (var i = 0; i < numRounds; i++) {
        cachedStreakStats.currentStreak++;
        cachedStreakStats.totalSnaps += 2; // Both users send
        cachedStreakStats.roundsCompletedToday++;
        checkStreakBadges(cachedStreakStats.currentStreak);
    }
    
    if (cachedStreakStats.currentStreak > cachedStreakStats.longestStreak) {
        cachedStreakStats.longestStreak = cachedStreakStats.currentStreak;
    }
    
    pendingStreakIncrement = true;
    saveGlobalStats();
    
    fireStreakChangedCallbacks(cachedStreakStats.currentStreak, oldStreak);
    
    printDebug('Test: Simulated ' + numRounds + ' rounds, streak now ' + cachedStreakStats.currentStreak);
    return true;
};

// Print current state for debugging
script.testPrintState = function() {
    var state = {
        streak: cachedStreakStats.currentStreak,
        longest: cachedStreakStats.longestStreak,
        totalSnaps: cachedStreakStats.totalSnaps,
        user0Broken: cachedStreakStats.user0StreaksBroken,
        user1Broken: cachedStreakStats.user1StreaksBroken,
        streakBrokenThisTurn: streakBrokenThisTurn,
        previousStreak: previousStreakValue,
        currentUser: currentUserIndex,
        stage: currentStage
    };
    
    var stateStr = JSON.stringify(state, null, 2);
    printDebug('Current State:\n' + stateStr);
    print('[StreakController] Current State:\n' + stateStr);
    return state;
};

// ===== Public API - State Checks =====

script.isReady = function() {
    return isInitialized;
};