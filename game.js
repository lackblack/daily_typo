class DailyTypoGame {
    constructor() {
        this.currentArticle = null;
        this.errorWord = null;
        this.originalWord = null;
        this.errorWords = [];
        this.originalWords = [];
        this.wrongOccurrence = null; // Track which occurrence of wrong word to replace
        this.errorSentence = null;
        this.errorType = null;
        this.triesRemaining = 3; // 3 total attempts = 2 mistakes allowed
        this.maxTries = 3;
        this.selectedWords = [];
        this.articlesConfig = null;
        this.lastGameResult = null; // Track last game result: 'win', 'loss', or null
        this.gameStartTime = null; // Track when game started for timer
        this.elapsedTime = null; // Store elapsed time when game completes
        this.countdownInterval = null; // Track countdown interval
        
        // Daily system
        this.currentDate = new Date();
        this.currentDateString = this.getDateString(this.currentDate);
        this.selectedDate = null; // For archive mode
        
        // Archive/completion tracking
        this.completions = this.loadCompletions();
        
        this.init();
    }
    
    getDateString(date) {
        // Format as YYYY-MM-DD in local time to avoid timezone shifting
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    isFutureDate(dateString) {
        // Check if a date is in the future (after today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
        targetDate.setHours(0, 0, 0, 0);
        return targetDate > today;
    }
    
    getSpecialDayMessage(dateString, article = null) {
        // Check if the article has a specialDay field
        if (article && article.specialDay) {
            return article.specialDay;
        }
        
        return null;
    }
    
    calculatePuzzleNumber(dateString) {
        // Calculate puzzle number based on days since first game (October 27, 2025)
        // First game: October 27, 2025 = #1
        // Each subsequent day = #2, #3, etc.
        // Today = highest number
        const firstGameDate = new Date('2025-10-27T00:00:00');
        const targetDate = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
        
        // If date is before first game, return 1 (first game)
        if (targetDate < firstGameDate) {
            return 1;
        }
        
        const diffTime = targetDate - firstGameDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays + 1; // First game = #1, next day = #2, etc.
    }
    
    getValidGameDate(dateString) {
        // Ensure date is on or after the first game date (October 27, 2025)
        const firstGameDate = new Date('2025-10-27T00:00:00');
        const targetDate = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
        
        // If date is before first game, return first game date
        if (targetDate < firstGameDate) {
            return this.getDateString(firstGameDate);
        }
        
        return this.getDateString(targetDate);
    }
    
    calculateDateFromPuzzleNumber(puzzleNumber) {
        // Calculate date from puzzle number
        // Puzzle #1 = October 27, 2025
        const firstGameDate = new Date('2025-10-27T00:00:00');
        const targetDate = new Date(firstGameDate);
        targetDate.setDate(firstGameDate.getDate() + (puzzleNumber - 1));
        return this.getDateString(targetDate);
    }
    
    getArticleForDate(dateString) {
        // First check scheduled articles for this specific date
        if (this.articlesConfig && this.articlesConfig.scheduled && this.articlesConfig.scheduled[dateString]) {
            return this.articlesConfig.scheduled[dateString];
        }
        
        // Fallback to cycling through articles array
        if (!this.articlesConfig || !this.articlesConfig.articles || this.articlesConfig.articles.length === 0) {
            return null;
        }
        
        const puzzleNumber = this.calculatePuzzleNumber(dateString);
        const articleIndex = (puzzleNumber - 1) % this.articlesConfig.articles.length;
        return this.articlesConfig.articles[articleIndex];
    }
    
    getWikipediaUrl(title) {
        // Convert title to Wikipedia URL format
        const encodedTitle = encodeURIComponent(title.replace(/\s+/g, '_'));
        return `https://simple.wikipedia.org/wiki/${encodedTitle}`;
    }
    
    loadCompletions() {
        try {
            const stored = localStorage.getItem('dailyTypoCompletions');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Error loading completions:', error);
            return {};
        }
    }
    
    saveCompletions() {
        try {
            localStorage.setItem('dailyTypoCompletions', JSON.stringify(this.completions));
        } catch (error) {
            console.error('Error saving completions:', error);
        }
    }
    
    markCompleted(dateString) {
        this.completions[dateString] = {
            completed: true,
            won: true,
            completedAt: new Date().toISOString()
        };
        this.saveCompletions();
    }
    
    markGameOver(dateString) {
        this.completions[dateString] = {
            completed: true,
            won: false,
            completedAt: new Date().toISOString()
        };
        this.saveCompletions();
    }
    
    isCompleted(dateString) {
        return this.completions[dateString] && this.completions[dateString].completed;
    }
    
    isWon(dateString) {
        const completion = this.completions[dateString];
        if (!completion) return false;
        // Backward compatibility: if 'won' field doesn't exist, assume it's a win
        // (old completions were only saved for wins, not game overs)
        return completion.won !== false;
    }
    
    async init() {
        try {
            this.setupEventListeners();
            await this.loadArticlesConfig();
            await this.loadDailyGame();
            this.updateDailyInfo();
            this.updateStats();
        } catch (error) {
            console.error('Error initializing game:', error);
            alert(`Failed to initialize game: ${error.message || 'Unknown error'}`);
            this.showLoading(false);
        }
    }
    
    calculateStreak() {
        let streak = 0;
        const today = new Date();
        
        for (let i = 0; i < 365; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateString = this.getDateString(date);
            
            if (this.isWon(dateString)) {
                streak++;
            } else if (i > 0) {
                // If we find a gap, stop counting
                break;
            }
        }
        
        return streak;
    }
    
    updateStats() {
        // Streak calculation is available but UI element not yet implemented
        // const streak = this.calculateStreak();
    }
    
    async loadArticlesConfig() {
        try {
            const response = await fetch(`articles-config.json?t=${Date.now()}`, {
                cache: 'no-store'
            });
            
            if (response.ok) {
                this.articlesConfig = await response.json();
                
                // Ensure version 2.0 structure
                if (!this.articlesConfig.version) {
                    this.articlesConfig.version = "2.0";
                }
                if (!this.articlesConfig.articles) {
                    this.articlesConfig.articles = [];
                }
                if (!this.articlesConfig.scheduled) {
                    this.articlesConfig.scheduled = {};
                }
                
            } else {
                console.error(`⚠ Failed to load articles-config.json: HTTP ${response.status}`);
                this.articlesConfig = { version: "2.0", articles: [], scheduled: {} };
            }
        } catch (error) {
            console.error('Error loading articles-config.json:', error);
                this.articlesConfig = { version: "2.0", articles: [], scheduled: {} };
        }
    }
    
    applyWordReplacement(text, correctWord, wrongWord, occurrence = null) {
        // Escape special regex characters in the correct word
        const escapedCorrect = correctWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // If occurrence is specified, replace only that specific occurrence (1-based index)
        if (occurrence !== null && occurrence > 0) {
            let matchCount = 0;
            const targetOccurrence = occurrence;
            
            // Try case-sensitive match first
            if (text.includes(correctWord)) {
                return text.replace(new RegExp(escapedCorrect, 'g'), (match) => {
                    matchCount++;
                    if (matchCount === targetOccurrence) {
                        return wrongWord;
                    }
                    return match; // Keep original for other occurrences
                });
            }
            
            // If not found, try case-insensitive match
            const regex = new RegExp(escapedCorrect, 'gi');
            return text.replace(regex, (match) => {
                matchCount++;
                if (matchCount === targetOccurrence) {
                    // Preserve case of original match
                    if (match[0] === match[0].toUpperCase()) {
                        return wrongWord.charAt(0).toUpperCase() + wrongWord.slice(1).toLowerCase();
                    }
                    return wrongWord.toLowerCase();
                }
                return match; // Keep original for other occurrences
            });
        }
        
        // Default behavior: replace all occurrences (backward compatible)
        // Try to match with case sensitivity first (exact match)
        if (text.includes(correctWord)) {
            return text.replace(new RegExp(escapedCorrect, 'g'), wrongWord);
        }
        
        // If not found, try case-insensitive match
        const regex = new RegExp(escapedCorrect, 'gi');
        return text.replace(regex, (match) => {
            // Preserve case of original match
            if (match[0] === match[0].toUpperCase()) {
                return wrongWord.charAt(0).toUpperCase() + wrongWord.slice(1).toLowerCase();
            }
            return wrongWord.toLowerCase();
        });
    }
    
    async loadDailyGame(dateString = null, allowFuture = false) {
        try {
            this.resetGameState();
            this.hidePostGameMessage();
            this.lastGameResult = null; // Reset game result when loading new game
            this.showLoading(true);
            
            // Ensure we use a valid game date (on or after Oct 27, 2025)
            const rawDate = dateString || this.currentDateString;
            let targetDate = this.getValidGameDate(rawDate);
            
            // Prevent loading future dates - if date is in the future, use today's date instead
            // (unless allowFuture is true, for preview purposes)
            if (!allowFuture && this.isFutureDate(targetDate)) {
                targetDate = this.getValidGameDate(this.currentDateString);
            }
            
            this.selectedDate = targetDate;
            
            // Check if we have any articles (either in array or scheduled)
            const hasArticles = this.articlesConfig && 
                               ((this.articlesConfig.articles && this.articlesConfig.articles.length > 0) ||
                                (this.articlesConfig.scheduled && Object.keys(this.articlesConfig.scheduled).length > 0));
            
            if (!hasArticles) {
                this.showLoading(false);
                this.showNoArticlesMessage();
                return;
            }
            
            const savedArticle = this.getArticleForDate(targetDate);
            
            if (!savedArticle) {
                this.showLoading(false);
                this.showNoArticlesMessage();
                return;
            }
            
            // Skip articles that don't have wrong/correct fields yet (incomplete articles)
            if (!savedArticle.wrong || !savedArticle.correct) {
                this.showLoading(false);
                alert(`Article "${savedArticle.title}" is not yet configured. Please add "wrong" and "correct" fields to the article.`);
                return;
            }
            
            let articleData = null;
            let extract = null;
            let category = 'General Knowledge';
            let thumbnail = null;
            let description = null;
            
            // Check if this is new format (version 2.0) - just title + wrong/correct
            const isNewFormat = savedArticle.wrong && savedArticle.correct && !savedArticle.extract;
            
            if (isNewFormat) {
                // New format: fetch article from Wikipedia
                articleData = await this.fetchWikipediaArticle(savedArticle.title);
                
                if (!articleData) {
                    this.showLoading(false);
                    alert('Failed to fetch article from Wikipedia. Please try again.');
                    return;
                }
                
                extract = articleData.extract;
                // Use category from JSON if provided, otherwise use auto-detected category, fallback to General Knowledge
                category = savedArticle.category || articleData.category || 'General Knowledge';
                thumbnail = articleData.thumbnail || null;
                description = articleData.description || null;
                
                // Apply replacement: replace correct word with wrong word
                // If occurrence is specified, replace only that specific occurrence (1-based index)
                const occurrence = savedArticle.occurrence !== undefined ? savedArticle.occurrence : null;
                extract = this.applyWordReplacement(extract, savedArticle.correct, savedArticle.wrong, occurrence);
                
                // Set error tracking
                this.originalWord = savedArticle.correct;
                this.errorWord = savedArticle.wrong;
                this.errorWords = [savedArticle.wrong.toLowerCase()];
                this.originalWords = [savedArticle.correct.toLowerCase()];
                this.wrongOccurrence = savedArticle.wrongOccurrence !== undefined ? savedArticle.wrongOccurrence : null;
                this.errorType = 'word';
            } else {
                // Old format: article already has extract and error info
                extract = savedArticle.extract;
                category = savedArticle.category || 'General Knowledge';
                thumbnail = savedArticle.thumbnail || null;
                description = savedArticle.description || null;
                
                // Set error tracking
                if (savedArticle.replacements && savedArticle.replacements.length > 0) {
                    const replacements = savedArticle.replacements;
                    this.errorWords = replacements.map(r => r.replacement.toLowerCase());
                    this.originalWords = replacements.map(r => r.original.toLowerCase());
                    this.originalWord = replacements[0].original;
                    this.errorWord = replacements[0].replacement;
                } else {
                    this.originalWord = savedArticle.originalWord;
                    this.errorWord = savedArticle.wrongWord;
                    this.errorWords = [savedArticle.wrongWord.toLowerCase()];
                    this.originalWords = [savedArticle.originalWord.toLowerCase()];
                }
                this.errorType = savedArticle.errorType || 'word';
            }
            
            this.currentArticle = {
                title: savedArticle.title,
                extract: extract,
                category: category,
                thumbnail: thumbnail,
                description: description
            };
            
            // Find the sentence containing the error
            const sentences = this.currentArticle.extract.match(/[^.!?]+[.!?]+/g) || [];
            this.errorSentence = sentences.find(s => 
                this.errorWords.some(ew => s.toLowerCase().includes(ew))
            ) || '';
            
            this.displayArticle();
            this.showLoading(false);
            
            // Update daily info to show reset mistakes counter
            this.updateDailyInfo();
            
            // Only show welcome screen for today's article, not for random or archive
            const isTodaysArticle = targetDate === this.currentDateString;
            const isTodaysCompleted = isTodaysArticle && this.isCompleted(targetDate);
            
            if (isTodaysCompleted) {
                // Today's puzzle is already completed (win or loss) - show completed state
                this.lastGameResult = this.isWon(targetDate) ? 'win' : 'loss';
                this.replaceWrongWordsWithCorrect();
                this.showPostGameMessage();
                // Hide submit buttons since puzzle is completed
                const submitButtons = document.getElementById('submit-buttons');
                if (submitButtons) submitButtons.style.display = 'none';
                // Show game content directly (no welcome screen, no game start)
                const welcomeScreen = document.getElementById('welcome-screen');
                const gameContent = document.getElementById('game-content');
                if (welcomeScreen) welcomeScreen.style.display = 'none';
                if (gameContent) gameContent.style.display = 'block';
            } else if (isTodaysArticle) {
                this.showWelcomeScreen();
            } else {
                // For random/archive articles, start the game immediately
                this.startGame();
            }
            
        } catch (error) {
            console.error('Error in loadDailyGame:', error);
            alert('Failed to load game. Please try again.');
            this.showLoading(false);
        }
    }
    
    updateNewspaperDate() {
        // Always use today's date for the newspaper date, regardless of article date
        const date = new Date();
        
        // Format date in newspaper style: MONDAY, OCTOBER 17, 2024
        const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
                       'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
        const dayOfWeek = days[date.getDay()];
        const month = months[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        const formattedDate = `${dayOfWeek}, ${month} ${day}, ${year}`;
        
        // Update newspaper date in top-left corner
        const newspaperDateEl = document.getElementById('newspaper-date');
        if (newspaperDateEl) {
            newspaperDateEl.textContent = formattedDate;
        }
    }
    
    updateDailyInfo() {
        const rawDateString = this.selectedDate || this.currentDateString;
        const dateString = this.getValidGameDate(rawDateString);
        const puzzleNumber = this.calculatePuzzleNumber(dateString);
        const date = new Date(dateString);
        
        // Format date (newspaper style: NOV 4, 2024)
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
                       'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const year = date.getFullYear();
        const formattedDate = `${months[date.getMonth()]} ${date.getDate()}, ${year}`;
        
        // Update puzzle number
        const puzzleEl = document.getElementById('puzzle-number');
        if (puzzleEl) puzzleEl.textContent = `#${puzzleNumber}`;
        
        // Update date
        const dateEl = document.getElementById('daily-date');
        if (dateEl) dateEl.textContent = formattedDate;
        
        // Update tries display with icons
        this.updateTriesDisplay();
        
        // Update newspaper date in top-left corner
        this.updateNewspaperDate();
    }
    
    setupEventListeners() {
        const submitGuessBtn = document.getElementById('submit-guess-btn');
        if (submitGuessBtn) submitGuessBtn.addEventListener('click', () => this.submitGuess());
        
        const clearSelectionBtn = document.getElementById('clear-selection-btn');
        if (clearSelectionBtn) clearSelectionBtn.addEventListener('click', () => this.clearSelection());
        
        const closeArchiveBtn = document.getElementById('close-archive-btn');
        if (closeArchiveBtn) closeArchiveBtn.addEventListener('click', () => this.closeArchiveModal());
        
        const playArchivesBtn = document.getElementById('play-archives-btn');
        if (playArchivesBtn) playArchivesBtn.addEventListener('click', () => {
            this.closeCompletionModal();
            this.showArchiveModal();
        });
        
        const playRandomBtn = document.getElementById('play-random-btn');
        if (playRandomBtn) playRandomBtn.addEventListener('click', () => {
            this.closeCompletionModal();
            this.playRandomArticle();
        });
        
        const closeCompletionBtn = document.getElementById('close-completion-btn');
        if (closeCompletionBtn) closeCompletionBtn.addEventListener('click', () => this.closeCompletionModal());
        
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) shareBtn.addEventListener('click', () => this.shareCompletion());
        
        // Post-game buttons
        const postGameFeedbackBtn = document.getElementById('post-game-feedback-btn');
        if (postGameFeedbackBtn) {
            postGameFeedbackBtn.addEventListener('click', async () => {
                const email = 'feedback@dailytypo.com';
                try {
                    await navigator.clipboard.writeText(email);
                    // Show temporary feedback message
                    const originalHTML = postGameFeedbackBtn.innerHTML;
                    postGameFeedbackBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Email copied
                    `;
                    setTimeout(() => {
                        postGameFeedbackBtn.innerHTML = originalHTML;
                    }, 2000);
                } catch (err) {
                    // Fallback if clipboard API fails
                    alert(`Email copied: ${email}`);
                }
            });
        }
        
        const postGameRandomBtn = document.getElementById('post-game-random-btn');
        if (postGameRandomBtn) {
            postGameRandomBtn.addEventListener('click', () => {
                this.hidePostGameMessage();
                this.playRandomArticle();
            });
        }
        
        const postGameArchiveBtn = document.getElementById('post-game-archive-btn');
        if (postGameArchiveBtn) {
            postGameArchiveBtn.addEventListener('click', () => {
                this.hidePostGameMessage();
                this.showArchiveModal();
            });
        }
        
        const donateBtn = document.getElementById('donate-btn');
        if (donateBtn) donateBtn.addEventListener('click', () => {
            window.open('https://ko-fi.com/dailytypo', '_blank');
        });
        
        // Hamburger menu
        const hamburgerMenu = document.getElementById('hamburger-menu');
        const menuDropdown = document.getElementById('menu-dropdown');
        if (hamburgerMenu && menuDropdown) {
            hamburgerMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = menuDropdown.style.display !== 'none';
                menuDropdown.style.display = isVisible ? 'none' : 'block';
            });
            
            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!menuDropdown.contains(e.target) && !hamburgerMenu.contains(e.target)) {
                    menuDropdown.style.display = 'none';
                }
            });
            
            // Menu item handlers
            const playRandomMenuLink = document.getElementById('play-random-menu-link');
            if (playRandomMenuLink) {
                playRandomMenuLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    menuDropdown.style.display = 'none';
                    this.playRandomArticle();
                });
            }
            
            const archiveLink = document.getElementById('archive-link');
            if (archiveLink) {
                archiveLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    menuDropdown.style.display = 'none';
                    this.showArchiveModal();
                });
            }
            
            const feelingStuckLink = document.getElementById('feeling-stuck-link');
            if (feelingStuckLink) {
                feelingStuckLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    menuDropdown.style.display = 'none';
                    alert('Feeling stuck? You can always open Wikipedia and study the article! :-)');
                });
            }
            
            const donateLink = document.getElementById('donate-link');
            if (donateLink) {
                donateLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    menuDropdown.style.display = 'none';
                    window.open('https://ko-fi.com/dailytypo', '_blank');
                });
            }
        }
        
        // Tutorial section toggle
        const tutorialHeader = document.getElementById('tutorial-header');
        const tutorialSection = document.querySelector('.tutorial-section');
        if (tutorialHeader && tutorialSection) {
            tutorialHeader.addEventListener('click', () => {
                tutorialSection.classList.toggle('collapsed');
            });
        }
        
        // Feedback section toggle
        const feedbackHeader = document.getElementById('feedback-header');
        if (feedbackHeader) {
            feedbackHeader.addEventListener('click', () => {
                const feedbackSection = feedbackHeader.closest('.tutorial-section');
                if (feedbackSection) {
                    feedbackSection.classList.toggle('collapsed');
                }
            });
        }
        
        // Start game button
        const startGameBtn = document.getElementById('start-game-btn');
        if (startGameBtn) {
            startGameBtn.addEventListener('click', () => this.startGame());
        }
        
        // Welcome screen action buttons
        const welcomeFeedbackBtn = document.getElementById('welcome-feedback-btn');
        if (welcomeFeedbackBtn) {
            welcomeFeedbackBtn.addEventListener('click', async () => {
                const email = 'feedback@dailytypo.com';
                try {
                    await navigator.clipboard.writeText(email);
                    // Show temporary feedback message
                    const originalText = welcomeFeedbackBtn.innerHTML;
                    welcomeFeedbackBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Email copied
                    `;
                    setTimeout(() => {
                        welcomeFeedbackBtn.innerHTML = originalText;
                    }, 2000);
                } catch (err) {
                    // Fallback if clipboard API fails
                    alert(`Email copied: ${email}`);
                }
            });
        }
        
        const welcomeRandomBtn = document.getElementById('welcome-random-btn');
        if (welcomeRandomBtn) {
            welcomeRandomBtn.addEventListener('click', () => {
                // Hide welcome screen - playRandomArticle will show the game
                const welcomeScreen = document.getElementById('welcome-screen');
                if (welcomeScreen) {
                    welcomeScreen.style.display = 'none';
                }
                this.playRandomArticle();
            });
        }
        
        // Game title click handler - acts as home/refresh button
        const gameTitleWrapper = document.querySelector('.game-title-wrapper');
        if (gameTitleWrapper) {
            gameTitleWrapper.addEventListener('click', () => {
                // Close any open modals
                this.closeCompletionModal();
                this.closeArchiveModal();
                // Load today's game (refresh)
                this.loadDailyGame();
            });
        }
    }
    
    clearHighlights() {
        // Clear word-clickable highlights
        const selectedWords = document.querySelectorAll('.word-clickable.word-selected');
        selectedWords.forEach(word => {
            word.classList.remove('word-selected');
        });
    }
    
    showFloatingSubmit() {
        const submitButtons = document.getElementById('submit-buttons');
        
        // Don't show buttons if today's puzzle is already completed
        const dateString = this.selectedDate || this.currentDateString;
        const isTodaysArticle = dateString === this.currentDateString;
        const isTodaysCompleted = isTodaysArticle && this.isCompleted(dateString);
        
        // Don't show buttons if game is over (out of tries) or puzzle is completed
        if (isTodaysCompleted || this.selectedWords.length === 0 || this.triesRemaining <= 0) {
            if (submitButtons) submitButtons.style.display = 'none';
            return;
        }
        
        // Show buttons in fixed position above article content
        if (submitButtons) submitButtons.style.display = 'flex';
    }
    
    clearSelection() {
        this.clearHighlights();
        // Only clear selected words, not correct ones
        this.selectedWords = this.selectedWords.filter(w => w.classList.contains('word-correct'));
        // Also keep words that are correctly highlighted
        const submitButtons = document.getElementById('submit-buttons');
        if (submitButtons) {
            // Hide submit buttons if no non-correct words are selected
            const hasNonCorrectSelection = this.selectedWords.some(w => !w.classList.contains('word-correct'));
            if (!hasNonCorrectSelection) {
                submitButtons.style.display = 'none';
            }
        }
    }
    async fetchWikipediaArticle(title) {
        try {
            // Use Simple English Wikipedia
            const url = `https://simple.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to fetch article`);
            }
            
            const data = await response.json();
            
            if (!data.extract || data.extract.trim().length < 50) {
                throw new Error('Article extract too short');
            }
            
            const category = this.getArticleCategory(data.title, data.description);
            
            return {
                title: data.title,
                extract: data.extract,
                thumbnail: data.thumbnail?.source || null,
                description: data.description || null,
                category: category
            };
        } catch (error) {
            console.error('Wikipedia API error:', error);
            // Return null to trigger fallback
            return null;
        }
    }
    
    getArticleCategory(title, description) {
        // Categorize articles based on title and description
        const titleLower = title.toLowerCase();
        const descLower = (description || '').toLowerCase();
        
        // Geography/Places
        const places = ['paris', 'tokyo', 'mount everest', 'grand canyon', 'eiffel tower'];
        if (places.some(p => titleLower.includes(p))) {
            return 'Geography';
        }
        
        // People
        const people = ['einstein', 'shakespeare', 'leonardo', 'mozart', 'michael jackson', 'beatles'];
        if (people.some(p => titleLower.includes(p))) {
            return 'Biography';
        }
        
        // Science & Technology
        const science = ['internet', 'coffee', 'chocolate'];
        if (science.some(s => titleLower.includes(s))) {
            if (titleLower.includes('internet')) return 'Technology';
            if (titleLower.includes('coffee') || titleLower.includes('chocolate')) return 'Food & Drink';
        }
        
        // Sports & Events
        const events = ['olympic', 'games'];
        if (events.some(e => titleLower.includes(e))) {
            return 'Sports & Events';
        }
        
        // Entertainment
        const entertainment = ['beatles', 'mickey mouse', 'titanic'];
        if (entertainment.some(e => titleLower.includes(e))) {
            return 'Entertainment';
        }
        
        // Nature
        const nature = ['moon', 'grand canyon', 'mount everest'];
        if (nature.some(n => titleLower.includes(n))) {
            return 'Nature';
        }
        
        // Food
        const food = ['chocolate', 'coffee', 'pizza'];
        if (food.some(f => titleLower.includes(f))) {
            return 'Food & Drink';
        }
        
        // Default categories based on description keywords
        if (descLower.includes('city') || descLower.includes('country') || descLower.includes('capital')) {
            return 'Geography';
        }
        if (descLower.includes('invented') || descLower.includes('scientist') || descLower.includes('discovered')) {
            return 'Science';
        }
        if (descLower.includes('food') || descLower.includes('drink') || descLower.includes('recipe')) {
            return 'Food & Drink';
        }
        
        return 'General Knowledge';
    }
    
    getFallbackArticle(title) {
        // Fallback articles if Wikipedia API fails
        const fallbacks = {
            'Paris': {
                title: 'Paris',
                extract: 'Paris is the capital and most populous city of France. With an official estimated population of 2,165,423 residents as of 1 January 2019 in an area of more than 105 km², Paris is the fourth-largest city in the European Union and the 30th most densely populated city in the world in 2022. Since the 17th century, Paris has been one of Europe\'s major centres of finance, diplomacy, commerce, fashion, science, and arts.',
                thumbnail: null,
                description: null,
                category: 'Geography'
            },
            'Chocolate': {
                title: 'Chocolate',
                extract: 'Chocolate is a food product made from roasted and ground cacao pods, that is available as a liquid, solid or paste, on its own or as a flavoring agent in other foods. Cacao has been consumed in some form since at least the Olmec civilization (19th–11th century BCE), and the majority of Mesoamerican people made chocolate beverages.',
                thumbnail: null,
                description: null,
                category: 'Food & Drink'
            }
        };
        
        const fallback = fallbacks[title] || fallbacks['Paris'];
        if (!fallback.category) {
            fallback.category = this.getArticleCategory(fallback.title, fallback.description);
        }
        return fallback;
    }
    
    displayArticle() {
        document.getElementById('article-title').textContent = this.currentArticle.title;
        
        // Update category display
        const categoryText = this.currentArticle.category || 'General Knowledge';
        document.getElementById('article-category').textContent = categoryText;
        
        // Check for special day message - check both article's specialDay field and date-based lookup
        const dateString = this.selectedDate || this.currentDateString;
        const savedArticle = this.getArticleForDate(dateString);
        const specialDayMessage = this.getSpecialDayMessage(dateString, savedArticle);
        const specialDayEl = document.getElementById('special-day-message');
        const specialDayTextEl = specialDayEl ? specialDayEl.querySelector('.special-day-text') : null;
        if (specialDayMessage && specialDayEl && specialDayTextEl) {
            specialDayTextEl.textContent = specialDayMessage;
            specialDayEl.style.display = 'flex';
        } else if (specialDayEl) {
            specialDayEl.style.display = 'none';
        }
        
        const contentDiv = document.getElementById('article-content');
        let displayText = this.currentArticle.extract;
        
        const paragraphs = displayText.split(/\n\n+/).filter(p => p.trim());
        
        let html = '';
        
        // Add thumbnail image if available (Wikipedia-style infobox)
        if (this.currentArticle.thumbnail) {
            html += `<div class="article-thumbnail">
                <img src="${this.currentArticle.thumbnail}" alt="${this.currentArticle.title}" style="max-width: 100%; height: auto;">
            </div>`;
        }
        
        // Add paragraphs with clickable words
        // Track occurrences of wrong words for validation
        let wrongWordOccurrenceCount = 0;
        const errorWord = this.errorWord ? this.errorWord.toLowerCase().replace(/[^\w]/g, '') : null;
        
        html += paragraphs.map(para => {
            // Split text into words, preserving spaces
            const words = para.split(/(\s+)/);
            const wrappedWords = words.map(word => {
                // Keep whitespace as-is (spaces, newlines, etc.)
                if (/^\s+$/.test(word)) {
                    return word;
                }
                // Check if this word matches the error word and track occurrence
                const normalizedWord = word.replace(/[^\w]/g, '').toLowerCase();
                let occurrenceAttr = '';
                if (errorWord && normalizedWord === errorWord) {
                    wrongWordOccurrenceCount++;
                    occurrenceAttr = ` data-wrong-occurrence="${wrongWordOccurrenceCount}"`;
                }
                // Wrap words in clickable spans without extra spacing
                const wordClass = 'word-clickable';
                return `<span class="${wordClass}"${occurrenceAttr}>${word}</span>`;
            }).join('');
            return `<p>${wrappedWords}</p>`;
        }).join('');
        
        contentDiv.innerHTML = html;
        
        // Make content selectable
        contentDiv.style.userSelect = 'text';
        contentDiv.style.webkitUserSelect = 'text';
        
        // Add click handlers to words
        this.setupWordClickHandlers();
    }
    
    setupWordClickHandlers() {
        const clickableWords = document.querySelectorAll('.word-clickable');
        
        clickableWords.forEach(word => {
            word.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectWord(word);
            });
        });
    }
    
    selectWord(wordElement) {
        const wordText = wordElement.textContent.trim();
        
        if (!wordText || wordText.length === 0) {
            return;
        }
        
        // Toggle selection - if already selected, deselect it
        if (wordElement.classList.contains('word-selected')) {
            wordElement.classList.remove('word-selected');
            this.selectedWords = this.selectedWords.filter(el => el !== wordElement);
        } else {
            // Select the word
            wordElement.classList.add('word-selected');
            this.selectedWords.push(wordElement);
        }
        
        // Show floating submit button
        this.showFloatingSubmit();
    }
    
    submitGuess() {
        // Use selected words
        let guess = '';
        if (this.selectedWords.length > 0) {
            // Get text content, remove punctuation, normalize
            guess = this.selectedWords.map(el => {
                let text = el.textContent.trim();
                // Remove common punctuation
                text = text.replace(/[.,!?;:()"'-]/g, '');
                return text.toLowerCase();
            }).join(' ').toLowerCase();
        }
        
        const feedbackDiv = document.getElementById('feedback');
        
        if (!guess) {
            feedbackDiv.textContent = 'Please select word(s) from the article first!';
            feedbackDiv.className = 'feedback incorrect';
            return;
        }
        
        let isCorrect = false;
        let correctAnswer = '';
        // Split and clean guess words
        const guessWords = guess.split(/\s+/).filter(w => {
            // Remove empty strings and very short words
            return w.length > 0 && w.replace(/[^\w]/g, '').length > 0;
        }).map(w => w.replace(/[^\w]/g, '')); // Remove any remaining punctuation
        
        if (this.errorType === 'word') {
            // Support multiple error words if available
            const errorWords = this.errorWords || [this.errorWord.toLowerCase()];
            const originalWords = this.originalWords || [this.originalWord.toLowerCase()];
            
            
            // Normalize error and original words (remove punctuation)
            const normalizedErrorWords = errorWords.map(ew => ew.replace(/[^\w]/g, '').toLowerCase());
            const normalizedOriginalWords = originalWords.map(ow => ow.replace(/[^\w]/g, '').toLowerCase());
            
            // Count how many selected words match wrong words (error words)
            let correctMatches = 0;
            let incorrectMatches = 0;
            
            // Check each selected word
            guessWords.forEach((gw, wordIndex) => {
                const normalizedGw = gw.replace(/[^\w]/g, '').toLowerCase();
                
                // Get the word element to check its occurrence
                const wordElement = this.selectedWords[wordIndex];
                const wordOccurrence = wordElement ? parseInt(wordElement.getAttribute('data-wrong-occurrence')) : null;
                
                // Check if it matches any wrong word (should be selected)
                // Use exact match first, then check if one word is contained in the other (but be more strict)
                const matchesError = normalizedErrorWords.some(ew => {
                    // Exact match is best
                    if (normalizedGw === ew) {
                        return true;
                    }
                    // Only allow substring match if one is significantly shorter than the other
                    // (e.g., "the" in "there" is not a match, but "run" in "running" might be)
                    const lengthDiff = Math.abs(normalizedGw.length - ew.length);
                    const minLength = Math.min(normalizedGw.length, ew.length);
                    // Allow substring match only if the shorter word is at least 3 chars and 
                    // the length difference is reasonable (not more than 2 chars)
                    if (minLength >= 3 && lengthDiff <= 2) {
                        if (normalizedGw.includes(ew) || ew.includes(normalizedGw)) {
                            return true;
                        }
                    }
                    return false;
                });
                
                // If wrongOccurrence is specified and word matches error word, check occurrence
                if (matchesError && this.wrongOccurrence !== null && this.wrongOccurrence > 0) {
                    if (wordOccurrence !== this.wrongOccurrence) {
                        // This word matches the error word but is the wrong occurrence, treat as incorrect
                        incorrectMatches++;
                        return; // Skip rest of processing for this word
                    }
                }
                
                // Check if it matches any original/correct word (should NOT be selected)
                const matchesOriginal = normalizedOriginalWords.some(ow => {
                    // Exact match means wrong selection
                    if (normalizedGw === ow) {
                        return true;
                    }
                    // Substring match with same rules
                    const lengthDiff = Math.abs(normalizedGw.length - ow.length);
                    const minLength = Math.min(normalizedGw.length, ow.length);
                    if (minLength >= 3 && lengthDiff <= 2) {
                        if (normalizedGw.includes(ow) || ow.includes(normalizedGw)) {
                            return true;
                        }
                    }
                    return false;
                });
                
                if (matchesError) {
                    correctMatches++;
                } else if (matchesOriginal) {
                    incorrectMatches++;
                } else {
                    // This word doesn't match any wrong or correct word - it's an extra word
                    incorrectMatches++; // Count extra words as incorrect
                }
            });
            
            // Win condition: Must select ONLY wrong words, no correct words, no extra words
            // All selected words must match wrong words, and none should match correct words
            const hasCorrectWord = correctMatches > 0;
            const hasIncorrectWord = incorrectMatches > 0;
            // All selected words must be wrong words, and we must have selected at least one wrong word
            // AND we must have selected ALL wrong words (if there's only one) or at least one (if multiple)
            const allSelectedAreWrong = hasCorrectWord && !hasIncorrectWord;
            // Must have selected all wrong words (if single) or at least one (if multiple)
            // For single wrong word: allow selecting all occurrences (all selected must match the wrong word)
            // For multiple wrong words: must select all unique wrong words
            const selectedAllWrongWords = errorWords.length === 1 
                ? correctMatches === guessWords.length && correctMatches >= 1
                : correctMatches >= 1 && guessWords.length === correctMatches;
            
            if (allSelectedAreWrong && selectedAllWrongWords) {
                isCorrect = true;
                // Show all corrections if multiple
                if (errorWords.length > 1) {
                    const corrections = errorWords.map((ew, i) => 
                        `"${ew}" should be "${originalWords[i]}"`
                    ).join(', ');
                    correctAnswer = corrections;
                } else {
                    correctAnswer = `"${this.errorWord}" should be "${this.originalWord}"`;
                }
            }
        }
        
        // Hide submit buttons after any guess (correct or incorrect)
        const submitButtons = document.getElementById('submit-buttons');
        if (submitButtons) {
            submitButtons.style.display = 'none';
        }
        
        if (isCorrect) {
            this.showCompletionModal(correctAnswer);
            this.updateMistakesDisplay();
        } else {
            // Wrong guess - remove a try
            this.triesRemaining--;
            
            // Mark selected words as wrong (red highlight)
            this.markWordsAsWrong();
            
            // Hide feedback box (we use shake + wrong indicator instead)
            feedbackDiv.textContent = '';
            feedbackDiv.className = 'feedback';
            
            // Shake animation
            this.shakeArticle();
            
            // Update mistakes display
            this.updateMistakesDisplay();
            this.updateDailyInfo();
            
            // Animate pencil icon bounce
            this.animatePencilIcon();
            
            if (this.triesRemaining <= 0) {
                // Out of tries - show the answer
                this.showGameOver();
            }
        }
    }
    
    shakeArticle() {
        const articleWrapper = document.querySelector('.article-wrapper');
        articleWrapper.classList.add('shake');
        setTimeout(() => {
            articleWrapper.classList.remove('shake');
        }, 500);
    }
    
    updateTriesDisplay() {
        const container = document.getElementById('pencil-icons-container');
        const textEl = document.getElementById('mistakes-left-text');
        if (!container) return;
        
        // Calculate tries left (number of visible icons)
        const triesLeft = Math.max(0, this.triesRemaining);
        
        // Clear existing icons
        container.innerHTML = '';
        
        // Create pencil icon SVG
        const createPencilIcon = () => {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'pencil-icon');
            svg.setAttribute('width', '14');
            svg.setAttribute('height', '14');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            
            const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path1.setAttribute('d', 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7');
            
            const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path2.setAttribute('d', 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z');
            
            svg.appendChild(path1);
            svg.appendChild(path2);
            return svg;
        };
        
        // Create icons for remaining tries (max 3)
        const maxTriesToShow = 3;
        for (let i = 0; i < maxTriesToShow; i++) {
            const icon = createPencilIcon();
            if (i >= triesLeft) {
                icon.classList.add('faded');
            }
            container.appendChild(icon);
        }
        
        // Update text - stays constant
        if (textEl) {
            textEl.textContent = 'attempts remaining';
        }
    }
    
    animatePencilIcon() {
        const pencilIcons = document.querySelectorAll('.pencil-icon:not(.faded)');
        pencilIcons.forEach((pencilIcon) => {
            // Remove any existing bounce class
            pencilIcon.classList.remove('bounce');
            // Force reflow to ensure the class removal is processed
            void pencilIcon.offsetWidth;
            // Add bounce class to trigger animation
            pencilIcon.classList.add('bounce');
            // Remove the class after animation completes
            setTimeout(() => {
                pencilIcon.classList.remove('bounce');
            }, 500);
        });
    }
    
    updateMistakesDisplay() {
        // Update tries display with icons
        this.updateTriesDisplay();
    }
    
    markWordsAsWrong() {
        // Add wrong class to all selected words
        this.selectedWords.forEach(wordEl => {
            wordEl.classList.add('word-wrong');
            // Remove selection highlight but keep wrong highlight
            wordEl.classList.remove('word-selected');
        });
        
            // Remove wrong highlight after a delay (keep it visible for a bit)
            setTimeout(() => {
                this.selectedWords.forEach(wordEl => {
                    wordEl.classList.remove('word-wrong');
                });
                // Clear selection after showing wrong - buttons will reappear when user selects again
                this.clearSelection();
            }, 2000);
    }
    
    markWordsAsCorrect() {
        // Only highlight words that actually match the error word (the wrong word in text)
        // Get the normalized error words to check against
        const errorWords = this.errorWords || [this.errorWord.toLowerCase()];
        const normalizedErrorWords = errorWords.map(ew => ew.replace(/[^\w]/g, '').toLowerCase());
        
        // Only mark words as correct if they match the error word
        this.selectedWords.forEach(wordEl => {
            const wordText = wordEl.textContent.trim().toLowerCase();
            const normalizedWord = wordText.replace(/[^\w]/g, '');
            
            
            // Check if this word matches any error word - use strict matching
            const isCorrectWord = normalizedErrorWords.some(ew => {
                // Exact match or the word is the error word (allowing for slight variations)
                const exactMatch = normalizedWord === ew;
                // Only allow substring matches if the word is significantly longer (to avoid false matches)
                const substringMatch = (normalizedWord.length >= ew.length - 1 && normalizedWord.length <= ew.length + 1) &&
                                       (normalizedWord.includes(ew) || ew.includes(normalizedWord));
                return exactMatch || substringMatch;
            });
            
            
            if (isCorrectWord) {
                wordEl.classList.add('word-correct');
                // Remove selection highlight but keep correct highlight
                wordEl.classList.remove('word-selected');
            } else {
                // This word was selected but isn't the correct answer - just remove selection highlight
                wordEl.classList.remove('word-selected');
                // Remove from selectedWords array since it's not the correct word
                this.selectedWords = this.selectedWords.filter(w => w !== wordEl);
            }
        });
        
    }
    
    clearCorrectHighlights() {
        // Clear correct word highlights
        const correctWords = document.querySelectorAll('.word-clickable.word-correct');
        correctWords.forEach(word => {
            word.classList.remove('word-correct');
        });
    }
    
    showGameOver() {
        let answerMessage = '';
        const answerText = this.errorWords && this.errorWords.length > 1 
            ? this.errorWords.map((ew, i) => `"${ew}" should be "${this.originalWords[i]}"`).join(', ')
            : `"${this.errorWord}" should be "${this.originalWord}"`;
        answerMessage = answerText;
        
        // Mark as game over to lock the puzzle
        const dateString = this.selectedDate || this.currentDateString;
        this.markGameOver(dateString);
        
        // Replace wrong words with correct words in the article
        this.replaceWrongWordsWithCorrect();
        
        // Hide submit buttons since game is over
        const submitButtons = document.getElementById('submit-buttons');
        if (submitButtons) {
            submitButtons.style.display = 'none';
        }
        
        // Show completion modal with the answer (isWin = false)
        this.showCompletionModal(answerMessage, false);
        
        // Disable submit button
        const submitBtn = document.getElementById('submit-guess-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
        }
    }
    
    showCompletionModal(message, isWin = true) {
        const dateString = this.selectedDate || this.currentDateString;
        
        // Track game result
        this.lastGameResult = isWin ? 'win' : 'loss';
        
        // Only mark as completed if it's a win
        if (isWin) {
            this.markCompleted(dateString);
            // Update stats
            this.updateStats();
            // Replace wrong words with correct words in the article
            this.replaceWrongWordsWithCorrect();
        }
        
        // Update title and checkmark based on win/loss
        const modalTitle = document.querySelector('#completion-modal h2');
        const checkmark = document.querySelector('.checkmark-animation');
        if (modalTitle) {
            modalTitle.textContent = isWin ? 'Correct!' : 'Game Over';
        }
        if (checkmark) {
            checkmark.style.display = isWin ? 'block' : 'none';
        }
        
        // Update completion message with highlighted words
        const completionMessage = document.getElementById('completion-message');
        if (completionMessage) {
            const correctionText = message.split('\n')[0] || message;
            
            // Parse the message to highlight wrong word (red) and correct word (green)
            // Format: "wrongword" should be "correctword" or multiple: "word1" should be "word2", "word3" should be "word4"
            let formattedMessage = correctionText;
            
            // Match pattern: "word" should be "word"
            const pattern = /"([^"]+)"\s+should be\s+"([^"]+)"/g;
            formattedMessage = formattedMessage.replace(pattern, (match, wrongWord, correctWord) => {
                return `<span class="typo-word">"${wrongWord}"</span> should be <span class="correct-word">"${correctWord}"</span>`;
            });
            
            completionMessage.innerHTML = formattedMessage;
        }
        
        // Calculate and display elapsed time
        if (isWin && this.gameStartTime) {
            const elapsedMs = Date.now() - this.gameStartTime;
            this.elapsedTime = elapsedMs;
            const elapsedSeconds = Math.floor(elapsedMs / 1000);
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            
            const timerEl = document.getElementById('completion-timer');
            if (timerEl) {
                let timeText;
                if (minutes > 0) {
                    timeText = `${minutes}m ${seconds}s`;
                } else {
                    timeText = `${seconds}s`;
                }
                timerEl.innerHTML = `<span class="timer-label">Solved in</span> <span class="timer-value">${timeText}</span>`;
            }
        } else {
            const timerEl = document.getElementById('completion-timer');
            if (timerEl) {
                timerEl.textContent = '';
            }
        }
        
        // Update Wikipedia link
        const wikipediaLink = document.getElementById('wikipedia-link');
        if (wikipediaLink && this.currentArticle) {
            wikipediaLink.href = this.getWikipediaUrl(this.currentArticle.title);
        }
        
        // Show modal
        const modal = document.getElementById('completion-modal');
        if (modal) {
            // Prevent body scrollbar when modal opens
            document.body.style.overflow = 'hidden';
            modal.style.display = 'flex';
        }
        
        // Clear selection
        this.clearSelection();
    }
    
    closeCompletionModal() {
        const modal = document.getElementById('completion-modal');
        if (modal) {
            modal.style.display = 'none';
            // Restore body scroll
            document.body.style.overflow = '';
            
            // Show post-game message with options
            this.showPostGameMessage();
        }
    }
    
    showPostGameMessage() {
        const postGameMessage = document.getElementById('post-game-message');
        const postGameText = document.getElementById('post-game-text');
        const countdownSection = document.getElementById('countdown-section');
        
        if (!postGameMessage || !postGameText) return;
        
        // Hide submit buttons when showing post-game message (game is over)
        const submitButtons = document.getElementById('submit-buttons');
        if (submitButtons) {
            submitButtons.style.display = 'none';
        }
        
        // Clear any existing countdown interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        // Check if today's puzzle is completed
        const dateString = this.selectedDate || this.currentDateString;
        const isToday = dateString === this.currentDateString;
        const isCompleted = this.isCompleted(dateString);
        const wasWin = this.lastGameResult === 'win';
        const wasLoss = this.lastGameResult === 'loss';
        
        if (wasLoss && isToday) {
            // User lost today's puzzle
            postGameText.textContent = "Better luck next time! A new puzzle will be available tomorrow. You can also try a random puzzle or browse the archive to keep playing.";
            if (countdownSection) countdownSection.style.display = 'block';
            this.startCountdown();
        } else if (wasLoss && !isToday) {
            // User lost an archived/random puzzle
            postGameText.textContent = "Better luck next time! Want to try another puzzle?";
            if (countdownSection) countdownSection.style.display = 'none';
        } else if (isToday && isCompleted) {
            // Today's puzzle is completed (win)
            postGameText.textContent = "Great job! Come back tomorrow for a new puzzle.";
            if (countdownSection) countdownSection.style.display = 'block';
            this.startCountdown();
        } else if (isToday && !isCompleted) {
            // Today's puzzle not completed (shouldn't happen, but just in case)
            postGameText.textContent = "Keep trying! You can also play random puzzles or browse the archive.";
            if (countdownSection) countdownSection.style.display = 'none';
        } else {
            // Playing archived or random puzzle (win)
            postGameText.textContent = "Want to play more? Try a random puzzle or browse the archive.";
            if (countdownSection) countdownSection.style.display = 'none';
        }
        
        postGameMessage.style.display = 'block';
    }
    
    startCountdown() {
        const countdownTimer = document.getElementById('countdown-timer');
        if (!countdownTimer) return;
        
        const updateCountdown = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            const diff = tomorrow - now;
            
            if (diff <= 0) {
                countdownTimer.textContent = '00:00:00';
                if (this.countdownInterval) {
                    clearInterval(this.countdownInterval);
                    this.countdownInterval = null;
                }
                return;
            }
            
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            countdownTimer.textContent = 
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        };
        
        // Update immediately
        updateCountdown();
        
        // Update every second
        this.countdownInterval = setInterval(updateCountdown, 1000);
    }
    
    hidePostGameMessage() {
        const postGameMessage = document.getElementById('post-game-message');
        if (postGameMessage) {
            postGameMessage.style.display = 'none';
        }
        
        // Clear countdown interval when hiding
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }
    
    async playRandomArticle() {
        if (!this.articlesConfig || !this.articlesConfig.articles || this.articlesConfig.articles.length === 0) {
            alert('No articles available. Please try again.');
            return;
        }
        
        // Get valid today's date (at least Oct 27, 2025)
        const validTodayDate = this.getValidGameDate(this.currentDateString);
        const todayPuzzleNumber = this.calculatePuzzleNumber(validTodayDate);
        
        // Ensure we have at least 2 games available (today + at least one past puzzle)
        if (todayPuzzleNumber < 2) {
            // If today is puzzle #1, there are no past puzzles to pick from
            alert('Not enough puzzles available yet. Come back tomorrow for more puzzles!');
            return;
        }
        
        // Pick a random puzzle number between 1 and (today's number - 1) to exclude today
        const maxRandomPuzzle = todayPuzzleNumber - 1;
        const randomPuzzleNumber = Math.floor(Math.random() * maxRandomPuzzle) + 1;
        
        // Calculate the date for this puzzle number
        const randomDateString = this.calculateDateFromPuzzleNumber(randomPuzzleNumber);
        
        // Load the game for this random date
        await this.loadDailyGame(randomDateString);
        // Update display to show reset mistakes
        this.updateDailyInfo();
    }
    
    shareCompletion() {
        if (!this.currentArticle) return;
        
        const rawDateString = this.selectedDate || this.currentDateString;
        const validDateString = this.getValidGameDate(rawDateString);
        const puzzleNumber = this.calculatePuzzleNumber(validDateString);
        const streak = this.calculateStreak();
        
        // Random variations of newspaper headlines
        const headlines = [
            
            '📰 THIS JUST IN!',
            '📰 EXTRA EXTRA!',
            '📰 BREAKING NEWS!',
            '📰 STOP THE PRESSES!'
        ];
        const headline = headlines[Math.floor(Math.random() * headlines.length)];
        
        // Build share text (minimal, per spec)
        let shareText = `${headline}\n\n`;
        
        // Check if user won or lost
        if (this.lastGameResult === 'win') {
            // Add elapsed time if available - put it on same line as "Found the typo."
            if (this.elapsedTime) {
                const elapsedSeconds = Math.floor(this.elapsedTime / 1000);
                const minutes = Math.floor(elapsedSeconds / 60);
                const seconds = elapsedSeconds % 60;
                const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                shareText += `Found the typo. ⏱ ${timeStr}\n\n`;
            } else {
                shareText += `Found the typo.\n\n`;
            }
        } else {
            // User didn't find the typo
            shareText += `I didn't find the typo. Can you?\n\n`;
        }
        
        // Prefer production URL; fallback to current URL if not available
        const shareUrl = 'https://dailytypo.com/';
        
        // Add URL to text (single instance) - reduced spacing
        const shareTextWithUrl = `${shareText}${shareUrl}`;
        
        // Detect if actual mobile device (phone/tablet) - be strict to avoid desktop triggering
        // Only check user agent for real mobile devices, ignore screen size/touch as desktop can have those
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Use Web Share API only on actual mobile devices - desktop always copies to clipboard
        // Even if desktop browser supports Web Share API, we want clipboard copy for consistency
        if (isMobile && navigator.share) {
            navigator.share({
                title: 'The Daily Typo',
                text: shareTextWithUrl
            }).catch(err => {
                // User cancelled or error - fallback to clipboard
                if (err.name !== 'AbortError') {
                }
                this.copyToClipboard(shareTextWithUrl);
            });
        } else {
            // Desktop or no Web Share API - copy to clipboard (like Wordle)
            this.copyToClipboard(shareTextWithUrl);
        }
    }
    
    copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                // Show temporary feedback
                const shareBtn = document.getElementById('share-btn');
                if (shareBtn) {
                    const originalHTML = shareBtn.innerHTML;
                    shareBtn.innerHTML = 'Copied!';
                    setTimeout(() => {
                        shareBtn.innerHTML = originalHTML;
                    }, 2000);
                }
            }).catch(err => {
                console.error('Failed to copy:', err);
                alert('Share text copied to clipboard:\n\n' + text);
            });
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                const shareBtn = document.getElementById('share-btn');
                if (shareBtn) {
                    const originalHTML = shareBtn.innerHTML;
                    shareBtn.innerHTML = 'Copied!';
                    setTimeout(() => {
                        shareBtn.innerHTML = originalHTML;
                    }, 2000);
                }
            } catch (err) {
                alert('Share text:\n\n' + text);
            }
            document.body.removeChild(textarea);
        }
    }
    
    showArchiveModal() {
        document.body.style.overflow = 'hidden';
        const modal = document.getElementById('archive-modal');
        const archiveList = document.getElementById('archive-list');
        
        if (!modal || !archiveList) return;
        
        // Show all available articles (puzzles 1 through yesterday, excluding today)
        const totalArticles = this.articlesConfig.articles.length;
        const validTodayDate = this.getValidGameDate(this.currentDateString);
        const todayPuzzleNumber = this.calculatePuzzleNumber(validTodayDate);
        // Exclude today's puzzle - show only up to yesterday
        const maxPuzzleNumber = Math.min(totalArticles, Math.max(1, todayPuzzleNumber - 1));
        
        const puzzles = [];
        
        for (let puzzleNum = 1; puzzleNum <= maxPuzzleNumber; puzzleNum++) {
            // Get article
            const article = this.articlesConfig.articles[puzzleNum - 1];
            
            // Calculate date for this puzzle
            const dateString = this.calculateDateFromPuzzleNumber(puzzleNum);
            
            // Skip if this date is in the future or is today (safety check)
            if (this.isFutureDate(dateString) || dateString === this.currentDateString) {
                continue;
            }
            
            // Format date
            const date = new Date(dateString + 'T00:00:00');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const formatted = `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
            
            // Check if completed
            const completed = this.isCompleted(dateString);
            
            puzzles.push({
                num: puzzleNum,
                date: dateString,
                title: article.title,
                formatted: formatted,
                completed: completed
            });
        }
        
        // Render (newest first)
        archiveList.innerHTML = puzzles.reverse().map(p => `
            <div class="archive-item ${p.completed ? 'completed' : ''}" data-date="${p.date}">
                <span class="archive-number">#${p.num}</span>
                <span class="archive-title">${p.title}</span>
                <span class="archive-date">${p.formatted}</span>
            </div>
        `).join('');
        
        // Click handler
        archiveList.querySelectorAll('.archive-item').forEach(el => {
            el.addEventListener('click', () => {
                const date = el.dataset.date;
                this.closeArchiveModal();
                this.loadDailyGame(date);
            });
        });
        
        modal.style.display = 'flex';
    }
    
    closeArchiveModal() {
        const modal = document.getElementById('archive-modal');
        if (modal) {
            modal.style.display = 'none';
            // Restore body scroll
            document.body.style.overflow = '';
        }
    }
    
    showNoArticlesMessage() {
        const feedbackDiv = document.getElementById('feedback');
        if (feedbackDiv) {
            feedbackDiv.innerHTML = 
                `<div style="text-align: center; padding: 20px;">
                    <h3 style="color: #666; margin: 0 0 10px 0;">No Articles Available</h3>
                    <p style="margin: 0; color: #999;">Please ensure articles-config.json contains articles.</p>
                </div>`;
            feedbackDiv.className = 'feedback';
        }
    }
    
    replaceWrongWordsWithCorrect() {
        // Replace wrong words with correct words in the displayed article
        if (!this.errorWords || !this.originalWords) return;
        
        // Find all word elements that contain the wrong words
        const allWordElements = document.querySelectorAll('#article-content .word-clickable');
        const targetOccurrence = this.wrongOccurrence;
        
        allWordElements.forEach(wordEl => {
            const wordText = wordEl.textContent.trim();
            const normalizedWord = wordText.replace(/[^\w]/g, '').toLowerCase();
            
            // Check if this word matches any error word
            for (let i = 0; i < this.errorWords.length; i++) {
                const errorWord = this.errorWords[i].replace(/[^\w]/g, '').toLowerCase();
                const originalWord = this.originalWords[i];
                
                if (normalizedWord === errorWord || (normalizedWord.length >= errorWord.length - 1 && normalizedWord.length <= errorWord.length + 1 && 
                    (normalizedWord.includes(errorWord) || errorWord.includes(normalizedWord)))) {
                    
                    // If wrongOccurrence is specified, check the data attribute instead of counting
                    if (targetOccurrence !== null && targetOccurrence > 0) {
                        const wordOccurrence = parseInt(wordEl.getAttribute('data-wrong-occurrence'));
                        if (wordOccurrence !== targetOccurrence) {
                            // Not the target occurrence, skip this one
                            break;
                        }
                    }
                    
                    // Preserve punctuation and case
                    const hasPunctuation = /[^\w]/.test(wordText);
                    const punctuation = hasPunctuation ? wordText.match(/[^\w]+$/)?.[0] || '' : '';
                    const isCapitalized = wordText[0] === wordText[0].toUpperCase();
                    
                    // Build replacement word with correct case
                    let replacementWord = originalWord;
                    if (isCapitalized) {
                        replacementWord = originalWord.charAt(0).toUpperCase() + originalWord.slice(1);
                    }
                    
                    // Add back punctuation if it existed
                    wordEl.textContent = replacementWord + punctuation;
                    wordEl.classList.add('word-correct');
                    wordEl.classList.remove('word-selected', 'word-wrong');
                    
                    break; // Only replace once per word
                }
            }
        });
    }
    
    resetGameState() {
        this.currentArticle = null;
        this.errorWord = null;
        this.originalWord = null;
        this.errorWords = [];
        this.originalWords = [];
        this.wrongOccurrence = null;
        this.errorSentence = null;
        this.errorType = null;
        this.triesRemaining = this.maxTries;
        this.selectedWords = [];
        this.clearSelection();
        this.updateMistakesDisplay();
        // Don't start timer here - it will be started when user clicks "Play Today's Article"
        this.gameStartTime = null;
        
        // Clear countdown interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        // Safely update feedback element if it exists
        const feedbackDiv = document.getElementById('feedback');
        if (feedbackDiv) {
            feedbackDiv.textContent = '';
            feedbackDiv.className = 'feedback';
        }
        
        // Clear correct highlights when resetting
        this.clearCorrectHighlights();
        
        // Reset submit buttons
        const submitButtonsDiv = document.getElementById('submit-buttons');
        if (submitButtonsDiv) {
            submitButtonsDiv.innerHTML = `
                <button id="submit-guess-btn" class="submit-btn primary">SUBMIT ANSWER</button>
                <button id="clear-selection-btn" class="submit-btn clear">Clear</button>
            `;
            const submitBtn = document.getElementById('submit-guess-btn');
            const clearBtn = document.getElementById('clear-selection-btn');
            if (submitBtn) {
                submitBtn.addEventListener('click', () => this.submitGuess());
                submitBtn.disabled = false;
            }
            if (clearBtn) {
                clearBtn.addEventListener('click', () => this.clearSelection());
            }
            submitButtonsDiv.style.display = 'none';
        }
        
        // Reset share button to original state
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
            shareBtn.innerHTML = `
                <svg class="share-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
                Share
            `;
        }
    }
    
    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        const welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }
        if (!show) {
            // Don't show game content here - it will be shown by startGame()
            document.getElementById('game-content').style.display = 'none';
        }
    }
    
    showWelcomeScreen() {
        const welcomeScreen = document.getElementById('welcome-screen');
        const gameContent = document.getElementById('game-content');
        const loading = document.getElementById('loading');
        
        // Update welcome screen with puzzle info
        const rawDateString = this.selectedDate || this.currentDateString;
        const dateString = this.getValidGameDate(rawDateString);
        const puzzleNumber = this.calculatePuzzleNumber(dateString);
        const date = new Date(dateString);
        
        // Format date (newspaper style: NOV 4, 2024)
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
                       'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const year = date.getFullYear();
        const formattedDate = `${months[date.getMonth()]} ${date.getDate()}, ${year}`;
        
        
        if (welcomeScreen) {
            welcomeScreen.style.display = 'block';
        }
        if (gameContent) {
            gameContent.style.display = 'none';
        }
        if (loading) {
            loading.style.display = 'none';
        }
    }
    
    startGame() {
        // Check if today's puzzle is already completed - if so, show completed state instead
        const dateString = this.selectedDate || this.currentDateString;
        const isTodaysArticle = dateString === this.currentDateString;
        const isTodaysCompleted = isTodaysArticle && this.isCompleted(dateString);
        
        if (isTodaysCompleted) {
            // Today's puzzle is already completed - show completed state
            this.lastGameResult = 'win';
            this.replaceWrongWordsWithCorrect();
            this.showPostGameMessage();
            // Hide submit buttons since puzzle is completed
            const submitButtons = document.getElementById('submit-buttons');
            if (submitButtons) submitButtons.style.display = 'none';
            const welcomeScreen = document.getElementById('welcome-screen');
            const gameContent = document.getElementById('game-content');
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (gameContent) gameContent.style.display = 'block';
            return;
        }
        
        // Start the timer
        this.gameStartTime = Date.now();
        
        // Hide welcome screen and show game content
        const welcomeScreen = document.getElementById('welcome-screen');
        const gameContent = document.getElementById('game-content');
        
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }
        if (gameContent) {
            gameContent.style.display = 'block';
        }
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.game = new DailyTypoGame();
    
    // Debug helper functions (available in console)
    window.clearToday = () => {
        const game = window.game;
        if (!game) {
            console.error('Game not initialized');
            return;
        }
        const today = game.currentDateString;
        const completions = JSON.parse(localStorage.getItem('dailyTypoCompletions') || '{}');
        delete completions[today];
        localStorage.setItem('dailyTypoCompletions', JSON.stringify(completions));
        console.log(`✓ Today's puzzle (${today}) cleared! Reloading...`);
        location.reload();
    };
    
    window.showNextDay = async () => {
        const game = window.game;
        if (!game) {
            console.error('Game not initialized');
            return;
        }
        // Get the currently displayed date (or today if none selected)
        const currentDisplayDate = game.selectedDate || game.currentDateString;
        const currentDate = currentDisplayDate.includes('T') 
            ? new Date(currentDisplayDate) 
            : new Date(currentDisplayDate + 'T00:00:00');
        const nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateString = game.getDateString(nextDate);
        console.log(`✓ Loading next day's puzzle (${nextDateString})...`);
        await game.loadDailyGame(nextDateString, true); // allowFuture = true for preview
    };
});

