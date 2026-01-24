// MemoController.js
// Version: 1.1.0
// Description: Generates witty, context-aware memos based on streak data, time of day,
//              holidays, and user behavior. Prioritizes messages by importance and
//              fills an array of text components with relevant messages.
// Author: Bennyp3333 [https://benjamin-p.dev]
//

// @input Component.ScriptComponent streakController {"label": "Streak Controller"}
// @input Component.Text[] memoTextComponents {"label": "Memo Text Components", "hint": "Array of text components, index 0 = highest priority"}
// @input float memoCycleDelay = 3.0 {"label": "Memo Cycle Delay (sec)"}

// @ui {"widget": "separator"}
// @ui {"widget": "label", "label": "Debug"}
// @input bool printDebugStatements = false {"label": "Print Debug Statements"}

// ===== Constants =====

var PRIORITY_CRITICAL = 100;    // Birthday, major milestones
var PRIORITY_HIGH = 80;         // Streak broken, holidays
var PRIORITY_MEDIUM = 60;       // Time-based, response patterns
var PRIORITY_LOW = 40;          // Generic encouragement
var PRIORITY_FILLER = 20;       // Random fun facts

// ===== State =====

var cachedContext = null;
var generatedMemos = [];
//var userBirthday = null; // Will be populated from userContextSystem

var currentMemo = 0;
var filledMemoCount = 0;


// ===== Debug Functions =====

function printDebug(message) {
    if (script.printDebugStatements) {
        var newLog = "[MemoController] " + message;
        if (global.textLogger) {
            global.logToScreen(newLog);
        }
        print(newLog);
    }
}

function printWarning(message) {
    var warningLog = "[MemoController WARNING] " + message;
    if (global.textLogger) {
        global.logError(warningLog);
    }
    print(warningLog);
}

// ===== Initialization =====

script.createEvent('OnStartEvent').bind(function() {
    if (!script.streakController) {
        printWarning('Streak Controller not assigned!');
        return;
    }
    /*
    // Try to get user birthday from system
    if (global.userContextSystem && global.userContextSystem.requestBirthdateFormatted) {
        global.userContextSystem.requestBirthdateFormatted(function(birthdate) {
            if (birthdate) {
                userBirthday = birthdate;
                printDebug('Got user birthday: ' + birthdate);
            }
        });
    }
    */
    // Subscribe to streak ready event
    script.streakController.onReady(function(data) {
        printDebug('Streak ready, generating memos');
        refreshMemos();
    });
    
    // Subscribe to streak changes
    script.streakController.onStreakChanged(function(data) {
        printDebug('Streak changed, refreshing memos');
        refreshMemos();
    });
    
    printDebug('Initialized');
});

// ===== Main Functions =====

function refreshMemos() {
    cachedContext = script.streakController.getMemoContext();
    if (!cachedContext || !cachedContext.isInitialized) {
        printDebug('Context not ready');
        return;
    }
    
    // Generate all applicable memos
    generatedMemos = generateAllMemos(cachedContext);
    
    // Sort by priority (highest first)
    generatedMemos.sort(function(a, b) {
        return b.priority - a.priority;
    });
    
    printDebug('Generated ' + generatedMemos.length + ' memos');
    
    // Apply to text components
    applyMemosToComponents();

    startMemoCycle();
}

function applyMemosToComponents() {
    if (!script.memoTextComponents || script.memoTextComponents.length === 0) {
        printDebug('No text components assigned');
        return;
    }
    
    for (var i = 0; i < script.memoTextComponents.length; i++) {
        var textComp = script.memoTextComponents[i];
        if (!textComp) continue;
        
        if (i < generatedMemos.length) {
            textComp.text = generatedMemos[i].text;
            printDebug('Slot ' + i + ' [P:' + generatedMemos[i].priority + ']: ' + generatedMemos[i].text);
        } else {
            textComp.text = '';
        }
    }
}

var memoDelay = script.createEvent("DelayedCallbackEvent");
memoDelay.bind(showNextMemo);

function countFilledMemos() {
    filledMemoCount = 0;
    for (var i = 0; i < script.memoTextComponents.length; i++) {
        if (script.memoTextComponents[i] && script.memoTextComponents[i].text !== '') {
            filledMemoCount++;
        } else {
            break; // Stop at first empty since they're sorted by priority
        }
    }
    return filledMemoCount;
}

function showNextMemo() {
    // Hide current memo
    global.faderManager.hide(script.memoTextComponents[currentMemo].getSceneObject());
    
    // Move to next memo
    currentMemo = (currentMemo + 1) % filledMemoCount;
    
    // Show next memo
    global.faderManager.show(script.memoTextComponents[currentMemo].getSceneObject());
    
    // Only continue cycling if there's more than one filled memo
    if (filledMemoCount > 1) {
        memoDelay.reset(script.memoCycleDelay); // Add @input float memoCycleDelay = 3.0 to your inputs
    }
}

function startMemoCycle() {
    countFilledMemos();
    
    if (filledMemoCount === 0) {
        printDebug('No memos to display');
        return;
    }
    
    // Show first memo
    currentMemo = 0;
    global.faderManager.show(script.memoTextComponents[currentMemo].getSceneObject());
    
    // Only start cycling if there's more than one
    if (filledMemoCount > 1) {
        memoDelay.reset(script.memoCycleDelay);
    }
}

// ===== Memo Generation =====

function generateAllMemos(ctx) {
    var memos = [];
    var now = new Date();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    var hour = ctx.hourOfDay;
    var dayOfWeek = now.getDay(); // 0 = Sunday
    
    // Helper to add memo
    function add(priority, text) {
        if (text && text.length > 0) {
            memos.push({ priority: priority, text: text });
        }
    }
    
    // Helper to pick one random message from array and add it
    function addOne(priority, messages) {
        if (messages && messages.length > 0) {
            var picked = messages[Math.floor(Math.random() * messages.length)];
            add(priority, picked);
        }
    }
    
    // ===== ZERO STREAK - STARTER MESSAGE ONLY =====
    
    if (ctx.currentStreak === 0 && ctx.totalSnaps === 0) {
        addOne(PRIORITY_CRITICAL, [
            "Snap a friend to start a streak!",
            "Send a snap to begin your streak! 🔥",
            "Ready to start a streak? 📸",
            "Your streak journey starts here!",
            "First snap = first step! 🚀",
            "Let's get this streak started!",
            "No streak yet? Let's fix that! 📷",
            "Start your streak adventure! ✨",
            "Snap to ignite the streak! 🔥",
            "Begin your streak legacy today!"
        ]);
        return memos; // Early return - no other messages needed
    }
    
    // ===== CRITICAL PRIORITY (100) =====
    /*
    // Birthday check
    var isBirthday = false;
    if (userBirthday) {
        var bMonth = userBirthday.getMonth() + 1;
        var bDay = userBirthday.getDate();
        isBirthday = (month === bMonth && day === bDay);
    }
    
    if (isBirthday) {
        addOne(PRIORITY_CRITICAL, [
            "🎂 HAPPY BIRTHDAY! 🎉",
            "🎈 It's YOUR day! Happy Birthday!",
            "🎁 Birthday snap! Make a wish!",
            "🥳 Happy Birthday legend!",
            "🎂 Another year more iconic!"
        ]);
    }
    */
    // Major streak milestones (only one message per milestone)
    if (ctx.currentStreak === 69) {
        addOne(PRIORITY_CRITICAL, ["Nice. 😏", "Nice.", "Nice 😎", "Niiiice."]);
    } else if (ctx.currentStreak === 100) {
        addOne(PRIORITY_CRITICAL, [
            "🔥 100 DAYS! You're officially obsessed!",
            "💯 TRIPLE DIGITS BABY!",
            "🔥 100! Centurion status!",
            "💯 The big 1-0-0!"
        ]);
    } else if (ctx.currentStreak === 365) {
        addOne(PRIORITY_CRITICAL, [
            "🏆 ONE FULL YEAR! Legendary!",
            "📅 365 days! That's a whole year!",
            "🎖️ Annual streak achieved!",
            "👑 One year of pure dedication!"
        ]);
    } else if (ctx.currentStreak === 420) {
        addOne(PRIORITY_CRITICAL, ["Blaze it! 🌿", "420 blaze it 🔥", "Ayyyy 420! 🌿"]);
    } else if (ctx.currentStreak === 500) {
        addOne(PRIORITY_CRITICAL, ["👑 500 DAYS! Absolute legends!", "🏅 Half a thousand days!", "500! Halfway to 1000!"]);
    } else if (ctx.currentStreak === 666) {
        addOne(PRIORITY_CRITICAL, ["😈 Devilishly dedicated!", "666... spooky streak! 👹", "The devil's streak 😈"]);
    } else if (ctx.currentStreak === 777) {
        addOne(PRIORITY_CRITICAL, ["🎰 JACKPOT! Lucky 777!", "Triple 7s! 🍀", "777! Feeling lucky!"]);
    } else if (ctx.currentStreak === 1000) {
        addOne(PRIORITY_CRITICAL, ["🌟 1000 DAYS?! This is true love!", "👑 ONE THOUSAND! Bow down!", "🏆 1K streak! Immortal status!"]);
    }
    
    // ===== HIGH PRIORITY (80) =====
    
    // Streak broken
    if (ctx.streakBroken) {
        addOne(PRIORITY_HIGH, [
            ctx.streakBrokenBy + " broke the streak 💔",
            "💔 " + ctx.streakBrokenBy + " let it slip...",
            ctx.streakBrokenBy + "... we need to talk 💔",
            "Blame " + ctx.streakBrokenBy + " 👀"
        ]);
        addOne(PRIORITY_HIGH - 5, [
            "RIP " + ctx.previousStreak + " day streak",
            ctx.previousStreak + " days... gone 😢",
            "We lost " + ctx.previousStreak + " days 💀"
        ]);
        if (ctx.previousStreak > 50) {
            addOne(PRIORITY_HIGH - 3, [
                "That's gonna leave a mark...",
                "Ouch. That one hurt.",
                "Pain. Just pain. 💀"
            ]);
        }
    }
    
    // Holidays (one message per holiday)
    if (month === 1 && day === 1) {
        addOne(PRIORITY_HIGH, [
            "🎆 Happy New Year!",
            "🎊 New year, same streak energy!",
            "🥂 Cheers to a new year of streaks!"
        ]);
    } else if (month === 2 && day === 14) {
        addOne(PRIORITY_HIGH, [
            "💘 Happy Valentine's Day!",
            "💕 Your streak is your real valentine",
            "❤️ Roses are red, streaks are fire",
            "💝 Love is keeping the streak alive"
        ]);
    } else if (month === 3 && day === 17) {
        addOne(PRIORITY_HIGH, [
            "☘️ Happy St. Patrick's Day!",
            "🍀 Feeling lucky with this streak!",
            "☘️ May the luck be with your streak!"
        ]);
    } else if (month === 4 && day === 1) {
        addOne(PRIORITY_HIGH, [
            "🃏 April Fools! ...but this streak is no joke",
            "🤡 Pranks are temporary, streaks are forever",
            "🃏 No fooling around with this streak!"
        ]);
    } else if (month === 7 && day === 4) {
        addOne(PRIORITY_HIGH, [
            "🇺🇸 Happy 4th of July!",
            "🎆 Freedom to snap!",
            "🦅 Independence Day streak!"
        ]);
    } else if (month === 10 && day === 31) {
        addOne(PRIORITY_HIGH, [
            "🎃 Happy Halloween!",
            "👻 Don't ghost your streak!",
            "🦇 Spooky streak season!",
            "💀 Scary good streak!"
        ]);
    } else if (month === 12 && day === 25) {
        addOne(PRIORITY_HIGH, [
            "🎄 Merry Christmas!",
            "🎁 The gift of streak!",
            "⛄ Ho ho ho! Streak goals!",
            "🎅 Santa approves this streak!"
        ]);
    } else if (month === 12 && day === 31) {
        addOne(PRIORITY_HIGH, [
            "🥂 Happy New Year's Eve!",
            "🎆 One more snap before midnight!",
            "✨ End the year right!"
        ]);
    }
    
    // Streak milestone ranges (one message)
    if (ctx.currentStreak === 7) {
        addOne(PRIORITY_HIGH, ["📅 One week strong!", "7 days! A full week!", "Week one complete! 💪"]);
    } else if (ctx.currentStreak === 14) {
        addOne(PRIORITY_HIGH, ["📅 Two weeks! Getting serious!", "14 days! Fortnight streak!", "Two weeks in! 🔥"]);
    } else if (ctx.currentStreak === 21) {
        addOne(PRIORITY_HIGH, ["🧠 21 days! It's officially a habit!", "3 weeks! Habit formed!", "21 days of dedication!"]);
    } else if (ctx.currentStreak === 30) {
        addOne(PRIORITY_HIGH, ["📆 One month! Impressive!", "30 days! Monthly milestone!", "A whole month! 🎉"]);
    } else if (ctx.currentStreak === 50) {
        addOne(PRIORITY_HIGH, ["🔥 50 days! Halfway to 100!", "Half century streak! 💪", "50! The big 5-0!"]);
    } else if (ctx.currentStreak === 200) {
        addOne(PRIORITY_HIGH, ["⭐ 200 days of pure dedication!", "200! Double century!", "Two hundred days strong!"]);
    } else if (ctx.currentStreak === 300) {
        addOne(PRIORITY_HIGH, ["🏅 300 days! This is Sparta!", "300! Legendary status!", "Three hundred! 💪"]);
    }
    
    // ===== MEDIUM PRIORITY (60) =====
    
    // Time of day messages (one message per time slot)
    if (hour >= 1 && hour < 4) {
        addOne(PRIORITY_MEDIUM, [
            "Feeling flirty? 😏",
            "Late night snap vibes 🌙",
            "Can't sleep without snapping?",
            "Night owl energy 🦉",
            "The dedication at " + hour + "am tho",
            "Up late thinking about streaks 😏",
            "Midnight snapper 🌙"
        ]);
    } else if (hour >= 4 && hour < 6) {
        addOne(PRIORITY_MEDIUM, [
            "Early bird gets the streak! 🐦",
            "Up before the sun for this ☀️",
            "That's commitment right there",
            "Dawn patrol! 🌅"
        ]);
    } else if (hour >= 6 && hour < 9) {
        addOne(PRIORITY_MEDIUM, [
            "Good morning! ☀️",
            "Rise and snap! 🌅",
            "Starting the day right",
            "Morning streak check ✓"
        ]);
    } else if (hour >= 12 && hour < 14) {
        addOne(PRIORITY_MEDIUM, [
            "Lunch break snap! 🍕",
            "Midday streak maintenance",
            "Noon snap! ☀️"
        ]);
    } else if (hour >= 17 && hour < 19) {
        addOne(PRIORITY_MEDIUM, [
            "After work snap session!",
            "Clock out, snap in ⏰",
            "Evening streak check!"
        ]);
    } else if (hour >= 22 && hour < 24) {
        addOne(PRIORITY_MEDIUM, [
            "Almost forgot? 😅",
            "Just in time!",
            "Cutting it close there",
            "End of day snap! 🌙"
        ]);
    }
    
    // Day of week (one message)
    if (dayOfWeek === 1) {
        addOne(PRIORITY_MEDIUM - 10, ["Monday motivation! 💪", "New week, same streak energy", "Monday? More like Snapday"]);
    } else if (dayOfWeek === 5) {
        addOne(PRIORITY_MEDIUM - 10, ["TGIF! 🎉", "Friday vibes! 🥳", "Weekend streak incoming"]);
    } else if (dayOfWeek === 0 || dayOfWeek === 6) {
        addOne(PRIORITY_MEDIUM - 10, ["Weekend vibes ✨", "Weekend warrior! 🏆", "Relaxed streak day"]);
    } else if (dayOfWeek === 3) {
        addOne(PRIORITY_MEDIUM - 10, ["Hump day! 🐪", "Halfway through the week!", "Wednesday wins!"]);
    }
    
    // Time remaining warnings (one message per urgency level)
    var hoursRemaining = ctx.timeRemainingMs / (1000 * 60 * 60);
    if (hoursRemaining !== Infinity && !isNaN(hoursRemaining)) {
        if (hoursRemaining < 1) {
            addOne(PRIORITY_MEDIUM + 15, [
                "⚠️ LESS THAN 1 HOUR LEFT!",
                "🚨 SNAP NOW! Time's almost up!",
                "⏰ URGENT! Under 1 hour!",
                "😱 Quick! Almost out of time!"
            ]);
        } else if (hoursRemaining < 3) {
            addOne(PRIORITY_MEDIUM + 10, [
                "⏰ Only " + Math.floor(hoursRemaining) + "h left!",
                "Time is ticking! " + Math.floor(hoursRemaining) + "h left",
                "⚠️ " + Math.floor(hoursRemaining) + " hours remaining!"
            ]);
        } else if (hoursRemaining < 6) {
            addOne(PRIORITY_MEDIUM + 5, [
                Math.floor(hoursRemaining) + " hours to keep it alive",
                "⏰ " + Math.floor(hoursRemaining) + "h on the clock"
            ]);
        }
    }
    
    // Response time patterns (one message)
    if (ctx.lastResponseTimeMs) {
        var lastResponseHours = ctx.lastResponseTimeMs / (1000 * 60 * 60);
        if (lastResponseHours < 0.1) {
            addOne(PRIORITY_MEDIUM, [
                "Speed demon! ⚡ That was fast!",
                "Were you just waiting? 👀",
                "Lightning quick response! ⚡",
                "Instant reply energy!"
            ]);
        } else if (lastResponseHours < 1) {
            addOne(PRIORITY_MEDIUM - 5, ["Quick response! Nice!", "Speedy! 🏃", "Fast fingers! ⚡"]);
        } else if (lastResponseHours > 20) {
            addOne(PRIORITY_MEDIUM, ["Cutting it close! 😰", "Just under the wire!", "Close call! 😅"]);
        }
    }
    
    // Who breaks more streaks (one message)
    if (ctx.whoBreaksMore && !ctx.whoBreaksMore.tie) {
        addOne(PRIORITY_MEDIUM - 5, [
            ctx.whoBreaksMore.displayName + " has broken " + ctx.whoBreaksMore.count + " streaks 👀",
            "Streak breaker alert: " + ctx.whoBreaksMore.displayName + " (" + ctx.whoBreaksMore.count + "x)",
            ctx.whoBreaksMore.displayName + "... " + ctx.whoBreaksMore.count + " broken streaks... 🤨"
        ]);
    }
    
    // Multiple rounds today (one message)
    if (ctx.roundsCompletedToday > 1) {
        if (ctx.roundsCompletedToday >= 5) {
            addOne(PRIORITY_MEDIUM, [
                "Y'all are on FIRE today! 🔥",
                ctx.roundsCompletedToday + " snaps today! Obsessed!",
                "Can't stop won't stop! " + ctx.roundsCompletedToday + " today!"
            ]);
        } else {
            addOne(PRIORITY_MEDIUM - 5, [
                ctx.roundsCompletedToday + " snaps today! Chatty!",
                "Round " + ctx.roundsCompletedToday + " today!",
                "Back for more! (#" + ctx.roundsCompletedToday + " today)"
            ]);
        }
    }
    
    // ===== LOW PRIORITY (40) =====
    
    // Current streak announcement (one message)
    if (!ctx.streakBroken && ctx.currentStreak > 0) {
        addOne(PRIORITY_LOW + 5, [
            "You made it to day " + ctx.currentStreak + "!",
            ctx.currentStreak + " days and counting!",
            "Day " + ctx.currentStreak + " complete! ✓",
            ctx.currentStreak + " day streak! 🔥"
        ]);
    }
    
    // Close to record (one message)
    if (ctx.longestStreak > ctx.currentStreak && ctx.longestStreak > 10) {
        var diff = ctx.longestStreak - ctx.currentStreak;
        if (diff <= 5 && diff > 0) {
            addOne(PRIORITY_LOW + 8, [
                "Only " + diff + " days from your record!",
                diff + " days to beat your best!",
                "So close to your record! (" + diff + " away)"
            ]);
        } else if (diff <= 10) {
            addOne(PRIORITY_LOW, ["Record to beat: " + ctx.longestStreak + " days", ctx.longestStreak + " is the number to beat"]);
        }
    }
    
    // Currently at longest streak (one message)
    if (ctx.currentStreak > 0 && ctx.currentStreak === ctx.longestStreak && ctx.currentStreak > 5) {
        addOne(PRIORITY_LOW + 10, [
            "🏆 This IS your longest streak!",
            "New record territory! 🏆",
            "Personal best! Keep going!"
        ]);
    }
    
    // Day 1 celebration (one message)
    if (ctx.currentStreak === 1) {
        addOne(PRIORITY_LOW + 10, [
            "Day 1! Let's gooo!",
            "The journey begins!",
            "Streak started! 🔥",
            "And so it begins...",
            "First day down! 💪",
            "Day 1 locked in! ✓"
        ]);
    }
    
    // Streak-based encouragement (one message per range)
    if (ctx.currentStreak > 1 && ctx.currentStreak < 7) {
        addOne(PRIORITY_LOW - 5, [
            "Building momentum!",
            "Every streak starts somewhere",
            "Keep it going!",
            "Good start! 💪"
        ]);
    } else if (ctx.currentStreak >= 7 && ctx.currentStreak < 30) {
        addOne(PRIORITY_LOW - 5, [
            "You're on a roll!",
            "Streak game strong 💪",
            "Solid streak! 🔥"
        ]);
    } else if (ctx.currentStreak >= 30 && ctx.currentStreak < 100) {
        addOne(PRIORITY_LOW - 5, [
            "Veteran streakers!",
            "This is getting serious",
            "Committed! 💯"
        ]);
    } else if (ctx.currentStreak >= 100) {
        addOne(PRIORITY_LOW - 5, [
            "Elite status 👑",
            "Teach us your ways",
            "Streak royalty 👑"
        ]);
    }
    
    // Total snaps milestones (one message)
    if (ctx.totalSnaps === 100) {
        addOne(PRIORITY_LOW + 5, ["100 total snaps! 📸", "Century of snaps!", "100 snaps in the books!"]);
    } else if (ctx.totalSnaps === 500) {
        addOne(PRIORITY_LOW + 5, ["500 snaps! Prolific!", "Half a thousand snaps!", "500 memories made!"]);
    } else if (ctx.totalSnaps === 1000) {
        addOne(PRIORITY_LOW + 5, ["1000 snaps! Photographers!", "1K snaps! 📸", "A thousand moments!"]);
    }
    
    // Special number patterns (one message)
    var streakStr = ctx.currentStreak.toString();
    if (streakStr.length >= 2 && streakStr.split('').every(function(c) { return c === streakStr[0]; })) {
        addOne(PRIORITY_MEDIUM - 5, [
            "✨ " + ctx.currentStreak + "! Repeating digits!",
            ctx.currentStreak + "! Satisfying number ✨",
            "Ooh " + ctx.currentStreak + "! Pattern streak!"
        ]);
    }
    if (ctx.currentStreak > 10 && isPalindrome(ctx.currentStreak)) {
        addOne(PRIORITY_MEDIUM - 5, [
            "🪞 " + ctx.currentStreak + "! Palindrome!",
            ctx.currentStreak + "! Same forwards & backwards!",
            "Mirror number: " + ctx.currentStreak + "! 🪞"
        ]);
    }
    if (isPrime(ctx.currentStreak) && ctx.currentStreak > 20) {
        addOne(PRIORITY_FILLER + 5, [
            "🔢 " + ctx.currentStreak + " is prime!",
            "Prime number streak: " + ctx.currentStreak,
            "Math nerds: " + ctx.currentStreak + " is prime!"
        ]);
    }
    if (isFibonacci(ctx.currentStreak) && ctx.currentStreak > 8) {
        addOne(PRIORITY_FILLER + 5, [
            "🐚 " + ctx.currentStreak + "! Fibonacci!",
            "Golden ratio streak: " + ctx.currentStreak,
            ctx.currentStreak + "! Nature's number!"
        ]);
    }
    
    // ===== FILLER PRIORITY (20) =====
    
    // User name personalization (one message)
    if (ctx.currentUserDisplayName) {
        addOne(PRIORITY_FILLER + 5, [
            "Hey " + ctx.currentUserDisplayName + "! 👋",
            "What's good " + ctx.currentUserDisplayName + "!",
            ctx.currentUserDisplayName + " in the house! 🏠"
        ]);
    }
    if (ctx.otherUserDisplayName && ctx.currentUserDisplayName) {
        addOne(PRIORITY_FILLER, [
            ctx.currentUserDisplayName + " + " + ctx.otherUserDisplayName + " = 🔥",
            "Iconic duo: " + ctx.currentUserDisplayName + " & " + ctx.otherUserDisplayName,
            ctx.otherUserDisplayName + " is lucky to have you"
        ]);
    }
    
    // Generic fun messages (one message per category)
    addOne(PRIORITY_FILLER - 5, [
        "Snap snap snap! 📷",
        "Keeping the flame alive 🔥",
        "Friendship goals ✨",
        "Stay connected!",
        "Another day, another snap",
        "Consistency is key 🔑",
        "You got this!",
        "Keep calm and streak on"
    ]);
    
    // Gen-Z speak (one message)
    addOne(PRIORITY_FILLER - 10, [
        "Touch grass? Nah, touch snap 📱",
        "Main character energy 💅",
        "Slay! 💃",
        "No thoughts, just vibes",
        "Understood the assignment ✓",
        "This hits different",
        "Core memory unlocked 🧠",
        "It's giving... dedication",
        "Ate and left no crumbs 💅",
        "Periodt.",
        "Not you being consistent!",
        "Real ones snap back",
        "Legend behavior",
        "The vibes are immaculate"
    ]);
    
    // Encouragement (one message)
    addOne(PRIORITY_FILLER - 15, [
        "Proud of you! 🥹",
        "Doing amazing sweetie",
        "This is your sign to keep going",
        "Future you thanks present you",
        "Small steps, big streaks",
        "You're crushing it!",
        "Keep being awesome 🌟"
    ]);
    
    return memos;
}

// ===== Utility Functions =====

function isPalindrome(num) {
    var str = num.toString();
    return str === str.split('').reverse().join('');
}

function isPrime(num) {
    if (num < 2) return false;
    if (num === 2) return true;
    if (num % 2 === 0) return false;
    for (var i = 3; i <= Math.sqrt(num); i += 2) {
        if (num % i === 0) return false;
    }
    return true;
}

function isFibonacci(num) {
    if (num <= 0) return false;
    var fibs = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];
    return fibs.indexOf(num) !== -1;
}

// ===== Public API =====

// Force refresh memos
script.refresh = function() {
    refreshMemos();
};

// Get all generated memos (for external use)
script.getMemos = function() {
    return generatedMemos.slice(); // Return copy
};

// Get memo at specific index
script.getMemo = function(index) {
    if (index >= 0 && index < generatedMemos.length) {
        return generatedMemos[index];
    }
    return null;
};

// Get number of generated memos
script.getMemoCount = function() {
    return generatedMemos.length;
};

// Manually set stage and refresh
script.setStageAndRefresh = function(stage) {
    if (script.streakController) {
        script.streakController.setStage(stage);
        refreshMemos();
    }
};