// Constants
const SESSION_DURATION = 873; // 14 minutes and 33 seconds in seconds
const TOTAL_SESSIONS = 96; // 48 days * 2 sessions per day

// Utility Functions
const formatDate = (date) => {
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
};

const pad = (num) => num.toString().padStart(2, '0');

function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML.replace(/javascript:/gi, '');
}

const getSessionTime = (date) => {
    const hours = date.getHours();
    return hours < 12 ? 'Morning' : 'Evening';
};

// Error Handling and Logging
function handleError(error, userMessage, context) {
    console.error('Error:', error, 'Context:', context);
    logError(error, context);
    showToast(userMessage || 'An unexpected error occurred. Please try again.');
}

function logError(error, context) {
    const errorLog = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        context: context
    };
    
    const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
    logs.push(errorLog);
    localStorage.setItem('errorLogs', JSON.stringify(logs));
}

// MeditationStore Class
class MeditationStore {
    constructor() {
        this.state = {
            activeMandal: null,
            sessions: [],
            sortAscending: true,
            theme: 'light',
            timerRunning: false,
            timerSeconds: 0,
            userName: 'Your Name'
        };
        this.observers = [];
        this.timerWorker = null;
    }

    addObserver(observer) {
        this.observers.push(observer);
    }

    notifyObservers() {
        this.observers.forEach(observer => observer.update(this.state));
    }

    setState(newState) {
        try {
            this.state = { ...this.state, ...newState };
            this.saveToLocalStorage();
            this.notifyObservers();
        } catch (error) {
            handleError(error, 'Failed to update application state', 'MeditationStore.setState');
        }
    }

    createMandal(mandalData) {
        try {
            if (this.state.activeMandal) {
                throw new Error("An active Mandal already exists. Please complete or delete it before creating a new one.");
            }
            this.setState({ activeMandal: mandalData, sessions: [] });
        } catch (error) {
            handleError(error, 'Failed to create Mandal', 'MeditationStore.createMandal');
            throw error;
        }
    }

    addSession(sessionData) {
        try {
            this.setState({
                sessions: [...this.state.sessions, sessionData],
                currentStreak: this.calculateStreak()
            });
        } catch (error) {
            handleError(error, 'Failed to add session', 'MeditationStore.addSession');
        }
    }

    deleteSession(index) {
        try {
            const newSessions = [...this.state.sessions];
            newSessions.splice(index, 1);
            this.setState({
                sessions: newSessions,
                currentStreak: this.calculateStreak()
            });
        } catch (error) {
            handleError(error, 'Failed to delete session', 'MeditationStore.deleteSession');
        }
    }

    updateSessionNotes(index, notes) {
        try {
            const newSessions = [...this.state.sessions];
            newSessions[index].notes = notes;
            this.setState({ sessions: newSessions });
        } catch (error) {
            handleError(error, 'Failed to update session notes', 'MeditationStore.updateSessionNotes');
        }
    }

    toggleSortOrder() {
        try {
            this.setState({ sortAscending: !this.state.sortAscending });
        } catch (error) {
            handleError(error, 'Failed to toggle sort order', 'MeditationStore.toggleSortOrder');
        }
    }

    toggleTheme() {
        try {
            const newTheme = this.state.theme === 'light' ? 'dark' : 'light';
            this.setState({ theme: newTheme });
            document.body.classList.toggle('dark-mode', newTheme === 'dark');
        } catch (error) {
            handleError(error, 'Failed to toggle theme', 'MeditationStore.toggleTheme');
        }
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('meditationTrackerState', JSON.stringify(this.state));
        } catch (error) {
            handleError(error, 'Failed to save data. Please check your browser settings.', 'MeditationStore.saveToLocalStorage');
        }
    }

    loadFromLocalStorage() {
        try {
            const savedState = JSON.parse(localStorage.getItem('meditationTrackerState'));
            if (savedState) {
                if (savedState.activeMandal) {
                    savedState.activeMandal.startDate = new Date(savedState.activeMandal.startDate);
                    savedState.activeMandal.endDate = new Date(savedState.activeMandal.endDate);
                }
                savedState.sessions = savedState.sessions.map(session => ({
                    ...session,
                    date: new Date(session.date)
                }));
                this.setState(savedState);
            }
        } catch (error) {
            handleError(error, 'Failed to load saved data. Starting with a fresh state.', 'MeditationStore.loadFromLocalStorage');
        }
    }

    calculateStreak() {
        try {
            if (this.state.sessions.length === 0) return 0;
            let streak = 0;
            let currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);

            const sortedSessions = [...this.state.sessions].sort((a, b) => b.date - a.date);

            for (let i = 0; i < sortedSessions.length; i++) {
                const sessionDate = new Date(sortedSessions[i].date);
                sessionDate.setHours(0, 0, 0, 0);

                const dayDifference = Math.round((currentDate - sessionDate) / (1000 * 60 * 60 * 24));

                if (dayDifference === streak) {
                    streak++;
                    currentDate = sessionDate;
                } else if (dayDifference > streak) {
                    break;
                }
            }

            return streak;
        } catch (error) {
            handleError(error, 'Failed to calculate streak', 'MeditationStore.calculateStreak');
            return 0;
        }
    }

    getWeeklyStats() {
        try {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const weekSessions = this.state.sessions.filter(session => session.date >= oneWeekAgo);
            const totalTime = weekSessions.reduce((sum, session) => sum + session.duration, 0);
            const averageTime = weekSessions.length > 0 ? totalTime / weekSessions.length : 0;
            return {
                sessionsCount: weekSessions.length,
                totalTime,
                averageTime
            };
        } catch (error) {
            handleError(error, 'Failed to get weekly stats', 'MeditationStore.getWeeklyStats');
            return { sessionsCount: 0, totalTime: 0, averageTime: 0 };
        }
    }

    searchNotes(query) {
        try {
            const lowercaseQuery = query.toLowerCase();
            return this.state.sessions.filter(session =>
                session.notes.toLowerCase().includes(lowercaseQuery)
            );
        } catch (error) {
            handleError(error, 'Failed to search notes', 'MeditationStore.searchNotes');
            return [];
        }
    }

    startTimer() {
        try {
            if (!this.timerWorker) {
                this.timerWorker = new Worker('timer-worker.js');
                this.timerWorker.onmessage = (e) => {
                    if (e.data.type === 'tick') {
                        this.setState({ timerSeconds: e.data.seconds });
                        if (e.data.seconds >= SESSION_DURATION) {
                            this.stopTimer();
                        }
                    } else if (e.data.type === 'stopped') {
                        this.addSession({
                            date: new Date(),
                            duration: Math.min(e.data.seconds, SESSION_DURATION),
                            notes: ''
                        });
                    }
                };
            }
            this.timerWorker.postMessage({ command: 'start' });
            this.setState({ timerRunning: true, timerSeconds: 0 });
        } catch (error) {
            handleError(error, 'Failed to start timer', 'MeditationStore.startTimer');
        }
    }

    stopTimer() {
        try {
            if (this.timerWorker) {
                this.timerWorker.postMessage({ command: 'stop' });
            }
            this.setState({ timerRunning: false });
        } catch (error) {
            handleError(error, 'Failed to stop timer', 'MeditationStore.stopTimer');
        }
    }

    cleanup() {
        try {
            if (this.timerWorker) {
                this.timerWorker.terminate();
                this.timerWorker = null;
            }
        } catch (error) {
            handleError(error, 'Failed to clean up resources', 'MeditationStore.cleanup');
        }
    }

    setUserName(name) {
        try {
            this.setState({ userName: name });
        } catch (error) {
            handleError(error, 'Failed to set user name', 'MeditationStore.setUserName');
        }
    }
}

// UI Update Functions
function updateDashboard(state) {
    try {
        const { activeMandal, sessions } = state;
        if (!activeMandal) return;

        const dashboardElement = document.getElementById('dashboard');
        const now = new Date();
        const totalDays = (activeMandal.endDate - activeMandal.startDate) / (1000 * 60 * 60 * 24);
        const daysPassed = Math.max(0, Math.min(totalDays, (now - activeMandal.startDate) / (1000 * 60 * 60 * 24)));
        const progress = Math.round((daysPassed / totalDays) * 100);

        const totalTime = sessions.reduce((sum, session) => sum + session.duration, 0);
        const sessionsCount = sessions.length;

        const streak = store.calculateStreak();
        const weeklyStats = store.getWeeklyStats();

        dashboardElement.innerHTML = `
            <div class="dashboard-item">
                <h3>Mandal Progress</h3>
                <div class="circular-progress" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
                    <svg viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#e0e0e0" stroke-width="10" />
                        <circle cx="50" cy="50" r="45" fill="none" stroke="var(--primary-color)" stroke-width="10" stroke-dasharray="${progress * 2.83} 283" />
                    </svg>
                    <div class="circular-progress-text">${progress}%</div>
                </div>
                <p>Start Date: ${formatDate(activeMandal.startDate)}</p>
                <p>End Date: ${formatDate(activeMandal.endDate)}</p>
                <p>Days Remaining: ${Math.max(0, Math.ceil(totalDays - daysPassed))}</p>
            </div>
            <div class="dashboard-item">
                <h3>Session Statistics</h3>
                <div class="circular-progress" role="progressbar" aria-valuenow="${sessionsCount}" aria-valuemin="0" aria-valuemax="${TOTAL_SESSIONS}">
                    <svg viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#e0e0e0" stroke-width="10" />
                        <circle cx="50" cy="50" r="45" fill="none" stroke="var(--secondary-color)" stroke-width="10" stroke-dasharray="${(sessionsCount / TOTAL_SESSIONS) * 283} 283" />
                    </svg>
                    <div class="circular-progress-text">${sessionsCount}/${TOTAL_SESSIONS}</div>
                </div>
                <p>Total Meditation Time: ${formatTime(totalTime)}</p>
                <p>Average Session Duration: ${formatTime(totalTime / sessionsCount || 0)}</p>
            </div>
            <div class="dashboard-item">
                <h3>Current Streak</h3>
                <div class="streak-display">
                    <span id="currentStreak">${streak}</span> days
                </div>
            </div>
            <div class="dashboard-item">
                <h3>This Week's Progress</h3>
                <p>Sessions: ${weeklyStats.sessionsCount}</p>
                <p>Total Time: ${formatTime(weeklyStats.totalTime)}</p>
                <p>Average Time: ${formatTime(weeklyStats.averageTime)}</p>
            </div>
            <div class="dashboard-item">
                <h3>Quick Add</h3>
                <button id="addTodaySession" aria-label="Add Session for Today">Add Session for Today</button>
            </div>
        `;

        document.getElementById('activeMandalName').textContent = activeMandal.name;
        document.getElementById('addTodaySession').addEventListener('click', handleAddTodaySession);
    } catch (error) {
        handleError(error, 'Failed to update dashboard', 'updateDashboard');
    }
}

function displaySessionHistory(state, searchQuery = '') {
    try {
        const { sessions, sortAscending } = state;
        const historyContent = document.getElementById('historyContent');
        
        if (sessions.length === 0) {
            historyContent.innerHTML = "<p>No meditation sessions recorded yet.</p>";
            return;
        }

        const sortedSessions = [...sessions].sort((a, b) => 
            sortAscending ? a.date - b.date : b.date - a.date
        );

       historyContent.innerHTML = sortedSessions.map((session, index) => `
            <div class="session-entry">
                <div class="session-header">
                    <span class="session-time">${session.period || getSessionTime(session.date)}</span><br>
                    <span class="session-date">${formatDate(session.date)} - ${formatTime(session.duration)}</span>
                </div>
                <div class="editable-notes" contenteditable="true" data-index="${index}" onblur="handleSaveNotes(event)" aria-label="Session notes">
                    ${highlightSearchTerm(sanitizeHTML(session.notes), searchQuery)}
                </div>
                <div class="session-controls">
                    <button class="danger-btn" onclick="handleDeleteSession(${index})" aria-label="Delete Session">Delete Session</button>
                    <button class="format-btn" onclick="toggleFormatMenu(${index})" aria-label="Format Notes">Format</button>
                    <div class="format-menu" id="formatMenu-${index}" style="display: none;">
                        <button class="format-button" onclick="applyFormat('bold', ${index})">Bold</button>
                        <button class="format-button" onclick="applyFormat('italic', ${index})">Italic</button>
                        <button class="format-button" onclick="applyFormat('underline', ${index})">Underline</button>
                        <button class="format-button" onclick="applyFormat('strikeThrough', ${index})">Strike Through</button>
                        <button class="format-button" onclick="applyFormat('removeFormat', ${index})">Remove Formatting</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        handleError(error, 'Failed to display session history', 'displaySessionHistory');
    }
}

function highlightSearchTerm(text, searchTerm) {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

function updateTimerDisplay(seconds) {
    try {
        const timerElement = document.getElementById('timer');
        timerElement.textContent = formatTime(seconds);
    } catch (error) {
        handleError(error, 'Failed to update timer display', 'updateTimerDisplay');
    }
}

function updateTimerControls(timerRunning) {
    try {
        const startButton = document.getElementById('startSession');
        const stopButton = document.getElementById('stopSession');
        startButton.style.display = timerRunning ? 'none' : 'inline-block';
        stopButton.style.display = timerRunning ? 'inline-block' : 'none';
    } catch (error) {
        handleError(error, 'Failed to update timer controls', 'updateTimerControls');
    }
}

function toggleFormatMenu(index) {
    try {
        const formatMenu = document.getElementById(`formatMenu-${index}`);
        formatMenu.style.display = formatMenu.style.display === 'none' ? 'block' : 'none';
    } catch (error) {
        handleError(error, 'Failed to toggle format menu', 'toggleFormatMenu');
    }
}

function applyFormat(command, index) {
    try {
        document.execCommand(command, false, null);
    } catch (error) {
        handleError(error, 'Failed to apply format', 'applyFormat');
    }
}

// Event Handlers
function handleCreateMandal() {
    try {
        const name = document.getElementById('mandalName').value.trim();
        const duration = parseInt(document.getElementById('mandalDuration').value);
        const startDate = new Date(document.getElementById('startDate').value);
        
        if (!name || isNaN(startDate.getTime())) {
            throw new Error('Please enter a valid Mandal name and start date.');
        }
        
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + duration);
        
        store.createMandal({ name, startDate, endDate, duration });
        showToast('Mandal created successfully!');
        
        document.getElementById('activeMandalInfo').style.display = 'block';
        document.getElementById('sessionHistory').style.display = 'block';
        document.getElementById('mandalCreation').style.display = 'none';
    } catch (error) {
        handleError(error, 'Failed to create Mandal. Please check your inputs and try again.', 'handleCreateMandal');
    }
}

function handleAddPastSession(event) {
    try {
        event.preventDefault();
        const pastDate = new Date(document.getElementById('pastDate').value);
        const addMorning = document.getElementById('morningSession').checked;
        const addEvening = document.getElementById('eveningSession').checked;

        if (isNaN(pastDate.getTime())) {
            throw new Error('Please select a valid date.');
        }

        if (addMorning) {
            const morningDate = new Date(pastDate);
            morningDate.setHours(8, 0, 0, 0);
            store.addSession({
                date: morningDate,
                duration: SESSION_DURATION,
                notes: '',
                period: 'Morning'
            });
        }

        if (addEvening) {
            const eveningDate = new Date(pastDate);
            eveningDate.setHours(20, 0, 0, 0);
            store.addSession({
                date: eveningDate,
                duration: SESSION_DURATION,
                notes: '',
                period: 'Evening'
            });
        }

        closeModal('pastSessionModal');
        showToast('Past session(s) added successfully.');
    } catch (error) {
        handleError(error, 'Failed to add past session(s)', 'handleAddPastSession');
    }
}

function handleSubmitFeedback() {
    try {
        const feedbackText = document.getElementById('feedbackText').value.trim();
        if (!feedbackText) {
            throw new Error('Please enter feedback before submitting.');
        }
        const feedback = {
            text: feedbackText,
            date: new Date().toISOString()
        };
        let feedbacks = JSON.parse(localStorage.getItem('meditationTrackerFeedback') || '[]');
        feedbacks.push(feedback);
        localStorage.setItem('meditationTrackerFeedback', JSON.stringify(feedbacks));
        document.getElementById('feedbackText').value = '';
        closeModal('feedbackModal');
        showToast('Feedback submitted successfully!');
    } catch (error) {
        handleError(error, 'Failed to submit feedback', 'handleSubmitFeedback');
    }
}

function handleDeleteSession(index) {
    try {
        if (confirm('Are you sure you want to delete this session?')) {
            store.deleteSession(index);
            showToast('Session deleted successfully.');
            displaySessionHistory(store.state);
        }
    } catch (error) {
        handleError(error, 'Failed to delete session', 'handleDeleteSession');
    }
}

function handleSaveNotes(event) {
    try {
        const index = parseInt(event.target.dataset.index);
        const notes = event.target.textContent;
        store.updateSessionNotes(index, sanitizeHTML(notes));
        showToast('Notes saved successfully.');
    } catch (error) {
        handleError(error, 'Failed to save notes', 'handleSaveNotes');
    }
}

function handleAddTodaySession() {
    try {
        const now = new Date();
        store.addSession({
            date: now,
            duration: SESSION_DURATION,
            notes: '',
            period: getSessionTime(now)
        });
        showToast('Session added for today.');
    } catch (error) {
        handleError(error, 'Failed to add today\'s session', 'handleAddTodaySession');
    }
}

function handleSearch() {
    try {
        const query = document.getElementById('searchInput').value;
        const searchResults = store.searchNotes(query);
        displaySessionHistory({ ...store.state, sessions: searchResults }, query);
    } catch (error) {
        handleError(error, 'Failed to perform search', 'handleSearch');
    }
}

function handleStartSession() {
    try {
        store.startTimer();
        updateTimerControls(true);
    } catch (error) {
        handleError(error, 'Failed to start session', 'handleStartSession');
    }
}

function handleStopSession() {
    try {
        store.stopTimer();
        updateTimerControls(false);
        showToast('Session completed and saved.');
    } catch (error) {
        handleError(error, 'Failed to stop session', 'handleStopSession');
    }
}

function showToast(message) {
    try {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    } catch (error) {
        console.error('Failed to show toast message:', error);
    }
}

function openModal(modalId) {
    try {
        document.getElementById(modalId).style.display = 'block';
        document.getElementById(modalId).setAttribute('aria-hidden', 'false');
    } catch (error) {
        handleError(error, 'Failed to open modal', 'openModal');
    }
}

function closeModal(modalId) {
    try {
        document.getElementById(modalId).style.display = 'none';
        document.getElementById(modalId).setAttribute('aria-hidden', 'true');
    } catch (error) {
        handleError(error, 'Failed to close modal', 'closeModal');
    }
}

// Initialize application
const store = new MeditationStore();

document.addEventListener('DOMContentLoaded', () => {
    try {
        store.loadFromLocalStorage();
        
        document.getElementById('embedMedia').addEventListener('click', handleEmbedMedia);
        document.getElementById('themeToggle').addEventListener('click', () => store.toggleTheme());
        document.getElementById('giveFeedback').addEventListener('click', () => openModal('feedbackModal'));
        document.getElementById('addPastSession').addEventListener('click', () => openModal('pastSessionModal'));
        document.getElementById('createMandal').addEventListener('click', handleCreateMandal);
        document.getElementById('sortByDate').addEventListener('click', () => {
            store.toggleSortOrder();
            displaySessionHistory(store.state);
        });
        document.getElementById('submitFeedback').addEventListener('click', handleSubmitFeedback);
        document.getElementById('pastSessionForm').addEventListener('submit', handleAddPastSession);
        document.getElementById('searchInput').addEventListener('input', handleSearch);
        document.getElementById('startSession').addEventListener('click', handleStartSession);
        document.getElementById('stopSession').addEventListener('click', handleStopSession);

        const userNameElement = document.getElementById('userName');
        userNameElement.textContent = store.state.userName;
        userNameElement.addEventListener('blur', (e) => {
            const newName = e.target.textContent.trim();
            if (newName) {
                store.setUserName(sanitizeHTML(newName));
                showToast('Name updated successfully.');
            } else {
                e.target.textContent = store.state.userName;
                showToast('Name cannot be empty.');
            }
        });

        if (store.state.activeMandal) {
            document.getElementById('activeMandalInfo').style.display = 'block';
            document.getElementById('sessionHistory').style.display = 'block';
            document.getElementById('mandalCreation').style.display = 'none';
        }

        updateDashboard(store.state);
        displaySessionHistory(store.state);
        document.body.classList.toggle('dark-mode', store.state.theme === 'dark');

        // Back to Top functionality
        const backToTopButton = document.getElementById('backToTop');
        window.onscroll = function() {
            if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
                backToTopButton.style.display = "block";
            } else {
                backToTopButton.style.display = "none";
            }
        };

        backToTopButton.addEventListener('click', function() {
            document.body.scrollTop = 0; // For Safari
            document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
        });

        // Make history controls sticky
        const historyControls = document.getElementById('historyControls');
        const sticky = historyControls.offsetTop;

        window.addEventListener('scroll', function() {
            if (window.pageYOffset > sticky) {
                historyControls.classList.add("sticky");
            } else {
                historyControls.classList.remove("sticky");
            }
        });
    } catch (error) {
        handleError(error, 'Failed to initialize application', 'DOMContentLoaded');
    }
});

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        closeModal(event.target.id);
    }
};

// Close modals when pressing Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal.style.display === 'block') {
                closeModal(modal.id);
            }
        });
    }
});

store.addObserver({
    update: function(state) {
        updateDashboard(state);
        displaySessionHistory(state);
        updateTimerControls(state.timerRunning);
        updateTimerDisplay(state.timerSeconds);
    }
});

// Add support for offline functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/mandal-20/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.error('ServiceWorker registration failed: ', err);
            });
    });
}

function handleEmbedMedia() {
    try {
        const mediaUrl = document.getElementById('mediaUrl').value.trim();
        const mediaContainer = document.getElementById('mediaContainer');
        
        if (!mediaUrl) {
            throw new Error('Please enter a valid URL.');
        }

        const url = new URL(mediaUrl);
        
        if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
            const videoId = extractYouTubeId(mediaUrl);
            if (videoId) {
                const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
                mediaContainer.innerHTML = `
                    <iframe 
                        width="560" 
                        height="315" 
                        src="${embedUrl}" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen
                        title="YouTube video player">
                    </iframe>`;
                showToast('YouTube video embedded successfully.');
            } else {
                throw new Error('Invalid YouTube URL. Please check and try again.');
            }
        } else if (url.hostname.includes('soundcloud.com')) {
            const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(mediaUrl)}`;
           mediaContainer.innerHTML = `
                <iframe 
                    width="100%" 
                    height="166" 
                    scrolling="no" 
                    frameborder="no" 
                    allow="autoplay" 
                    src="${embedUrl}"
                    title="SoundCloud audio player">
                </iframe>`;
            showToast('SoundCloud track embedded successfully.');
        } else {
            throw new Error('Unsupported media URL. Please enter a YouTube or SoundCloud URL.');
        }
    } catch (error) {
        handleError(error, 'Failed to embed media', 'handleEmbedMedia');
    }
}

function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Cleanup function
window.addEventListener('beforeunload', () => {
    try {
        store.cleanup();
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
});

// Additional utility functions
function isValidDate(dateString) {
    return !isNaN(new Date(dateString).getTime());
}

function isValidDuration(duration) {
    return Number.isInteger(duration) && duration > 0;
}

function isValidName(name) {
    return typeof name === 'string' && name.trim().length > 0 && name.length <= 100;
}

function isValidNotes(notes) {
    return typeof notes === 'string' && notes.length <= 1000;
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;  
    }
}

// Enhanced error handling for async operations
async function safeAsync(asyncFn, errorMessage, context) {
    try {
        return await asyncFn();
    } catch (error) {
        handleError(error, errorMessage, context);
        throw error;
    }
}

// Example usage of safeAsync
async function fetchExternalData() {
    return safeAsync(
        async () => {
            const response = await fetch('https://api.example.com/data');
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        },
        'Failed to fetch external data',
        'fetchExternalData'
    );
}

// Performance monitoring
const performanceMonitor = {
    start: function(label) {
        performance.mark(`${label}-start`);
    },
    end: function(label) {
        performance.mark(`${label}-end`);
        performance.measure(label, `${label}-start`, `${label}-end`);
        const measure = performance.getEntriesByName(label)[0];
        console.log(`${label} took ${measure.duration.toFixed(2)}ms`);
    }
};

// Usage example:
// performanceMonitor.start('updateDashboard');
// updateDashboard(store.state);
// performanceMonitor.end('updateDashboard');

// Add this to your initialization code to set up periodic performance logging
setInterval(() => {
    const perfEntries = performance.getEntriesByType('measure');
    if (perfEntries.length > 0) {
        console.log('Performance report:');
        perfEntries.forEach(entry => {
            console.log(`${entry.name}: ${entry.duration.toFixed(2)}ms`);
        });
        performance.clearMeasures();
    }
}, 60000); // Log every minute

// Accessibility helper function
function setAriaLabel(elementId, label) {
    const element = document.getElementById(elementId);
    if (element) {
        element.setAttribute('aria-label', label);
    }
}

// Usage example:
// setAriaLabel('startSession', 'Start meditation session');

// Initialize accessibility labels
function initAccessibilityLabels() {
    setAriaLabel('startSession', 'Start meditation session');
    setAriaLabel('stopSession', 'Stop meditation session');
    setAriaLabel('addTodaySession', 'Add meditation session for today');
    // Add more as needed
}

// Call this function in your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    // ... (previous initialization code)
    initAccessibilityLabels();
    // ... (rest of the initialization code)
});

// This concludes the main JavaScript file for the Meditation Mandal Tracker application.
// The code now includes enhanced error handling, performance monitoring, and improved accessibility features.
