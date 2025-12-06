document.getElementById('generate-btn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url) {
        const frontendUrl = `https://aish-ai-study-helper.vercel.app?url=${encodeURIComponent(tab.url)}`;
        chrome.tabs.create({ url: frontendUrl });
    } else {
        chrome.tabs.create({ url: 'https://aish-ai-study-helper.vercel.app' });
    }
});
