// Глобальные переменные
let gamesDB = [];
let selectedGameId = null;
let currentGalleryIndex = {};

// Загрузка игр из JSON файла
async function loadGames() {
    try {
        const response = await fetch('games.json');
        const data = await response.json();
        gamesDB = data.games;
        
        // Инициализация индексов галерей
        gamesDB.forEach(game => {
            currentGalleryIndex[game.id] = 0;
        });
        
        // Определяем на какой мы странице и запускаем соответствующую функцию
        if (document.getElementById('gamesGrid')) {
            renderGames();
            // Проверяем есть ли id игры в URL (для прямой ссылки)
            checkGameIdInURL();
        } else if (document.getElementById('gameContent')) {
            loadGameDetails();
        } else if (document.getElementById('gameIframe')) {
            initPlayPage();
        } else if (document.getElementById('developerGamesGrid')) {
            loadDeveloperGames();
        }
    } catch (error) {
        console.error('Ошибка загрузки игр:', error);
        const grid = document.getElementById('gamesGrid');
        if (grid) {
            grid.innerHTML = '<div style="color:red; text-align:center; padding:2rem;">❌ Ошибка загрузки игр. Проверьте файл games.json</div>';
        }
    }
}

// Проверка ID игры в URL (для прямой ссылки на главной)
function checkGameIdInURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('id');
    
    if (gameId) {
        // Проверяем существует ли такая игра
        const game = gamesDB.find(g => g.id === gameId);
        if (game) {
            localStorage.setItem('selectedGameId', gameId);
            window.location.href = 'game.html' + window.location.search;
        }
    }
}

// Обновление URL без перезагрузки страницы
function updateURL(gameId, page) {
    const url = new URL(window.location.href);
    if (gameId) {
        url.searchParams.set('id', gameId);
    } else {
        url.searchParams.delete('id');
    }
    window.history.pushState({}, '', url);
}

// ГЛАВНАЯ СТРАНИЦА (index.html)
function renderGames() {
    const grid = document.getElementById('gamesGrid');
    if (!grid) return;
    
    grid.innerHTML = '';

    gamesDB.forEach(game => {
        const card = document.createElement('div');
        card.className = 'game-card';
        
        const hasVideo = game.video && game.video !== "";
        
        card.innerHTML = `
            <div class="game-video-container" data-game-id="${game.id}" data-has-video="${hasVideo}">
                <img class="game-cover" src="${game.cover}" alt="${game.title}">
                ${hasVideo ? `
                    <video class="game-video" src="${game.video}" preload="auto" muted loop playsinline></video>
                ` : ''}
            </div>
            <div class="game-info">
                <div class="game-title">${game.title}</div>
                <div>Разработчик: <span class="game-author" data-author="${game.author}">${game.author}</span></div>
                <div class="game-desc">${game.shortDesc.substring(0, 80)}${game.shortDesc.length > 80 ? '...' : ''}</div>
                <div class="card-buttons">
                    <button class="btn btn-play" data-id="${game.id}" data-action="play">🎮 Играть</button>
                    <button class="btn" data-id="${game.id}" data-action="details">📖 Подробнее</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
        
        // Настройка видео только если оно есть
        if (hasVideo) {
            const container = card.querySelector('.game-video-container');
            const video = card.querySelector('.game-video');
            
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.load();
            
            container.addEventListener('mouseenter', () => {
                video.play().catch(error => {
                    console.log('Автовоспроизведение заблокировано');
                });
            });
            
            container.addEventListener('mouseleave', () => {
                video.pause();
                video.currentTime = 0;
            });
        }
    });

    // Обработчики для кнопок
    document.querySelectorAll('.btn-play, .btn[data-action="play"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const gameId = btn.getAttribute('data-id');
            const game = gamesDB.find(g => g.id === gameId);
            if (game) {
                localStorage.setItem('gameToPlayUrl', game.gameUrl);
                localStorage.setItem('gameToPlayTitle', game.title);
                localStorage.setItem('currentGameId', game.id);
                window.location.href = `play.html?id=${gameId}`;
            }
        });
    });
    
    document.querySelectorAll('.btn[data-action="details"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const gameId = btn.getAttribute('data-id');
            localStorage.setItem('selectedGameId', gameId);
            window.location.href = `game.html?id=${gameId}`;
        });
    });
    
    // Обработчики для клика по имени разработчика
    document.querySelectorAll('.game-author').forEach(author => {
        author.addEventListener('click', (e) => {
            e.stopPropagation();
            const authorName = author.getAttribute('data-author');
            localStorage.setItem('selectedDeveloper', authorName);
            window.location.href = `developer.html?author=${encodeURIComponent(authorName)}`;
        });
    });
    
    // Клик по карточке (но не по видео и не по кнопкам)
    document.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.game-video-container')) return;
            if (e.target.closest('.btn')) return;
            if (e.target.closest('.game-author')) return;
            
            const gameId = card.querySelector('.btn')?.getAttribute('data-id');
            if (gameId) {
                localStorage.setItem('selectedGameId', gameId);
                window.location.href = `game.html?id=${gameId}`;
            }
        });
    });
}

// СТРАНИЦА РАЗРАБОТЧИКА (developer.html)
function loadDeveloperGames() {
    const urlParams = new URLSearchParams(window.location.search);
    let developerName = urlParams.get('author');
    
    // Если нет в URL, берем из localStorage (для обратной совместимости)
    if (!developerName) {
        developerName = localStorage.getItem('selectedDeveloper');
    }
    
    const grid = document.getElementById('developerGamesGrid');
    const titleElement = document.getElementById('developerName');
    const descElement = document.getElementById('developerDesc');
    
    if (!grid) return;
    
    if (!developerName) {
        titleElement.textContent = 'Разработчик не найден';
        descElement.textContent = 'Вернитесь на главную страницу';
        grid.innerHTML = '<div style="text-align:center; padding:2rem;">❌ Разработчик не выбран</div>';
        return;
    }
    
    // Фильтруем игры по разработчику
    const developerGames = gamesDB.filter(game => game.author === developerName);
    
    if (developerGames.length === 0) {
        titleElement.textContent = developerName;
        descElement.textContent = 'У этого разработчика пока нет игр';
        grid.innerHTML = '<div style="text-align:center; padding:2rem;">📭 Игры не найдены</div>';
        return;
    }
    
    titleElement.textContent = `${developerName}`;
    descElement.textContent = `Все игры разработчика (${developerGames.length})`;
    
    grid.innerHTML = '';
    
    developerGames.forEach(game => {
        const card = document.createElement('div');
        card.className = 'game-card';
        
        const hasVideo = game.video && game.video !== "";
        
        card.innerHTML = `
            <div class="game-video-container" data-game-id="${game.id}" data-has-video="${hasVideo}">
                <img class="game-cover" src="${game.cover}" alt="${game.title}">
                ${hasVideo ? `
                    <video class="game-video" src="${game.video}" preload="auto" muted loop playsinline></video>
                ` : ''}
            </div>
            <div class="game-info">
                <div class="game-title">${game.title}</div>
                <div>Разработчик: <span class="game-author" data-author="${game.author}">${game.author}</span></div>
                <div class="game-desc">${game.shortDesc.substring(0, 80)}${game.shortDesc.length > 80 ? '...' : ''}</div>
                <div class="card-buttons">
                    <button class="btn btn-play" data-id="${game.id}" data-action="play">🎮 Играть</button>
                    <button class="btn" data-id="${game.id}" data-action="details">📖 Подробнее</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
        
        // Настройка видео
        if (hasVideo) {
            const container = card.querySelector('.game-video-container');
            const video = card.querySelector('.game-video');
            
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.load();
            
            container.addEventListener('mouseenter', () => {
                video.play().catch(error => console.log('Автовоспроизведение заблокировано'));
            });
            
            container.addEventListener('mouseleave', () => {
                video.pause();
                video.currentTime = 0;
            });
        }
    });
    
    // Обработчики для кнопок на странице разработчика
    document.querySelectorAll('.btn-play, .btn[data-action="play"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const gameId = btn.getAttribute('data-id');
            const game = gamesDB.find(g => g.id === gameId);
            if (game) {
                localStorage.setItem('gameToPlayUrl', game.gameUrl);
                localStorage.setItem('gameToPlayTitle', game.title);
                localStorage.setItem('currentGameId', game.id);
                window.location.href = `play.html?id=${gameId}`;
            }
        });
    });
    
    document.querySelectorAll('.btn[data-action="details"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const gameId = btn.getAttribute('data-id');
            localStorage.setItem('selectedGameId', gameId);
            window.location.href = `game.html?id=${gameId}`;
        });
    });
    
    // Обработчики для клика по имени разработчика
    document.querySelectorAll('.game-author').forEach(author => {
        author.addEventListener('click', (e) => {
            e.stopPropagation();
            const authorName = author.getAttribute('data-author');
            window.location.href = `developer.html?author=${encodeURIComponent(authorName)}`;
        });
    });
    
    // Клик по карточке
    document.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.game-video-container')) return;
            if (e.target.closest('.btn')) return;
            if (e.target.closest('.game-author')) return;
            
            const gameId = card.querySelector('.btn')?.getAttribute('data-id');
            if (gameId) {
                localStorage.setItem('selectedGameId', gameId);
                window.location.href = `game.html?id=${gameId}`;
            }
        });
    });
}

// СТРАНИЦА ОПИСАНИЯ (game.html)
function loadGameDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    let selectedId = urlParams.get('id');
    
    // Если нет в URL, берем из localStorage (для обратной совместимости)
    if (!selectedId) {
        selectedId = localStorage.getItem('selectedGameId');
    }
    
    const game = gamesDB.find(g => g.id === selectedId);
    const container = document.getElementById('gameContent');
    
    if (!container) return;
    
    if (!game) {
        container.innerHTML = `<div class="not-found">
            <h2>❌ Игра не найдена</h2>
            <p>Вернитесь на главную и выберите игру.</p>
            <a href="index.html" style="color:#60a5fa;">На главную</a>
        </div>`;
        return;
    }
    
    // Обновляем URL
    updateURL(game.id, 'game');
    
    // Создаем массив медиа (видео + скриншоты)
    let mediaItems = [];
    if (game.video && game.video !== "") {
        mediaItems.push({ type: 'video', url: game.video });
    }
    if (game.gallery && game.gallery.length > 0) {
        game.gallery.forEach(img => {
            mediaItems.push({ type: 'image', url: img });
        });
    }
    
    // Создаем HTML для галереи
    let galleryHtml = '';
    if (mediaItems.length > 0) {
        const firstMedia = mediaItems[0];
        galleryHtml = `
            <div class="game-gallery-full">
                <div class="full-gallery-main">
                    ${firstMedia.type === 'video' ? 
                        `<video class="full-gallery-video" id="fullGalleryVideo" src="${firstMedia.url}" controls></video>` :
                        `<img class="full-gallery-img" id="fullGalleryImg" src="${firstMedia.url}" alt="${game.title}">`
                    }
                    <button class="full-gallery-arrow prev" id="fullGalleryPrev">‹</button>
                    <button class="full-gallery-arrow next" id="fullGalleryNext">›</button>
                    <div class="gallery-counter" id="galleryCounter">1 / ${mediaItems.length}</div>
                </div>
                <div class="full-gallery-thumbnails" id="fullGalleryThumbs">
                    ${mediaItems.map((item, idx) => `
                        <div class="full-gallery-thumb-wrapper" data-index="${idx}">
                            ${item.type === 'video' ? 
                                `<div class="video-thumb">🎬 Видео</div>` :
                                `<img src="${item.url}" class="full-gallery-thumb">`
                            }
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Получаем 4 случайные другие игры (исключая текущую)
    const otherGames = gamesDB
        .filter(g => g.id !== game.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 4);
    
    container.innerHTML = `
        <div class="game-header">
            <div>
                ${game.logo ? `<img class="game-logo" src="${game.logo}" alt="${game.title} logo">` : ''}
                <img class="screenshot" src="${game.cover}" alt="${game.title}" 
                     onerror="this.src='https://via.placeholder.com/280x200?text=No+Image'">
            </div>
            <div class="title-box">
                <div class="game-title">${game.title}</div>
                <div>Разработчик: <span class="game-author" data-author="${game.author}" style="cursor:pointer;">${game.author}</span></div>
                <div style="color:#94a3b8; margin-top: 0.5rem;">${game.shortDesc}</div>
                <button class="btn" id="shareBtn" style="margin-top: 1rem; background: #8b5cf6; width: auto; padding: 0.3rem 1rem;">📋 Скопировать ссылку</button>
            </div>
        </div>
        ${galleryHtml}
        <div class="description">
            <strong>📝 Полное описание:</strong><br><br>
            ${game.fullDesc}
        </div>
        <button class="btn" id="startGameBtn">🎮 ИГРАТЬ →</button>
        
        <div class="other-games-section">
            <div class="other-games-title">🎲 Другие игры</div>
            <div class="other-games-grid" id="otherGamesGrid">
                ${otherGames.map(other => `
                    <div class="other-game-card" data-id="${other.id}">
                        ${other.logo ? `<img class="other-game-logo" src="${other.logo}" alt="${other.title}">` : ''}
                        <div class="other-game-title">${other.title}</div>
                        <div class="other-game-author">${other.author}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Кнопка копирования ссылки
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const shareUrl = `${window.location.origin}${window.location.pathname}?id=${game.id}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                const originalText = shareBtn.textContent;
                shareBtn.textContent = '✅ Скопировано!';
                setTimeout(() => {
                    shareBtn.textContent = originalText;
                }, 2000);
            }).catch(() => {
                alert('Не удалось скопировать ссылку');
            });
        });
    }
    
    // Обработчик для клика по имени разработчика
    const authorSpan = document.querySelector('.game-author');
    if (authorSpan) {
        authorSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            const authorName = authorSpan.getAttribute('data-author');
            window.location.href = `developer.html?author=${encodeURIComponent(authorName)}`;
        });
    }
    
    // Обработчики для других игр
    document.querySelectorAll('.other-game-card').forEach(card => {
        card.addEventListener('click', () => {
            const otherGameId = card.getAttribute('data-id');
            window.location.href = `game.html?id=${otherGameId}`;
        });
    });
    
    // Настройка галереи на странице описания
    if (mediaItems.length > 0) {
        let currentMediaIndex = 0;
        const prevBtn = document.getElementById('fullGalleryPrev');
        const nextBtn = document.getElementById('fullGalleryNext');
        const counter = document.getElementById('galleryCounter');
        const thumbs = document.querySelectorAll('.full-gallery-thumb-wrapper');
        const mainContainer = document.querySelector('.full-gallery-main');
        
        const updateMedia = (newIndex) => {
            currentMediaIndex = newIndex;
            const media = mediaItems[currentMediaIndex];
            counter.textContent = `${currentMediaIndex + 1} / ${mediaItems.length}`;
            
            if (media.type === 'video') {
                mainContainer.innerHTML = `
                    <video class="full-gallery-video" id="fullGalleryVideo" src="${media.url}" controls></video>
                    <button class="full-gallery-arrow prev" id="fullGalleryPrev">‹</button>
                    <button class="full-gallery-arrow next" id="fullGalleryNext">›</button>
                    <div class="gallery-counter" id="galleryCounter">${currentMediaIndex + 1} / ${mediaItems.length}</div>
                `;
            } else {
                mainContainer.innerHTML = `
                    <img class="full-gallery-img" id="fullGalleryImg" src="${media.url}" alt="${game.title}">
                    <button class="full-gallery-arrow prev" id="fullGalleryPrev">‹</button>
                    <button class="full-gallery-arrow next" id="fullGalleryNext">›</button>
                    <div class="gallery-counter" id="galleryCounter">${currentMediaIndex + 1} / ${mediaItems.length}</div>
                `;
            }
            
            thumbs.forEach((thumb, idx) => {
                if (idx === currentMediaIndex) {
                    thumb.classList.add('active');
                } else {
                    thumb.classList.remove('active');
                }
            });
            
            const newPrevBtn = document.getElementById('fullGalleryPrev');
            const newNextBtn = document.getElementById('fullGalleryNext');
            
            if (newPrevBtn) {
                newPrevBtn.addEventListener('click', () => {
                    currentMediaIndex = (currentMediaIndex - 1 + mediaItems.length) % mediaItems.length;
                    updateMedia(currentMediaIndex);
                });
            }
            
            if (newNextBtn) {
                newNextBtn.addEventListener('click', () => {
                    currentMediaIndex = (currentMediaIndex + 1) % mediaItems.length;
                    updateMedia(currentMediaIndex);
                });
            }
        };
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                currentMediaIndex = (currentMediaIndex - 1 + mediaItems.length) % mediaItems.length;
                updateMedia(currentMediaIndex);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                currentMediaIndex = (currentMediaIndex + 1) % mediaItems.length;
                updateMedia(currentMediaIndex);
            });
        }
        
        thumbs.forEach(thumb => {
            thumb.addEventListener('click', () => {
                const index = parseInt(thumb.getAttribute('data-index'));
                updateMedia(index);
            });
        });
    }
    
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            localStorage.setItem('gameToPlayUrl', game.gameUrl);
            localStorage.setItem('gameToPlayTitle', game.title);
            localStorage.setItem('currentGameId', game.id);
            window.location.href = `play.html?id=${game.id}`;
        });
    }
}

// СТРАНИЦА ИГРЫ (play.html)
function initPlayPage() {
    const urlParams = new URLSearchParams(window.location.search);
    let currentGameId = urlParams.get('id');
    
    // Если нет в URL, берем из localStorage
    if (!currentGameId) {
        currentGameId = localStorage.getItem('currentGameId');
    }
    
    const game = gamesDB.find(g => g.id === currentGameId);
    
    const iframe = document.getElementById('gameIframe');
    const titleSpan = document.getElementById('gameTitleSpan');
    const backLink = document.getElementById('backLink');
    const allGamesLink = document.getElementById('allGamesLink');
    const gameDescLink = document.getElementById('gameDescLink');
    
    if (titleSpan && game) {
        titleSpan.textContent = game.title;
    } else if (titleSpan) {
        titleSpan.textContent = "Игра";
    }
    
    if (backLink && currentGameId) {
        backLink.href = 'game.html';
        backLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = `game.html?id=${currentGameId}`;
        });
    }
    
    if (allGamesLink) {
        allGamesLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'index.html';
        });
    }
    
    if (gameDescLink && currentGameId) {
        gameDescLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = `game.html?id=${currentGameId}`;
        });
    }
    
    if (iframe && game) {
        if (game.gameUrl && game.gameUrl !== "undefined" && game.gameUrl !== "null") {
            iframe.src = game.gameUrl;
        } else {
            iframe.srcdoc = `
                <html style="background:#0b1120;color:white;display:flex;align-items:center;justify-content:center;font-family:sans-serif;height:100%;">
                    <body style="text-align:center;">
                        <h2>🎮 Демо-режим</h2>
                        <p>Здесь будет ваша игра из iframe.<br>Укажите реальный URL в games.json</p>
                        <small style="color:#aaa;">пример: "gameUrl": "https://example.com/game/"</small>
                    </body>
                </html>
            `;
        }
    } else if (iframe) {
        iframe.srcdoc = `
            <html style="background:#0b1120;color:white;display:flex;align-items:center;justify-content:center;font-family:sans-serif;height:100%;">
                <body style="text-align:center;">
                    <h2>🎮 Игра не найдена</h2>
                    <p>Вернитесь на главную страницу</p>
                </body>
            </html>
        `;
    }
}

// Запускаем загрузку игр при загрузке страницы
document.addEventListener('DOMContentLoaded', loadGames);