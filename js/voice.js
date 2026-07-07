import { addTask, getTasks, getSettings } from './state.js';
import { triggerAiAutoSchedule } from './calendar.js';

let recognition = null;
let isListening = false;
let onStateChangeCallback = null;
let switchTabCallback = null;
let toggleFocusTimerCallback = null;

export function initVoice(onStateChange, onSwitchTab, onToggleTimer) {
  onStateChangeCallback = onStateChange;
  switchTabCallback = onSwitchTab;
  toggleFocusTimerCallback = onToggleTimer;

  const voiceOrb = document.getElementById('voiceOrb');
  const voiceBubble = document.getElementById('voiceBubble');
  const closeVoiceBubble = document.getElementById('closeVoiceBubble');
  const voiceTranscript = document.getElementById('voiceTranscript');
  const voiceResponse = document.getElementById('voiceResponse');
  const voiceStatusText = document.getElementById('voiceStatusText');

  if (!voiceOrb || !voiceBubble) return;

  // Initialize Speech Recognition if supported
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      voiceOrb.classList.add('listening');
      voiceStatusText.textContent = 'Listening... Speak now.';
      voiceTranscript.textContent = '...';
      voiceResponse.classList.remove('active');
    };

    recognition.onend = () => {
      isListening = false;
      voiceOrb.classList.remove('listening');
      if (voiceStatusText.textContent === 'Listening... Speak now.') {
        voiceStatusText.textContent = 'Microphone off. Click to speak.';
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      isListening = false;
      voiceOrb.classList.remove('listening');
      voiceStatusText.textContent = 'Error: ' + event.error;
      
      // If permission blocked, give typing fallback hint
      if (event.error === 'not-allowed') {
        showTypingInput();
      }
    };

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      voiceTranscript.innerHTML = `You said: <strong style="color:var(--text-primary);">"${transcript}"</strong>`;
      voiceStatusText.textContent = 'Processing request...';
      
      await handleVoiceCommand(transcript);
    };
  } else {
    // No SpeechRecognition support - setup typing input instantly
    voiceStatusText.textContent = 'Speech not supported. Type commands below:';
    setTimeout(() => {
      showTypingInput();
    }, 100);
  }

  // Toggle voice bubble and voice recognition
  voiceOrb.addEventListener('click', () => {
    const isActive = voiceBubble.classList.contains('active');
    if (!isActive) {
      voiceBubble.classList.add('active');
      if (recognition && !isListening) {
        try {
          recognition.start();
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      if (recognition && isListening) {
        recognition.stop();
      }
      // If typing input is shown, we don't necessarily close unless double click
      if (!recognition) {
        voiceBubble.classList.remove('active');
      } else {
        voiceBubble.classList.remove('active');
      }
    }
  });

  if (closeVoiceBubble) {
    closeVoiceBubble.addEventListener('click', () => {
      if (recognition && isListening) {
        recognition.stop();
      }
      voiceBubble.classList.remove('active');
    });
  }
}

// Convert transcript area into text input fallback
function showTypingInput() {
  const transcriptDiv = document.getElementById('voiceTranscript');
  if (!transcriptDiv || transcriptDiv.querySelector('input')) return;

  transcriptDiv.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0.5rem; width:100%;">
      <div style="font-size:0.75rem; color:var(--text-muted);">Command Console:</div>
      <input type="text" id="voiceCommandInput" placeholder="Type a command and press Enter..." 
             style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-glass-active); 
                    border-radius:6px; padding:0.4rem 0.6rem; color:white; font-size:0.85rem; outline:none;">
    </div>
  `;

  const input = document.getElementById('voiceCommandInput');
  if (input) {
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const commandText = input.value.trim();
        if (commandText) {
          input.value = '';
          const logDiv = document.createElement('div');
          logDiv.style.fontSize = '0.75rem';
          logDiv.style.color = 'var(--text-muted)';
          logDiv.innerHTML = `Command: <strong>"${commandText}"</strong>`;
          
          // Reset inner area to show logging briefly
          const wrapper = transcriptDiv.querySelector('div');
          if (wrapper) {
            const label = wrapper.querySelector('div');
            if (label) label.textContent = 'Processing command...';
          }
          
          await handleVoiceCommand(commandText);
          
          // Restore text box focus
          showTypingInput();
          const newInput = document.getElementById('voiceCommandInput');
          if (newInput) newInput.focus();
        }
      }
    });
  }
}

// Speak text using browser Speech Synthesis
function speak(text) {
  const voiceResponse = document.getElementById('voiceResponse');
  if (voiceResponse) {
    voiceResponse.textContent = text;
    voiceResponse.classList.add('active');
  }

  const voiceStatusText = document.getElementById('voiceStatusText');
  if (voiceStatusText && !recognition) {
    voiceStatusText.textContent = 'Command executed.';
  } else if (voiceStatusText) {
    voiceStatusText.textContent = 'Click mic to speak again.';
  }

  if ('speechSynthesis' in window) {
    // Cancel ongoing speak
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  }
}

// Voice Command Handlers
async function handleVoiceCommand(rawText) {
  const text = rawText.toLowerCase().trim();
  const settings = getSettings();
  
  // If API key is set, try using Gemini first for advanced natural language parsing
  if (settings.apiKey && settings.apiKey.trim() !== '') {
    const success = await handleGeminiVoiceCommand(rawText, settings.apiKey);
    if (success) return;
  }

  // Fallback Rule-Based Parser (Regex & Keywords)
  
  // 1. Navigation Commands
  if (text.includes('open calendar') || text.includes('go to calendar') || text.includes('show calendar')) {
    switchTabCallback('calendar');
    speak('Opening your Calendar view.');
    return;
  }
  if (text.includes('open board') || text.includes('open task board') || text.includes('go to tasks') || text.includes('show tasks')) {
    switchTabCallback('tasks');
    speak('Switching to Task Board workspace.');
    return;
  }
  if (text.includes('open dashboard') || text.includes('go to dashboard') || text.includes('show dashboard') || text.includes('go home')) {
    switchTabCallback('dashboard');
    speak('Welcome back to your Dashboard.');
    return;
  }
  if (text.includes('open habits') || text.includes('go to habits') || text.includes('show habits')) {
    switchTabCallback('habits');
    speak('Opening your Habits Tracker.');
    return;
  }
  if (text.includes('open agent') || text.includes('go to planner') || text.includes('show agent')) {
    switchTabCallback('agent');
    speak('Loading AI Goal Planner.');
    return;
  }

  // 2. Pomodoro Timer Commands
  if (text.includes('start timer') || text.includes('start focus') || text.includes('resume timer') || text.includes('unpause timer')) {
    toggleFocusTimerCallback(true); // Force play
    speak('Focus session initiated. Good luck.');
    return;
  }
  if (text.includes('pause timer') || text.includes('stop timer') || text.includes('pause focus')) {
    toggleFocusTimerCallback(false); // Force pause
    speak('Focus session paused.');
    return;
  }
  if (text.includes('reset timer') || text.includes('restart timer')) {
    // Reset timer event (dispatch custom event for dashboard)
    document.dispatchEvent(new CustomEvent('reset-focus-timer'));
    speak('Focus timer reset.');
    return;
  }

  // 3. AI Auto-schedule
  if (text.includes('auto schedule') || text.includes('auto-schedule') || text.includes('optimize schedule') || text.includes('balance calendar')) {
    triggerAiAutoSchedule(onStateChangeCallback);
    // Speaking handled inside triggerAiAutoSchedule
    return;
  }

  // 4. Summarize Schedule
  if (text.includes('what is my schedule') || text.includes('what do i have today') || text.includes('list today\'s tasks') || text.includes('show today\'s tasks')) {
    const todayStr = new Date().toISOString().split('T')[0];
    const tasks = getTasks();
    const todaysTasks = tasks.filter(t => t.status !== 'done' && (t.dueDate === todayStr || t.dateScheduled === todayStr));
    
    if (todaysTasks.length === 0) {
      speak('Your schedule is clear today. Great job! Let’s add some tasks or build habits.');
    } else {
      const taskTitles = todaysTasks.map(t => t.title).join(', ');
      speak(`You have ${todaysTasks.length} tasks scheduled for today: ${taskTitles}. Which one should we tackle first?`);
    }
    return;
  }

  // 5. Add Task parsing (e.g., "Add task Study Algorithms tomorrow at 5 PM")
  if (text.startsWith('add task') || text.startsWith('create task') || text.startsWith('add a task to')) {
    // Extract task string
    let taskName = rawText.replace(/^(add task|create task|add a task to)/i, '').trim();
    if (!taskName) {
      speak('What is the name of the task you would like to add?');
      return;
    }

    // Try extracting date
    let dueDate = new Date().toISOString().split('T')[0]; // default today
    if (text.includes('tomorrow')) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      dueDate = d.toISOString().split('T')[0];
      taskName = taskName.replace(/tomorrow/i, '').trim();
    } else if (text.includes('next week')) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      dueDate = d.toISOString().split('T')[0];
      taskName = taskName.replace(/next week/i, '').trim();
    }

    // Extract Priority
    let priority = 'medium';
    if (text.includes('high priority') || text.includes('urgent')) {
      priority = 'high';
      taskName = taskName.replace(/(high priority|urgent)/i, '').trim();
    } else if (text.includes('low priority') || text.includes('easy')) {
      priority = 'low';
      taskName = taskName.replace(/(low priority|easy)/i, '').trim();
    }

    // Clean up trailing prepositions
    taskName = taskName.replace(/\s+(due|at|for|by)$/i, '').trim();

    // Create the task
    const newTask = addTask({
      title: taskName,
      desc: 'Created via Kairos voice interface.',
      priority: priority,
      category: 'Work',
      dueDate: dueDate,
      duration: '60',
      status: 'todo'
    });

    onStateChangeCallback();
    speak(`Added task: "${newTask.title}" set for ${dueDate} with ${priority} priority.`);
    return;
  }

  // Fallback response
  speak(`I processed your query: "${rawText}". If you'd like to perform actions, try saying "Add task Review code tomorrow", "Start timer", "Optimize schedule", or "Open calendar".`);
}

// Live Gemini Parsing
async function handleGeminiVoiceCommand(rawText, apiKey) {
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date();
  tomorrowStr.setDate(tomorrowStr.getDate() + 1);
  const tomorrowStrFormatted = tomorrowStr.toISOString().split('T')[0];

  const prompt = `You are a helper voice command agent. Interpret the user command spoken: "${rawText}".
Today's date is ${todayStr}. Tomorrow is ${tomorrowStrFormatted}.
We want to map this request to a JSON action. Respond only with JSON in this format:
{
  "action": "add-task" | "start-timer" | "pause-timer" | "reset-timer" | "navigate" | "auto-schedule" | "list-schedule" | "unknown",
  "taskDetails": {
    "title": "Clean parsed task title string",
    "dueDate": "YYYY-MM-DD",
    "priority": "high" | "medium" | "low",
    "category": "Work" | "Study" | "Personal" | "Health" | "Life",
    "duration": "estimated minutes as string (e.g. 30, 60, 120)"
  },
  "navTab": "dashboard" | "tasks" | "agent" | "calendar" | "habits",
  "responseText": "The verbal text response to read back to the user."
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!response.ok) return false;

    const data = await response.json();
    const result = JSON.parse(data.candidates[0].content.parts[0].text);

    if (result.action === 'unknown') return false;

    // Execute parsed actions
    if (result.action === 'navigate' && result.navTab) {
      switchTabCallback(result.navTab);
      speak(result.responseText || `Opening ${result.navTab}`);
      return true;
    }

    if (result.action === 'start-timer') {
      toggleFocusTimerCallback(true);
      speak(result.responseText || 'Timer started.');
      return true;
    }

    if (result.action === 'pause-timer') {
      toggleFocusTimerCallback(false);
      speak(result.responseText || 'Timer paused.');
      return true;
    }

    if (result.action === 'reset-timer') {
      document.dispatchEvent(new CustomEvent('reset-focus-timer'));
      speak(result.responseText || 'Timer reset.');
      return true;
    }

    if (result.action === 'auto-schedule') {
      triggerAiAutoSchedule(onStateChangeCallback);
      return true;
    }

    if (result.action === 'list-schedule') {
      const todayStr = new Date().toISOString().split('T')[0];
      const tasks = getTasks();
      const todaysTasks = tasks.filter(t => t.status !== 'done' && (t.dueDate === todayStr || t.dateScheduled === todayStr));
      
      if (todaysTasks.length === 0) {
        speak('Your schedule is clear today. Great job!');
      } else {
        const titles = todaysTasks.map(t => t.title).join(', ');
        speak(`Here are today's items: ${titles}.`);
      }
      return true;
    }

    if (result.action === 'add-task' && result.taskDetails && result.taskDetails.title) {
      const details = result.taskDetails;
      addTask({
        title: details.title,
        desc: 'Created via Gemini Voice command parsing.',
        priority: details.priority || 'medium',
        category: details.category || 'Work',
        dueDate: details.dueDate || todayStr,
        duration: details.duration || '60',
        status: 'todo'
      });
      onStateChangeCallback();
      speak(result.responseText || `Added task "${details.title}" for ${details.dueDate}.`);
      return true;
    }

    return false;
  } catch (e) {
    console.error('Failed using Gemini command parsing:', e);
    return false;
  }
}
