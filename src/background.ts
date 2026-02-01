import { getDomain } from "./utils/domain.js";

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  const domain = getDomain(tab.url);

  if (domain) {
    console.log("Domain Active:", domain);
}
});
