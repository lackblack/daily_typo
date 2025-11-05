class DailyTypoGame {
    constructor() {
        this.currentArticle = null;
        this.errorWord = null;
        this.originalWord = null;
        this.errorWords = [];
        this.originalWords = [];
        this.errorSentence = null;
        this.errorType = null;
        this.triesRemaining = 3; // 3 total attempts = 2 mistakes allowed
        this.maxTries = 3;
        this.selectedWords = [];
        this.articlesConfig = null;
        this.lastGameResult = null; // Track last game result: 'win', 'loss', or null
        this.gameStartTime = null; // Track when game started for timer
        this.elapsedTime = null; // Store elapsed time when game completes
        
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
            completedAt: new Date().toISOString()
        };
        this.saveCompletions();
    }
    
    isCompleted(dateString) {
        return this.completions[dateString] && this.completions[dateString].completed;
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
            
            if (this.isCompleted(dateString)) {
                streak++;
            } else if (i > 0) {
                // If we find a gap, stop counting
                break;
            }
        }
        
        return streak;
    }
    
    calculateXP() {
        let xp = 0;
        const today = new Date();
        
        // Calculate XP from completions (each completion = 100 XP)
        for (let i = 0; i < 365; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateString = this.getDateString(date);
            
            if (this.isCompleted(dateString)) {
                xp += 100;
            }
        }
        
        return xp;
    }
    
    updateStats() {
        const streak = this.calculateStreak();
        
        const streakEl = document.getElementById('streak-count');
        if (streakEl) streakEl.textContent = streak;
    }
    
    async loadArticlesConfig() {
        try {
            const response = await fetch(`articles-config.json?t=${Date.now()}`, {
                cache: 'no-store'
            });
            
            if (response.ok) {
                this.articlesConfig = await response.json();
                console.log(`✓ Loaded ${this.articlesConfig.articles.length} articles`);
            } else {
                console.error(`⚠ Failed to load articles-config.json: HTTP ${response.status}`);
                this.articlesConfig = { version: "1.0", articles: [] };
            }
        } catch (error) {
            console.error('Error loading articles-config.json:', error);
            this.articlesConfig = { version: "1.0", articles: [] };
        }
    }
    
    async loadDailyGame(dateString = null) {
        try {
            this.resetGameState();
            this.hidePostGameMessage();
            this.lastGameResult = null; // Reset game result when loading new game
            this.showLoading(true);
            
            // Ensure we use a valid game date (on or after Oct 27, 2025)
            const rawDate = dateString || this.currentDateString;
            const targetDate = this.getValidGameDate(rawDate);
            this.selectedDate = targetDate;
            
            if (!this.articlesConfig || !this.articlesConfig.articles || this.articlesConfig.articles.length === 0) {
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
            
            console.log('Loading article for date:', targetDate, savedArticle.title);
            
            this.currentArticle = {
                title: savedArticle.title,
                extract: savedArticle.extract,
                category: savedArticle.category || 'General Knowledge',
                thumbnail: savedArticle.thumbnail || null,
                description: savedArticle.description || null
            };
            
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
            
            // Find the sentence containing the error
            const sentences = this.currentArticle.extract.match(/[^.!?]+[.!?]+/g) || [];
            this.errorSentence = sentences.find(s => 
                this.errorWords.some(ew => s.toLowerCase().includes(ew))
            ) || '';
            
            this.displayArticle();
            this.showLoading(false);
            
            // Update daily info to show reset mistakes counter
            this.updateDailyInfo();
            
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
    
    saveArticlesConfigToStorage() {
        try {
            localStorage.setItem('wikiGameArticles', JSON.stringify(this.articlesConfig));
            console.log('Articles saved to localStorage');
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }
    
    exportArticlesConfig() {
        // Optional: Export to file for backup/sharing
        const jsonStr = JSON.stringify(this.articlesConfig, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'articles-config.json';
        a.click();
        URL.revokeObjectURL(url);
    }
    
    saveArticlesConfig() {
        // Auto-save to localStorage (instant, no file dialog)
        this.saveArticlesConfigToStorage();
        return true;
    }
    
    async loadWordReplacements() {
        try {
            // Try to load from config file (for local/online deployment)
            const response = await fetch('word-replacements.json');
            if (response.ok) {
                this.wordReplacements = await response.json();
                this.replacementsLoaded = true;
                console.log('Word replacements loaded from config');
                return;
            }
        } catch (error) {
            console.log('Could not load word-replacements.json, using fallback');
        }
        
        // Fallback: Use default replacements
        this.wordReplacements = this.getDefaultReplacements();
        this.replacementsLoaded = true;
    }
    
    getDefaultReplacements() {
        // Default replacements if JSON file is not available
        return {
            version: "1.0",
            categories: {
                geographic: {
                    "city": ["town", "village"],
                    "town": ["city"],
                    "capital": ["largest"],
                    "largest": ["smallest"],
                    "country": ["nation"],
                    "nation": ["country"],
                    "river": ["lake"],
                    "lake": ["river"],
                    "mountain": ["hill"],
                    "hill": ["mountain"],
                    "ocean": ["sea"],
                    "sea": ["ocean"],
                    "island": ["peninsula"],
                    "peninsula": ["island"]
                },
                size_quantity: {
                    "large": ["small"],
                    "small": ["large"],
                    "big": ["small"],
                    "tiny": ["huge"],
                    "huge": ["tiny"],
                    "million": ["thousand"],
                    "thousand": ["million"],
                    "many": ["few"],
                    "few": ["many"],
                    "most": ["least"],
                    "least": ["most"]
                },
                time_periods: {
                    "century": ["decade"],
                    "decade": ["century"],
                    "ancient": ["modern"],
                    "modern": ["ancient"],
                    "old": ["new"],
                    "new": ["old"],
                    "first": ["last"],
                    "last": ["first"],
                    "early": ["late"],
                    "late": ["early"]
                },
                adjectives: {
                    "famous": ["unknown"],
                    "unknown": ["famous"],
                    "important": ["minor"],
                    "major": ["minor"],
                    "popular": ["obscure"],
                    "obscure": ["popular"],
                    "highest": ["lowest"],
                    "lowest": ["highest"],
                    "largest": ["smallest"],
                    "smallest": ["largest"],
                    "hot": ["cold"],
                    "cold": ["hot"],
                    "long": ["short"],
                    "short": ["long"],
                    "high": ["low"],
                    "low": ["high"]
                },
                directions: {
                    "north": ["south"],
                    "south": ["north"],
                    "east": ["west"],
                    "west": ["east"],
                    "eastern": ["western"],
                    "western": ["eastern"],
                    "northern": ["southern"],
                    "southern": ["northern"]
                }
            },
            fallbacks: {
                short_words: ["small", "large", "first", "major"],
                medium_words: ["ancient", "modern", "popular", "famous"],
                long_words: ["important", "beautiful", "powerful", "successful"]
            },
            number_modifiers: {
                small_change_percent: [0.15, 0.25],
                medium_change_percent: [0.20, 0.40],
                date_change_years_modern: [10, 30],
                date_change_years_ancient: [20, 50]
            }
        };
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
            window.open('https://ko-fi.com/artbyjoonas', '_blank');
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
                    alert('Feeling stuck? You can always open Wikipedia and study the article!');
                });
            }
            
            const donateLink = document.getElementById('donate-link');
            if (donateLink) {
                donateLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    menuDropdown.style.display = 'none';
                    window.open('https://ko-fi.com/artbyjoonas', '_blank');
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
        
        if (this.selectedWords.length === 0) {
            submitButtons.style.display = 'none';
            return;
        }
        
        // Show buttons in fixed position above article content
        submitButtons.style.display = 'flex';
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
    
    injectError(text) {
        // Simple error injection: replace one word, number, or date with a plausible alternative
        // Priority: dates → numbers → specific words
        
        // Try to find and replace a date/year first (most common and plausible)
        if (this.injectDateError(text)) {
            this.errorType = 'sentence'; // Dates are usually in sentences
            return;
        }
        
        // Try to replace a number with units
        if (this.injectNumberError(text)) {
            this.errorType = 'sentence';
            return;
        }
        
        // Fall back to word replacement
        this.injectWordError(text);
    }
    
    injectDateError(text) {
        // Find years (4-digit numbers typically between 1000-2100)
        const yearPattern = /\b(1[0-9]{3}|20[0-1][0-9])\b/g;
        const years = text.match(yearPattern);
        
        if (years && years.length > 0) {
            const originalYear = years[Math.floor(Math.random() * years.length)];
            const originalYearNum = parseInt(originalYear);
            
            // Get date change modifiers from config or use defaults
            let modernRange, ancientRange;
            if (this.wordReplacements && this.wordReplacements.number_modifiers) {
                modernRange = this.wordReplacements.number_modifiers.date_change_years_modern || [10, 30];
                ancientRange = this.wordReplacements.number_modifiers.date_change_years_ancient || [20, 50];
            } else {
                modernRange = [10, 30];
                ancientRange = [20, 50];
            }
            
            // Generate a plausible wrong year
            let wrongYearNum;
            if (originalYearNum > 1900) {
                // For modern years, use configured range
                const minChange = modernRange[0];
                const maxChange = modernRange[1];
                const change = (Math.random() > 0.5 ? 1 : -1) * (minChange + Math.floor(Math.random() * (maxChange - minChange + 1)));
                wrongYearNum = originalYearNum + change;
                // Keep in reasonable range
                if (wrongYearNum < 1900) wrongYearNum = 1900 + Math.floor(Math.random() * 50);
                if (wrongYearNum > 2025) wrongYearNum = 2025 - Math.floor(Math.random() * 30);
            } else {
                // For older years, use configured range
                const minChange = ancientRange[0];
                const maxChange = ancientRange[1];
                const change = (Math.random() > 0.5 ? 1 : -1) * (minChange + Math.floor(Math.random() * (maxChange - minChange + 1)));
                wrongYearNum = originalYearNum + change;
            }
            
            const wrongYear = wrongYearNum.toString();
            
            // Replace first occurrence
            this.currentArticle.extract = text.replace(originalYear, wrongYear);
            this.errorWord = wrongYear;
            this.originalWord = originalYear;
            this.errorSentence = null; // Will be set to the sentence containing the error
            
            // Find the sentence containing this error
            const sentences = this.currentArticle.extract.match(/[^.!?]+[.!?]+/g) || [];
            this.errorSentence = sentences.find(s => s.includes(wrongYear)) || '';
            
            return true;
        }
        
        return false;
    }
    
    injectNumberError(text) {
        // Find numbers with units (populations, sizes, distances, etc.)
        const numberPattern = /\b\d{1,3}[,\s]?\d{0,3}\s*(million|thousand|hundred|km|miles?|meters?|feet?|people|residents?|inhabitants?)\b/gi;
        const numbers = text.match(numberPattern);
        
        if (numbers && numbers.length > 0) {
            const originalNumber = numbers[Math.floor(Math.random() * numbers.length)];
            
            // Extract the numeric part and unit
            const match = originalNumber.match(/(\d{1,3}[,\s]?\d{0,3})\s*(\w+)/i);
            if (!match) return false;
            
            const numStr = match[1].replace(/[,\s]/g, '');
            const unit = match[2];
            const originalNum = parseInt(numStr);
            
            // Get number change modifiers from config or use defaults
            let smallPercentRange, mediumPercentRange;
            if (this.wordReplacements && this.wordReplacements.number_modifiers) {
                smallPercentRange = this.wordReplacements.number_modifiers.small_change_percent || [0.15, 0.25];
                mediumPercentRange = this.wordReplacements.number_modifiers.medium_change_percent || [0.20, 0.40];
            } else {
                smallPercentRange = [0.15, 0.25];
                mediumPercentRange = [0.20, 0.40];
            }
            
            // Generate plausible wrong number
            let wrongNum;
            if (originalNum > 1000) {
                // For large numbers, use small change range
                const minPercent = smallPercentRange[0];
                const maxPercent = smallPercentRange[1];
                const percentChange = minPercent + Math.random() * (maxPercent - minPercent);
                const change = (Math.random() > 0.5 ? 1 : -1) * Math.floor(originalNum * percentChange);
                wrongNum = originalNum + change;
                // Ensure positive
                if (wrongNum < 1) wrongNum = originalNum + Math.floor(originalNum * 0.2);
            } else {
                // For smaller numbers, use medium change range
                const minPercent = mediumPercentRange[0];
                const maxPercent = mediumPercentRange[1];
                const percentChange = minPercent + Math.random() * (maxPercent - minPercent);
                const change = (Math.random() > 0.5 ? 1 : -1) * Math.floor(originalNum * percentChange);
                wrongNum = originalNum + change;
                if (wrongNum < 1) wrongNum = originalNum + Math.floor(originalNum * 0.3);
            }
            
            // Format the wrong number (add commas for readability if large)
            let wrongNumberStr = wrongNum.toString();
            if (wrongNum >= 1000) {
                wrongNumberStr = wrongNum.toLocaleString();
            }
            
            const wrongNumber = wrongNumberStr + ' ' + unit;
            
            // Replace first occurrence
            this.currentArticle.extract = text.replace(originalNumber, wrongNumber);
            this.errorWord = wrongNumber;
            this.originalWord = originalNumber;
            this.errorSentence = null;
            
            // Find the sentence containing this error
            const sentences = this.currentArticle.extract.match(/[^.!?]+[.!?]+/g) || [];
            this.errorSentence = sentences.find(s => s.includes(wrongNumber)) || '';
            
            return true;
        }
        
        return false;
    }
    
    injectWordError(text) {
        // Find common nouns/adjectives to replace with contextually appropriate alternatives
        const words = text.match(/\b[A-Z][a-z]+\b|\b[a-z]{4,}\b/g) || [];
        const mainSubjectWords = this.currentArticle.title.split(/\s+/).map(w => w.toLowerCase());
        
        const replaceableWords = words.filter(w => {
            const lower = w.toLowerCase();
            return w.length >= 4 && 
                   !mainSubjectWords.includes(lower) &&
                   !['the', 'that', 'this', 'with', 'from', 'their', 'there', 'these', 'those', 'which', 'where', 'when'].includes(lower);
        });
        
        if (replaceableWords.length === 0) {
            // If no words found, try a simple number replacement
            const simpleNumberPattern = /\b\d{2,3}\b/;
            const simpleNumber = text.match(simpleNumberPattern);
            if (simpleNumber) {
                const originalNum = parseInt(simpleNumber[0]);
                const wrongNum = originalNum + (Math.random() > 0.5 ? 10 : -10);
                this.currentArticle.extract = text.replace(simpleNumber[0], wrongNum.toString());
                this.errorWord = wrongNum.toString();
                this.originalWord = simpleNumber[0];
                this.errorType = 'sentence';
                
                const sentences = this.currentArticle.extract.match(/[^.!?]+[.!?]+/g) || [];
                this.errorSentence = sentences.find(s => s.includes(wrongNum.toString())) || '';
                return;
            }
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * replaceableWords.length);
        this.originalWord = replaceableWords[randomIndex];
        
        // Generate a contextually appropriate wrong word
        this.errorWord = this.generateWrongWord(this.originalWord);
        
        // Replace only the FIRST occurrence of the word (case-sensitive for first letter)
        const wordRegex = new RegExp(`\\b${this.originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        this.currentArticle.extract = text.replace(wordRegex, match => {
            // Preserve case
            if (match[0] === match[0].toUpperCase()) {
                return this.errorWord.charAt(0).toUpperCase() + this.errorWord.slice(1);
            }
            return this.errorWord.toLowerCase();
        });
        
        this.errorType = 'word';
        
        // Find the sentence containing this error
        const sentences = this.currentArticle.extract.match(/[^.!?]+[.!?]+/g) || [];
        this.errorSentence = sentences.find(s => s.includes(this.errorWord)) || '';
    }
    
    generateWrongWord(original) {
        // Wait for replacements to be loaded if not ready yet
        if (!this.replacementsLoaded || !this.wordReplacements) {
            // Use simple fallback if config not loaded
            const simpleFallbacks = ['small', 'large', 'first', 'major', 'ancient', 'modern'];
            return simpleFallbacks[Math.floor(Math.random() * simpleFallbacks.length)];
        }
        
        const lowerOriginal = original.toLowerCase();
        
        // Search through all categories for a match
        for (const categoryName in this.wordReplacements.categories) {
            const category = this.wordReplacements.categories[categoryName];
            if (category[lowerOriginal] && category[lowerOriginal].length > 0) {
                // Pick a random replacement from the array
                const replacements = category[lowerOriginal];
                return replacements[Math.floor(Math.random() * replacements.length)];
            }
        }
        
        // If no match found, use fallback based on word length
        const length = original.length;
        let fallbackArray;
        
        if (length <= 4) {
            fallbackArray = this.wordReplacements.fallbacks.short_words;
        } else if (length <= 6) {
            fallbackArray = this.wordReplacements.fallbacks.medium_words;
        } else {
            fallbackArray = this.wordReplacements.fallbacks.long_words;
        }
        
        if (fallbackArray && fallbackArray.length > 0) {
            return fallbackArray[Math.floor(Math.random() * fallbackArray.length)];
        }
        
        // Ultimate fallback
        return 'small';
    }
    
    displayArticle() {
        document.getElementById('article-title').textContent = this.currentArticle.title;
        
        // Update category display
        const categoryText = this.currentArticle.category || 'General Knowledge';
        document.getElementById('article-category').textContent = categoryText;
        
        const contentDiv = document.getElementById('article-content');
        let displayText = this.currentArticle.extract;
        
        // If hide wrong info is enabled, mask the wrong parts
        if (this.hideWrongInfo) {
            displayText = this.maskWrongInfo(displayText);
        }
        
        const paragraphs = displayText.split(/\n\n+/).filter(p => p.trim());
        
        let html = '';
        
        // Add thumbnail image if available (Wikipedia-style infobox)
        if (this.currentArticle.thumbnail) {
            html += `<div class="article-thumbnail">
                <img src="${this.currentArticle.thumbnail}" alt="${this.currentArticle.title}" style="max-width: 100%; height: auto;">
            </div>`;
        }
        
        // Add paragraphs with clickable words
        html += paragraphs.map(para => {
            // Split text into words, preserving spaces
            const words = para.split(/(\s+)/);
            const wrappedWords = words.map(word => {
                // Keep whitespace as-is (spaces, newlines, etc.)
                if (/^\s+$/.test(word)) {
                    return word;
                }
                // Check if this word is masked (contains ▓ or similar)
                const isMasked = /[▓█░]/.test(word);
                const wordClass = isMasked ? 'word-clickable word-masked' : 'word-clickable';
                // Wrap words in clickable spans without extra spacing
                return `<span class="${wordClass}">${word}</span>`;
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
    
    maskWrongInfo(text) {
        // Intelligently mask the wrong information while preserving context
        if (this.errorType === 'word' && this.errorWord && this.originalWord) {
            // Mask the wrong word, but show its length and first letter as hint
            const masked = this.createSmartMask(this.errorWord);
            // Replace all instances of the error word (case-insensitive)
            const regex = new RegExp(`\\b${this.errorWord}\\b`, 'gi');
            return text.replace(regex, match => {
                // Preserve case
                if (match[0] === match[0].toUpperCase()) {
                    return masked.charAt(0).toUpperCase() + masked.slice(1);
                }
                return masked;
            });
        } else if (this.errorType === 'sentence' && this.errorSentence) {
            // For sentences, mask the key wrong facts (dates, numbers, specific wrong words)
            let masked = this.errorSentence;
            
            // Mask dates (keep structure but hide exact numbers)
            masked = masked.replace(/\b\d{3,4}\b/g, (match) => {
                const num = parseInt(match);
                // Show approximate range as hint with masking
                if (num > 1900) return '▓▓▓▓'; // Year - 4 chars
                if (num > 100) return '▓▓▓'; // Large number - 3 chars
                return '▓▓'; // Small number - 2 chars
            });
            
            // Mask numbers with units (keep unit visible as hint)
            masked = masked.replace(/\b\d{1,3}[,\s]?\d{0,3}\s*(million|thousand|hundred|km|miles?)\b/gi, (match) => {
                const unit = match.match(/(million|thousand|hundred|km|miles?)/i)?.[0] || '';
                const digits = match.match(/\d/g);
                const numDigits = digits ? digits.length : 3;
                return '▓'.repeat(Math.min(numDigits, 5)) + ' ' + unit;
            });
            
            // Find specific wrong words from similar articles and mask them
            if (this.errorWord) {
                const wordRegex = new RegExp(`\\b${this.errorWord}\\b`, 'gi');
                masked = masked.replace(wordRegex, match => {
                    const masked = this.createSmartMask(this.errorWord);
                    if (match[0] === match[0].toUpperCase()) {
                        return masked.charAt(0).toUpperCase() + masked.slice(1);
                    }
                    return masked;
                });
            }
            
            // Replace the sentence in the text
            return text.replace(this.errorSentence, masked);
        }
        
        return text;
    }
    
    createSmartMask(word) {
        // Create a smart mask that preserves some information as hint
        const length = word.length;
        const firstLetter = word[0].toUpperCase();
        const lastLetter = word[word.length - 1].toLowerCase();
        
        // Create mask with first letter visible, rest masked
        // This gives a hint while hiding the wrong info
        if (length <= 3) {
            return firstLetter + '▓'.repeat(Math.max(1, length - 1));
        } else if (length <= 6) {
            return firstLetter + '▓'.repeat(length - 2) + lastLetter;
        } else {
            // For longer words, show first 2 letters and last letter
            return word.substring(0, 2) + '▓'.repeat(Math.max(1, length - 3)) + lastLetter;
        }
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
        
        console.log('Guess:', guess);
        console.log('Guess words:', guessWords);
        
        if (this.errorType === 'word') {
            // Support multiple error words if available
            const errorWords = this.errorWords || [this.errorWord.toLowerCase()];
            const originalWords = this.originalWords || [this.originalWord.toLowerCase()];
            
            console.log('Error words (wrong words in text):', errorWords);
            console.log('Original words (correct words):', originalWords);
            console.log('Error word:', this.errorWord);
            console.log('Original word:', this.originalWord);
            
            // Normalize error and original words (remove punctuation)
            const normalizedErrorWords = errorWords.map(ew => ew.replace(/[^\w]/g, '').toLowerCase());
            const normalizedOriginalWords = originalWords.map(ow => ow.replace(/[^\w]/g, '').toLowerCase());
            
            // Count how many selected words match wrong words (error words)
            let correctMatches = 0;
            let incorrectMatches = 0;
            
            // Check each selected word
            guessWords.forEach(gw => {
                const normalizedGw = gw.replace(/[^\w]/g, '').toLowerCase();
                
                // Check if it matches any wrong word (should be selected)
                // Use exact match first, then check if one word is contained in the other (but be more strict)
                const matchesError = normalizedErrorWords.some(ew => {
                    // Exact match is best
                    if (normalizedGw === ew) {
                        console.log(`✓ Exact match: "${normalizedGw}" matches wrong word "${ew}"`);
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
                            console.log(`✓ Substring match: "${normalizedGw}" matches wrong word "${ew}"`);
                            return true;
                        }
                    }
                    return false;
                });
                
                // Check if it matches any original/correct word (should NOT be selected)
                const matchesOriginal = normalizedOriginalWords.some(ow => {
                    // Exact match means wrong selection
                    if (normalizedGw === ow) {
                        console.log(`✗ Incorrect: "${normalizedGw}" matches correct word "${ow}" (should not be selected)`);
                        return true;
                    }
                    // Substring match with same rules
                    const lengthDiff = Math.abs(normalizedGw.length - ow.length);
                    const minLength = Math.min(normalizedGw.length, ow.length);
                    if (minLength >= 3 && lengthDiff <= 2) {
                        if (normalizedGw.includes(ow) || ow.includes(normalizedGw)) {
                            console.log(`✗ Incorrect: "${normalizedGw}" matches correct word "${ow}" (should not be selected)`);
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
                    console.log(`✗ Extra word selected: "${normalizedGw}" (not a wrong word)`);
                    incorrectMatches++; // Count extra words as incorrect
                }
            });
            
            console.log(`Selected words: ${guessWords.length}, Correct matches: ${correctMatches}, Incorrect matches: ${incorrectMatches}`);
            
            // Win condition: Must select ONLY wrong words, no correct words, no extra words
            // All selected words must match wrong words, and none should match correct words
            const hasCorrectWord = correctMatches > 0;
            const hasIncorrectWord = incorrectMatches > 0;
            // All selected words must be wrong words, and we must have selected at least one wrong word
            // AND we must have selected ALL wrong words (if there's only one) or at least one (if multiple)
            const allSelectedAreWrong = hasCorrectWord && !hasIncorrectWord;
            // Must have selected all wrong words (if single) or at least one (if multiple)
            const selectedAllWrongWords = errorWords.length === 1 
                ? correctMatches === 1 && guessWords.length === 1
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
            } else {
                console.log('Guess failed: must select ONLY wrong word(s), no extra or correct words.');
            }
        } else {
            // Check if guess matches key words from the error sentence
            const errorWords = this.errorSentence.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            
            const matches = errorWords.filter(ew => 
                guessWords.some(gw => ew.includes(gw) || gw.includes(ew))
            );
            
            // Also check if guess contains significant parts of the error sentence
            const sentenceMatch = guess.includes(this.errorSentence.toLowerCase().substring(0, 20));
            
            if (matches.length >= 2 || guessWords.length >= 3 || sentenceMatch) {
                isCorrect = true;
                correctAnswer = `The sentence "${this.errorSentence}" contains an error.`;
            }
        }
        
        // Hide submit buttons after any guess (correct or incorrect)
        const submitButtons = document.getElementById('submit-buttons');
        if (submitButtons) {
            submitButtons.style.display = 'none';
        }
        
        if (isCorrect) {
            console.log('Correct answer! Showing completion modal...');
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
            
            // Show "Wrong" indicator briefly
            this.showWrongIndicator();
            
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
        
        // Calculate tries left (triesRemaining - 1 = tries left)
        const triesLeft = Math.max(0, this.triesRemaining - 1);
        
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
        
        // Create icons for remaining tries (max 2)
        const maxTriesToShow = 2;
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
    
    updateLevelDisplay() {
        const currentLevelEl = document.getElementById('current-level');
        const maxLevelsEl = document.getElementById('max-levels');
        if (currentLevelEl) currentLevelEl.textContent = this.currentLevel.toString();
        if (maxLevelsEl) maxLevelsEl.textContent = this.maxLevels.toString();
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
        
        console.log('Marking words as correct. Error words to match:', normalizedErrorWords);
        
        // Only mark words as correct if they match the error word
        this.selectedWords.forEach(wordEl => {
            const wordText = wordEl.textContent.trim().toLowerCase();
            const normalizedWord = wordText.replace(/[^\w]/g, '');
            
            console.log(`Checking word "${normalizedWord}" against error words:`, normalizedErrorWords);
            
            // Check if this word matches any error word - use strict matching
            const isCorrectWord = normalizedErrorWords.some(ew => {
                // Exact match or the word is the error word (allowing for slight variations)
                const exactMatch = normalizedWord === ew;
                // Only allow substring matches if the word is significantly longer (to avoid false matches)
                const substringMatch = (normalizedWord.length >= ew.length - 1 && normalizedWord.length <= ew.length + 1) &&
                                       (normalizedWord.includes(ew) || ew.includes(normalizedWord));
                return exactMatch || substringMatch;
            });
            
            console.log(`Word "${normalizedWord}" is correct:`, isCorrectWord);
            
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
        
        console.log('Final selectedWords count (correct only):', this.selectedWords.length);
    }
    
    clearCorrectHighlights() {
        // Clear correct word highlights
        const correctWords = document.querySelectorAll('.word-clickable.word-correct');
        correctWords.forEach(word => {
            word.classList.remove('word-correct');
        });
    }
    
    showWrongIndicator() {
        const wrongIndicator = document.getElementById('wrong-indicator');
        if (wrongIndicator) {
            wrongIndicator.style.display = 'inline';
            wrongIndicator.style.animation = 'none';
            
            // Force reflow
            void wrongIndicator.offsetWidth;
            
            wrongIndicator.style.animation = 'shake 0.5s ease, fadeOut 0.5s ease 1s forwards';
            
            setTimeout(() => {
                wrongIndicator.style.display = 'none';
            }, 1500);
        }
    }
    
    showGameOver() {
        let answerMessage = '';
        if (this.errorType === 'word') {
            const answerText = this.errorWords && this.errorWords.length > 1 
                ? this.errorWords.map((ew, i) => `"${ew}" should be "${this.originalWords[i]}"`).join(', ')
                : `"${this.errorWord}" should be "${this.originalWord}"`;
            answerMessage = answerText;
        } else {
            answerMessage = `The error was in: "${this.errorSentence}"`;
        }
        
        // Replace wrong words with correct words in the article
        this.replaceWrongWordsWithCorrect();
        
        // Show completion modal with the answer (isWin = false)
        this.showCompletionModal(answerMessage, false);
        
        // Disable submit button
        const submitBtn = document.getElementById('submit-guess-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
        }
    }
    
    showGameComplete() {
        const feedbackDiv = document.getElementById('feedback');
        if (feedbackDiv) {
            feedbackDiv.innerHTML = 
                `<div style="text-align: center; padding: 20px;">
                    <h2 style="color: #28a745; margin: 0 0 10px 0;">🎉 Game Complete!</h2>
                    <p style="margin: 0;">You completed all ${this.maxLevels} levels!</p>
                    <p style="margin: 10px 0 0 0; font-size: 0.9rem;">Final Score: ${this.score}</p>
                </div>`;
            feedbackDiv.className = 'feedback correct';
        }
        
        // Disable submit button
        const submitBtn = document.getElementById('submit-guess-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Game Complete';
        }
        
        // Reset for new game after delay
        setTimeout(() => {
            this.resetForNewGame();
        }, 5000);
    }
    
    resetForNewGame() {
        this.currentLevel = 0;
        this.usedArticleIndices = [];
        this.score = 0;
        const scoreEl = document.getElementById('score');
        if (scoreEl) scoreEl.textContent = '0';
        this.resetGameState();
        this.loadNewGame();
    }
    
    startNewGame() {
        // Reset everything for a completely new game
        this.currentLevel = 0;
        this.usedArticleIndices = [];
        this.score = 0;
        const scoreEl = document.getElementById('score');
        if (scoreEl) scoreEl.textContent = '0';
        this.loadNewGame();
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
        
        // Hide wrong indicator if visible
        const wrongIndicator = document.getElementById('wrong-indicator');
        if (wrongIndicator) {
            wrongIndicator.style.display = 'none';
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
        
        // Update completion message
        const completionMessage = document.getElementById('completion-message');
        if (completionMessage) {
            const correctionText = message.split('\n')[0] || message;
            completionMessage.textContent = `The error was: ${correctionText}`;
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
        
        if (!postGameMessage || !postGameText) return;
        
        // Check if today's puzzle is completed
        const dateString = this.selectedDate || this.currentDateString;
        const isToday = dateString === this.currentDateString;
        const isCompleted = this.isCompleted(dateString);
        const wasWin = this.lastGameResult === 'win';
        const wasLoss = this.lastGameResult === 'loss';
        
        if (wasLoss && isToday) {
            // User lost today's puzzle
            postGameText.textContent = "Better luck next time! A new puzzle will be available tomorrow. You can also try a random puzzle or browse the archive to keep playing.";
        } else if (wasLoss && !isToday) {
            // User lost an archived/random puzzle
            postGameText.textContent = "Better luck next time! Want to try another puzzle?";
        } else if (isToday && isCompleted) {
            // Today's puzzle is completed (win)
            postGameText.textContent = "Great job! Come back tomorrow for a new puzzle.";
        } else if (isToday && !isCompleted) {
            // Today's puzzle not completed (shouldn't happen, but just in case)
            postGameText.textContent = "Keep trying! You can also play random puzzles or browse the archive.";
        } else {
            // Playing archived or random puzzle (win)
            postGameText.textContent = "Want to play more? Try a random puzzle or browse the archive.";
        }
        
        postGameMessage.style.display = 'block';
    }
    
    hidePostGameMessage() {
        const postGameMessage = document.getElementById('post-game-message');
        if (postGameMessage) {
            postGameMessage.style.display = 'none';
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
        
        // Ensure we have at least 1 game available
        if (todayPuzzleNumber < 1) {
            // If somehow we have no games, default to game #1
            await this.loadDailyGame('2025-10-27');
            this.updateDailyInfo();
            return;
        }
        
        // Pick a random puzzle number between 1 and today's number
        const randomPuzzleNumber = Math.floor(Math.random() * todayPuzzleNumber) + 1;
        
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
        
        // Try Web Share API first (mobile browsers)
        // Only pass text with URL included - don't pass url parameter separately to avoid duplicates
        if (navigator.share) {
            navigator.share({
                title: 'The Daily Typo',
                text: shareTextWithUrl // Include URL in text only, no separate url parameter
            }).catch(err => {
                console.log('Error sharing:', err);
                // Fallback to clipboard
                this.copyToClipboard(shareTextWithUrl);
            });
        } else {
            // Fallback to clipboard
            this.copyToClipboard(shareTextWithUrl);
        }
    }
    
    copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                // Show temporary feedback
                const shareBtn = document.getElementById('share-btn');
                if (shareBtn) {
                    const originalText = shareBtn.textContent;
                    shareBtn.textContent = 'Copied!';
                    setTimeout(() => {
                        shareBtn.textContent = originalText;
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
                    const originalText = shareBtn.textContent;
                    shareBtn.textContent = 'Copied!';
                    setTimeout(() => {
                        shareBtn.textContent = originalText;
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
        
        // Show all available articles (puzzles 1 through number of articles)
        const totalArticles = this.articlesConfig.articles.length;
        const puzzles = [];
        
        for (let puzzleNum = 1; puzzleNum <= totalArticles; puzzleNum++) {
            // Get article
            const article = this.articlesConfig.articles[puzzleNum - 1];
            
            // Calculate date for this puzzle
            const dateString = this.calculateDateFromPuzzleNumber(puzzleNum);
            
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
        
        allWordElements.forEach(wordEl => {
            const wordText = wordEl.textContent.trim();
            const normalizedWord = wordText.replace(/[^\w]/g, '').toLowerCase();
            
            // Check if this word matches any error word
            for (let i = 0; i < this.errorWords.length; i++) {
                const errorWord = this.errorWords[i].replace(/[^\w]/g, '').toLowerCase();
                const originalWord = this.originalWords[i];
                
                if (normalizedWord === errorWord || (normalizedWord.length >= errorWord.length - 1 && normalizedWord.length <= errorWord.length + 1 && 
                    (normalizedWord.includes(errorWord) || errorWord.includes(normalizedWord)))) {
                    
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
        this.errorSentence = null;
        this.errorType = null;
        this.triesRemaining = this.maxTries;
        this.selectedWords = [];
        this.clearSelection();
        this.updateMistakesDisplay();
        this.gameStartTime = Date.now(); // Start timer when game loads
        
        // Safely update feedback element if it exists
        const feedbackDiv = document.getElementById('feedback');
        if (feedbackDiv) {
            feedbackDiv.textContent = '';
            feedbackDiv.className = 'feedback';
        }
        
        const wrongIndicator = document.getElementById('wrong-indicator');
        if (wrongIndicator) {
            wrongIndicator.style.display = 'none';
        }
        
        const correctIndicator = document.getElementById('correct-indicator');
        if (correctIndicator) {
            correctIndicator.style.display = 'none';
        }
        
        // Clear correct highlights when resetting
        this.clearCorrectHighlights();
        
        // Reset submit buttons
        const submitButtonsDiv = document.getElementById('submit-buttons');
        if (submitButtonsDiv) {
            submitButtonsDiv.innerHTML = `
                <button id="submit-guess-btn" class="submit-btn primary">SUBMIT TYPO</button>
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
    }
    
    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('game-content').style.display = show ? 'none' : 'block';
    }
    
    // ========== DEV MODE FUNCTIONS ==========
    
    toggleDevMode() {
        this.devMode = !this.devMode;
        const panel = document.getElementById('dev-mode-panel');
        if (this.devMode) {
            panel.classList.add('open');
            // Switch to create tab by default
            document.querySelectorAll('.dev-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.dev-tab-content').forEach(c => c.classList.remove('active'));
            const createTab = document.querySelector('[data-tab="create"]');
            if (createTab) {
                createTab.classList.add('active');
                document.getElementById('dev-tab-create').classList.add('active');
            }
            // Ensure game content is visible so user can see the article while working
            const gameContent = document.getElementById('game-content');
            if (gameContent && this.devArticle) {
                gameContent.style.display = 'block';
            }
        } else {
            panel.classList.remove('open');
            // Don't reset dev state - keep it so user can continue editing
            // Only reset if explicitly needed (e.g., starting new article)
        }
    }
    
    editArticle(index) {
        if (index < 0 || index >= this.articlesConfig.articles.length) {
            alert('Invalid article index');
            return;
        }
        
        const article = this.articlesConfig.articles[index];
        this.editingArticleIndex = index; // Track which article we're editing
        
        // Switch to create tab
        document.querySelectorAll('.dev-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.dev-tab-content').forEach(c => c.classList.remove('active'));
        const createTab = document.querySelector('[data-tab="create"]');
        if (createTab) {
            createTab.classList.add('active');
            document.getElementById('dev-tab-create').classList.add('active');
        }
        
        // Load article into dev mode
        // Note: article.extract already has replacements applied
        this.devArticle = {
            title: article.title,
            extract: article.extract, // Current state with replacements
            category: article.category || 'General Knowledge',
            thumbnail: article.thumbnail || null,
            description: article.description || null
        };
        
        // Get replacements (already applied in the extract)
        const replacements = article.replacements || [{original: article.originalWord, replacement: article.wrongWord}];
        
        // To edit, we need the original extract (without replacements)
        // Reverse replacements to reconstruct original text
        let originalExtract = article.extract;
        replacements.slice().reverse().forEach(r => {
            const escapedReplacement = r.replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedReplacement}\\b`, 'gi');
            originalExtract = originalExtract.replace(regex, match => {
                if (match[0] === match[0].toUpperCase()) {
                    return r.original.charAt(0).toUpperCase() + r.original.slice(1);
                }
                return r.original.toLowerCase();
            });
        });
        
        // Start with original extract, but keep track of existing replacements
        this.devOriginalExtract = originalExtract;
        this.devArticle.extract = originalExtract; // Start editing from original
        this.devReplacements = []; // Clear replacements - user will need to re-add them or we'll restore them
        
        // Actually, let's keep the current state (with replacements) and allow adding more
        // User sees what's currently wrong and can add/modify
        this.devArticle.extract = article.extract; // Keep current state
        this.devReplacements = replacements.map(r => ({
            original: r.original,
            replacement: r.replacement
        }));
        
        // Display article in dev mode
        this.currentArticle = this.devArticle;
        this.displayArticleForDev();
        
        // Set up UI
        const subjectInput = document.getElementById('dev-subject-input');
        const categoryInput = document.getElementById('dev-category-input');
        const saveSection = document.getElementById('dev-save-section');
        const statusDiv = document.getElementById('dev-status');
        
        if (subjectInput) subjectInput.value = article.title;
        if (categoryInput) categoryInput.value = article.category || 'General Knowledge';
        if (saveSection) saveSection.style.display = 'block';
        
        if (statusDiv) {
            statusDiv.innerHTML = 
                `📝 Editing: <strong>${article.title}</strong><br>` +
                `<small style="color: #666;">Green highlighted words are already replaced. Click words to add more replacements, then click "Update Article" to save.</small>`;
            statusDiv.style.background = '#d4edda';
        }
        
        // Change button text to indicate editing
        const saveBtn = document.getElementById('dev-save-btn');
        if (saveBtn) {
            saveBtn.textContent = '💾 Update Article';
        }
    }
    
    async devFetchArticle() {
        const subjectInput = document.getElementById('dev-subject-input');
        const subject = subjectInput.value.trim();
        const statusDiv = document.getElementById('dev-status');
        
        if (!subject) {
            statusDiv.textContent = 'Please enter a subject';
            statusDiv.style.background = '#ffe6e6';
            return;
        }
        
        statusDiv.textContent = 'Fetching article...';
        statusDiv.style.background = '#fff3cd';
        
        try {
            let article = null;
            try {
                article = await Promise.race([
                    this.fetchWikipediaArticle(subject),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), 10000)
                    )
                ]);
            } catch (error) {
                console.error('Error fetching:', error);
                article = this.getFallbackArticle(subject);
            }
            
            if (!article || !article.extract) {
                throw new Error('Failed to fetch article');
            }
            
            // Store original article (without errors)
            this.devArticle = {
                title: article.title,
                extract: article.extract, // Keep original, no errors
                category: article.category || this.getArticleCategory(article.title, article.description),
                thumbnail: article.thumbnail || null,
                description: article.description || null
            };
            
            // Store original extract and reset replacements
            this.devOriginalExtract = article.extract;
            this.devReplacements = [];
            this.editingArticleIndex = null; // Not editing, creating new
            
            // Display the article in the main game area for editing
            this.currentArticle = this.devArticle;
            this.displayArticleForDev();
            
            statusDiv.textContent = `Article loaded: ${article.title}`;
            statusDiv.style.background = '#d4edda';
            
            // Show save section
            document.getElementById('dev-save-section').style.display = 'block';
            document.getElementById('dev-category-input').value = this.devArticle.category || 'General Knowledge';
            
        } catch (error) {
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.style.background = '#ffe6e6';
        }
    }
    
    displayArticleForDev() {
        // Make sure game content is visible
        document.getElementById('game-content').style.display = 'block';
        document.getElementById('loading').style.display = 'none';
        
        // Display article without errors, with special dev mode click handlers
        document.getElementById('article-title').textContent = this.devArticle.title;
        document.getElementById('article-category').textContent = this.devArticle.category || 'General Knowledge';
        
        const contentDiv = document.getElementById('article-content');
        const paragraphs = this.devArticle.extract.split(/\n\n+/).filter(p => p.trim());
        
        let html = '';
        if (this.devArticle.thumbnail) {
            html += `<div class="article-thumbnail">
                <img src="${this.devArticle.thumbnail}" alt="${this.devArticle.title}" style="max-width: 100%; height: auto; margin-bottom: 15px;">
            </div>`;
        }
        
        html += paragraphs.map(para => {
            const words = para.split(/(\s+)/);
            const wrappedWords = words.map(word => {
                if (/^\s+$/.test(word)) {
                    return word;
                }
                const wordTrimmed = word.trim();
                
                // Check if this word was replaced
                const replacement = this.devReplacements.find(r => 
                    wordTrimmed.toLowerCase() === r.replacement.toLowerCase() ||
                    wordTrimmed.toLowerCase() === r.replacement.charAt(0).toUpperCase() + r.replacement.slice(1).toLowerCase()
                );
                
                // Add special dev mode class
                let wordClass = 'word-clickable';
                if (this.devSelectedWord && wordTrimmed === this.devOriginalWord) {
                    wordClass += ' word-dev-selected';
                } else if (replacement) {
                    // Highlight replaced words
                    wordClass += ' word-dev-replaced';
                }
                
                return `<span class="${wordClass}" data-word="${wordTrimmed}" title="${replacement ? `Replaced "${replacement.original}" with "${replacement.replacement}"` : ''}">${word}</span>`;
            }).join('');
            return `<p>${wrappedWords}</p>`;
        }).join('');
        
        contentDiv.innerHTML = html;
        
        // Set up dev mode click handlers
        this.setupDevWordClickHandlers();
    }
    
    setupDevWordClickHandlers() {
        const words = document.querySelectorAll('#article-content .word-clickable');
        words.forEach(wordEl => {
            wordEl.addEventListener('click', (e) => {
                e.stopPropagation();
                const word = wordEl.textContent.trim();
                if (!word || word.length < 2) return;
                
                // Clear previous selection
                document.querySelectorAll('.word-dev-selected').forEach(el => {
                    el.classList.remove('word-dev-selected');
                });
                
                // Select this word
                wordEl.classList.add('word-dev-selected');
                this.devSelectedWord = wordEl;
                this.devOriginalWord = word;
                
                // Show selection controls
                document.getElementById('dev-selected-word').textContent = word;
                document.getElementById('dev-replacement-input').value = '';
                document.getElementById('dev-selection-controls').style.display = 'block';
            });
        });
    }
    
    devConfirmReplacement() {
        const replacementInput = document.getElementById('dev-replacement-input');
        const replacement = replacementInput.value.trim();
        
        if (!replacement) {
            alert('Please enter a replacement word');
            return;
        }
        
        if (!this.devOriginalWord) {
            alert('Please select a word first');
            return;
        }
        
        this.devReplacementWord = replacement;
        
        // Track this replacement
        this.devReplacements.push({
            original: this.devOriginalWord,
            replacement: replacement
        });
        
        // Replace ALL occurrences of the word in the article (not just first)
        // But only replace the exact word we selected (to avoid replacing similar words)
        const escapedOriginal = this.devOriginalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Use word boundaries to ensure exact matches, but be careful with case
        const regex = new RegExp(`\\b${escapedOriginal}\\b`, 'gi');
        let replacementCount = 0;
        this.devArticle.extract = this.devArticle.extract.replace(regex, match => {
            replacementCount++;
            // Preserve case of original
            if (match[0] === match[0].toUpperCase()) {
                return replacement.charAt(0).toUpperCase() + replacement.slice(1);
            }
            return replacement.toLowerCase();
        });
        
        if (replacementCount === 0) {
            console.warn(`Warning: Word "${this.devOriginalWord}" not found in extract!`);
            // Try without word boundaries as fallback
            const simpleRegex = new RegExp(escapedOriginal, 'gi');
            this.devArticle.extract = this.devArticle.extract.replace(simpleRegex, match => {
                if (match[0] === match[0].toUpperCase()) {
                    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
                }
                return replacement.toLowerCase();
            });
        }
        
        // Clear selection state (but keep replacement tracking)
        this.devSelectedWord = null;
        this.devOriginalWord = null;
        
        // Update display
        this.displayArticleForDev();
        
        // Show confirmation with summary
        const replacementSummary = this.devReplacements.map(r => 
            `"${r.original}" → "${r.replacement}"`
        ).join(', ');
        document.getElementById('dev-status').innerHTML = 
            `✓ Replaced "${this.devReplacements[this.devReplacements.length - 1].original}" with "${replacement}"<br>` +
            `<small>All replacements (${this.devReplacements.length}): ${replacementSummary}</small><br>` +
            `<small style="color: #666;">You can select another word to replace, or save the article.</small>`;
        document.getElementById('dev-status').style.background = '#d4edda';
        
        // Keep selection controls visible so user can make more replacements
        // Don't hide it: document.getElementById('dev-selection-controls').style.display = 'none';
    }
    
    devClearSelection() {
        this.devSelectedWord = null;
        this.devOriginalWord = null;
        document.querySelectorAll('.word-dev-selected').forEach(el => {
            el.classList.remove('word-dev-selected');
        });
        document.getElementById('dev-selection-controls').style.display = 'none';
    }
    
    async devSaveArticle() {
        if (!this.devArticle) {
            alert('Please fetch an article first');
            return;
        }
        
        if (!this.devReplacements || this.devReplacements.length === 0) {
            alert('Please select a word and provide a replacement first');
            return;
        }
        
        // Support multiple replacements - save them all
        const categoryInput = document.getElementById('dev-category-input');
        const category = categoryInput.value.trim() || 'General Knowledge';
        
        // Verify that the extract actually contains the replacement words
        const extractLower = this.devArticle.extract.toLowerCase();
        let hasAllReplacements = true;
        const missingReplacements = [];
        
        this.devReplacements.forEach(r => {
            const replacementLower = r.replacement.toLowerCase();
            if (!extractLower.includes(replacementLower)) {
                hasAllReplacements = false;
                missingReplacements.push(r.replacement);
                console.error(`ERROR: Replacement "${r.replacement}" not found in extract!`);
                console.error(`Original word was: "${r.original}"`);
            }
        });
        
        if (!hasAllReplacements) {
            alert(`Warning: Some replacements may not be applied correctly!\nMissing: ${missingReplacements.join(', ')}\n\nPlease check the article and try replacing again.`);
            return;
        }
        
        // Create article entry - support multiple replacements
        const articleEntry = {
            title: this.devArticle.title,
            extract: this.devArticle.extract, // This already has all replacements applied
            category: category,
            thumbnail: this.devArticle.thumbnail || null,
            description: this.devArticle.description || null,
            // For backward compatibility, keep first replacement as primary
            originalWord: this.devReplacements[0].original,
            wrongWord: this.devReplacements[0].replacement,
            errorType: 'word',
            // New: store all replacements
            replacements: this.devReplacements.map(r => ({
                original: r.original,
                replacement: r.replacement
            }))
        };
        
        // Double-check: verify the saved extract contains the wrong word
        console.log('Saving article with extract length:', articleEntry.extract.length);
        console.log('Wrong word should be:', articleEntry.wrongWord);
        console.log('Extract contains wrong word?', articleEntry.extract.toLowerCase().includes(articleEntry.wrongWord.toLowerCase()));
        
        // Check if we're editing an existing article
        if (this.editingArticleIndex !== null && this.editingArticleIndex !== undefined) {
            // Update existing article
            this.articlesConfig.articles[this.editingArticleIndex] = articleEntry;
            document.getElementById('dev-status').innerHTML = 
                `✓ Article "${articleEntry.title}" updated successfully!<br>` +
                `<small style="color: #666;">✨ Auto-saved!</small>`;
        } else {
            // Add new article
            if (!this.articlesConfig) {
                this.articlesConfig = { version: "1.0", articles: [] };
            }
            this.articlesConfig.articles.push(articleEntry);
            document.getElementById('dev-status').innerHTML = 
                `✓ Article "${articleEntry.title}" added successfully!<br>` +
                `<small style="color: #666;">✨ Auto-saved! ${this.articlesConfig.articles.length} article(s) total.</small>`;
        }
        
        // Auto-save config (instant, no file dialog!)
        this.saveArticlesConfig();
        
        // Update counts in manage tab if open
        this.updateDevArticlesListFull();
        
        // Reset dev state
        this.devArticle = null;
        this.devOriginalExtract = null;
        this.devSelectedWord = null;
        this.devOriginalWord = null;
        this.devReplacementWord = null;
        this.devReplacements = [];
        this.editingArticleIndex = null;
        document.getElementById('dev-subject-input').value = '';
        document.getElementById('dev-status').style.background = '#d4edda';
        document.getElementById('dev-save-section').style.display = 'none';
        
        // Reset button text
        const saveBtn = document.getElementById('dev-save-btn');
        if (saveBtn) {
            saveBtn.textContent = '✨ Add to Game';
        }
        
        // Clear article display
        document.getElementById('article-content').innerHTML = '';
        document.getElementById('article-title').textContent = '';
        document.getElementById('article-category').textContent = '';
    }
    
    updateDevArticlesListFull() {
        const listContent = document.getElementById('dev-articles-list-content-full');
        const countSpan = document.getElementById('dev-articles-count-full');
        
        if (!listContent || !countSpan) return;
        
        if (!this.articlesConfig || !this.articlesConfig.articles || this.articlesConfig.articles.length === 0) {
            listContent.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;"><p>No articles yet.</p><p style="font-size: 0.9rem;">Switch to "Create New" tab to add your first article!</p></div>';
            countSpan.textContent = '0';
            return;
        }
        
        countSpan.textContent = this.articlesConfig.articles.length.toString();
        
        listContent.innerHTML = this.articlesConfig.articles.map((article, index) => {
            const replacements = article.replacements || [{original: article.originalWord, replacement: article.wrongWord}];
            const replacementText = replacements.map(r => `"${r.original}" → "${r.replacement}"`).join(', ');
            
            return `
                <div class="dev-article-item-full">
                    <div class="dev-article-item-info">
                        <div class="dev-article-item-title">${article.title}</div>
                        <div class="dev-article-item-category">📂 ${article.category}</div>
                        <div class="dev-article-item-replacements">${replacementText}</div>
                        ${replacements.length > 1 ? `<div style="font-size: 0.8rem; color: #28a745; margin-top: 4px;">${replacements.length} replacements</div>` : ''}
                    </div>
                    <div class="dev-article-item-actions">
                        <button class="dev-article-edit-btn" data-index="${index}" title="Edit article">✏️ Edit</button>
                        <button class="dev-article-delete-btn" data-index="${index}" title="Delete article">🗑️ Delete</button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add delete handlers
        listContent.querySelectorAll('.dev-article-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                if (confirm(`Delete article "${this.articlesConfig.articles[index].title}"?`)) {
                    this.articlesConfig.articles.splice(index, 1);
                    this.saveArticlesConfig(); // Auto-save
                    this.updateDevArticlesListFull();
                }
            });
        });
        
        // Add edit handlers
        listContent.querySelectorAll('.dev-article-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.editArticle(index);
            });
        });
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new DailyTypoGame();
});

