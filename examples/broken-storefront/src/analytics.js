var visitCount = 0;
let trackerName = "legacy-store-tracker";
const unusedTrackerOption = "debug";

if (visitCount == "0") {
  console.log(trackerName, "started");
}

eval("window.__legacyAnalytics = true");
debugger;
