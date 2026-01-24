//@input Component.ScriptComponent streakController
//@input Asset.Material edgeMaterial
//@ui {"widget":"separator"}
//@input bool debug
//@input string debugName = "" {"showIf":"debug"}
//@input Component.Text debugText {"showIf":"debug"}

global.BaseTools(script);

var self = script.getSceneObject();
var selfTransform = self.getTransform();

function init() {
    script.streakController.onReady(function(data) {
        debugPrint('Streak ready, settting edge color');
        setEdgeColor(data.currentStreak, false);
    });
    
    script.streakController.onStreakChanged(function(data) {
        debugPrint('Streak changed, settting edge color');
        setEdgeColor(data.currentStreak, false);
    });

    script.streakController.onStreakChanged(function(data) {
        debugPrint('Streak broken, settting edge color');
        setEdgeColor(null, true);
    });

    debugPrint("Initialized!");
}

function setEdgeColor(streakCount, streakBroken){
    var edgeColor = new vec4(0.25, 0.25, 0.25, 1.0);
    if(!streakBroken){
        var hue = ((streakCount / 100 ) + 0.569) % 1;
        debugPrint("Edge Hue: " + hue);
        edgeColor = global.utils.hsvToRgb(new vec4(hue, 0.8, 1.0, 1.0));
    }
    script.edgeMaterial.mainPass.glowColor = edgeColor;
}

script.createEvent("OnStartEvent").bind(init);

// Debug
function debugPrint(text, force) {
    if (!force && !script.debug) return;
    var newLog = (script.debugName || self.name) + ": " + text;
    if(global.textLogger) global.logToScreen(newLog);
    if(script.debugText) script.debugText.text = newLog;
    print(newLog);
}