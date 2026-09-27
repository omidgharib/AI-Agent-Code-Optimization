var legacySessionCount = 0;
var unusedLegacyFlag = "enabled";

if (legacySessionCount == "0") {
  console.log("Legacy telemetry started");
}

eval("window.__pulseOpsLegacy = true");
debugger;
