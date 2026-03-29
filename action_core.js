import { exec } from 'child_process';

/**
 * Mia v15.0 ACTION INTERCEPTOR (OS CONTROL)
 * This module intercept voice transcripts and executes system-level actions 
 * before they reach the LLM, ensuring zero-latency execution.
 */

export function handleCommand(transcript) {
    const text = transcript.toLowerCase().trim();
    
    // 1. WEB NAVIGATION COMMANDS
    const navigationLinks = {
        'youtube': 'https://www.youtube.com',
        'google': 'https://www.google.com',
        'github': 'https://github.com',
        'stack overflow': 'https://stackoverflow.com',
        'gmail': 'https://mail.google.com',
        'chatgpt': 'https://chat.openai.com'
    };

    for (const [site, url] of Object.entries(navigationLinks)) {
        if (text.startsWith(`open ${site}`)) {
            exec(`start ${url}`);
            return {
                intercepted: true,
                responseText: `Opening ${site.charAt(0).toUpperCase() + site.slice(1)} for you, Sir.`
            };
        }
    }

    // 2. SEARCH COMMANDS
    if (text.startsWith('search for ') || text.startsWith('google ')) {
        const query = text.replace('search for ', '').replace('google ', '');
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        exec(`start ${url}`);
        return {
            intercepted: true,
            responseText: `Searching for ${query} on Google, Sir.`
        };
    }

    // 3. TIME & DATE COMMANDS
    if (text.includes('time') && (text.includes('what') || text.includes('current'))) {
        const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return {
            intercepted: true,
            responseText: `It is currently ${time}, Sir.`
        };
    }

    if (text.includes('date') && (text.includes('what') || text.includes('current') || text.includes('today'))) {
        const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        return {
            intercepted: true,
            responseText: `Today is ${date}, Sir.`
        };
    }

    // 4. SYSTEM DIAGNOSTICS (SYMMETRIC WITH diagnostic_core.py)
    if (text.includes('system status') || text.includes('diagnostic')) {
        return {
            intercepted: true,
            responseText: `All neural subsystems are operational, Sir. Core temperature is nominal.`
        };
    }

    // Default: No interception
    return { intercepted: false };
}