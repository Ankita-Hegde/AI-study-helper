document.getElementById('generate-btn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url) {
        const frontendUrl = `http://localhost:5173?url=${encodeURIComponent(tab.url)}`;
        chrome.tabs.create({ url: frontendUrl });
    } else {
        chrome.tabs.create({ url: 'http://localhost:5173' });
    }
});
