// ============================================================
// DesertBox — Игровой Хаб
// games.json (в хабе) хранит только списки URL проектов.
// Все данные игры — в game.json в корне самого проекта.
// ============================================================

let gamesDB = [];
let promoDB = [];

// Базовый адрес хаба — для ссылок вида game.html?id=...
const HUB_BASE = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);

// ---------- Утилиты ----------

function resolveUrl(path, base) {
    if (!path) return '';
    try {
        return new URL(path, base).href;
    } catch (e) {
        return path;
    }
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// id из адреса проекта, если в game.json его не указали
function idFromUrl(url) {
    const parts = url.replace(/\/+$/, '').split('/');
    return parts[parts.length - 1] || 'game';
}

function escapeHtml(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// ---------- Загрузка данных ----------

// Загружает game.json одного проекта и приводит пути к абсолютным
async function loadGameFromUrl(projectUrl) {
    const base = projectUrl.endsWith('/') ? projectUrl : projectUrl + '/';
    const metaUrl = resolveUrl('game.json', base);

    const response = await fetch(metaUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`${metaUrl} → HTTP ${response.status}`);
    const data = await response.json();

    return {
        id: data.id || idFromUrl(base),
        title: data.title || 'Без названия',
        author: data.author || 'Неизвестный автор',
        logo: resolveUrl(data.logo, base),
        shortDesc: data.shortDesc || '',
        fullDesc: data.fullDesc || '',
        cover: resolveUrl(data.cover, base),
        video: resolveUrl(data.video, base),
        gallery: (data.gallery || []).map(p => resolveUrl(p, base)),
        gameUrl: base,
        promo: {
            banners: ((data.promo && data.promo.banners) || []).map(p => resolveUrl(p, base)),
            videos: ((data.promo && data.promo.videos) || []).map(p => resolveUrl(p, base))
        }
    };
}

async function loadGames() {
    try {
        const response = await fetch('games.json', { cache: 'no-cache' });
        const manifest = await response.json();

        const results = await Promise.allSettled((manifest.games || []).map(loadGameFromUrl));
        gamesDB = results.filter(r => r.status === 'fulfilled').map(r => r.value);
        injectJsonLd();
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed) console.warn(`Хаб: не удалось загрузить game.json у ${failed} проект(ов)`);

        const promoResults = await Promise.allSettled((manifest.promo || []).map(loadGameFromUrl));
        promoDB = promoResults
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value)
            .filter(g => g.promo.banners.length > 0 || g.promo.videos.length > 0);

        // Определяем, на какой мы странице
        if (document.getElementById('gamesGrid')) {
            renderGames();
            checkGameIdInURL();
        } else if (document.getElementById('gameContent')) {
            loadGameDetails();
        } else if (document.getElementById('gameIframe')) {
            initPlayPage();
        } else if (document.getElementById('developerGamesGrid')) {
            loadDeveloperGames();
        }
        preloadAssets();
    } catch (error) {
        console.error('Ошибка загрузки games.json:', error);
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

    if (gameId && gamesDB.find(g => g.id === gameId)) {
        localStorage.setItem('selectedGameId', gameId);
        window.location.href = 'game.html' + window.location.search;
    }
}

function updateURL(gameId) {
    const url = new URL(window.location.href);
    if (gameId) url.searchParams.set('id', gameId);
    else url.searchParams.delete('id');
    window.history.pushState({}, '', url);
}

// ---------- Действия ----------

function startGame(gameId) {
    const game = gamesDB.find(g => g.id === gameId);
    if (!game) return;
    localStorage.setItem('gameToPlayUrl', game.gameUrl);
    localStorage.setItem('gameToPlayTitle', game.title);
    localStorage.setItem('currentGameId', game.id);
    window.location.href = `play.html?id=${gameId}`;
}

function openDetails(gameId) {
    localStorage.setItem('selectedGameId', gameId);
    window.location.href = `game.html?id=${gameId}`;
}

// ---------- Карточка игры (общая для главной и страницы разработчика) ----------

function createGameCard(game) {
    const card = document.createElement('div');
    card.className = 'game-card';

    const hasVideo = !!game.video;

    card.innerHTML = `
        <div class="game-video-container" data-has-video="${hasVideo}">
            <img class="game-cover" src="${game.cover}" alt="${escapeHtml(game.title)}" onerror="this.style.display='none'">
            ${hasVideo ? `<video class="game-video" src="${game.video}" preload="auto" muted loop playsinline></video>` : ''}
        </div>
        <div class="game-info">
            <div class="game-title">${escapeHtml(game.title)}</div>
            <div>Разработчик: <span class="game-author" data-author="${escapeHtml(game.author)}">${escapeHtml(game.author)}</span></div>
            <div class="game-desc">${escapeHtml(game.shortDesc).substring(0, 80)}${game.shortDesc.length > 80 ? '...' : ''}</div>
            <div class="card-buttons">
                <button class="btn btn-play" data-id="${game.id}" data-action="play">🎮 Играть</button>
                <button class="btn" data-id="${game.id}" data-action="details">📖 Подробнее</button>
            </div>
        </div>
    `;

    if (hasVideo) {
        const container = card.querySelector('.game-video-container');
        const video = card.querySelector('.game-video');

        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.load();

        container.addEventListener('mouseenter', () => video.play().catch(() => {}));
        container.addEventListener('mouseleave', () => {
            video.pause();
            video.currentTime = 0;
        });
    }

    return card;
}

// Один обработчик на всю сетку вместо кучи на каждую карточку
function bindGridEvents(grid) {
    grid.addEventListener('click', (e) => {
        // Клик по имени разработчика
        const author = e.target.closest('.game-author');
        if (author) {
            const authorName = author.dataset.author;
            localStorage.setItem('selectedDeveloper', authorName);
            window.location.href = `developer.html?author=${encodeURIComponent(authorName)}`;
            return;
        }

        // Клик по кнопкам
        const btn = e.target.closest('.btn[data-action]');
        if (btn) {
            if (btn.dataset.action === 'play') startGame(btn.dataset.id);
            else openDetails(btn.dataset.id);
            return;
        }

        // Клик по видео-превью ничего не делает
        if (e.target.closest('.game-video-container')) return;

        // Клик по карточке → описание
        const card = e.target.closest('.game-card');
        if (card) {
            const id = card.querySelector('.btn[data-id]')?.dataset.id;
            if (id) openDetails(id);
        }
    });
}

// ---------- Главная страница ----------

function renderGames() {
    const grid = document.getElementById('gamesGrid');
    if (!grid) return;

    grid.innerHTML = '';
    gamesDB.forEach(game => grid.appendChild(createGameCard(game)));
    bindGridEvents(grid);
}

// ---------- Страница разработчика ----------

function loadDeveloperGames() {
    const urlParams = new URLSearchParams(window.location.search);
    const developerName = urlParams.get('author') || localStorage.getItem('selectedDeveloper');

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

    setSeo({
        title: `Игры разработчика ${developerName} — DesertBox`,
        description: `Все игры разработчика ${developerName} на игровом хабе DesertBox`,
        url: window.location.href
    });


    const developerGames = gamesDB.filter(game => game.author === developerName);

    if (developerGames.length === 0) {
        titleElement.textContent = developerName;
        descElement.textContent = 'У этого разработчика пока нет игр';
        grid.innerHTML = '<div style="text-align:center; padding:2rem;">📭 Игры не найдены</div>';
        return;
    }

    titleElement.textContent = developerName;
    descElement.textContent = `Все игры разработчика (${developerGames.length})`;

    grid.innerHTML = '';
    developerGames.forEach(game => grid.appendChild(createGameCard(game)));
    bindGridEvents(grid);
}

// ---------- Страница описания ----------

function loadGameDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const selectedId = urlParams.get('id') || localStorage.getItem('selectedGameId');

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

    updateURL(game.id);

    setSeo({
        title: `${game.title} — играть онлайн на DesertBox`,
        description: game.shortDesc || game.fullDesc.substring(0, 150),
        image: game.cover,
        url: HUB_BASE + `game.html?id=${encodeURIComponent(game.id)}`
    });


    // Медиа: видео трейлера + скриншоты
    const mediaItems = [];
    if (game.video) mediaItems.push({ type: 'video', url: game.video });
    (game.gallery || []).forEach(img => mediaItems.push({ type: 'image', url: img }));

    let galleryHtml = '';
    if (mediaItems.length > 0) {
        const firstMedia = mediaItems[0];
        galleryHtml = `
            <div class="game-gallery-full">
                <div class="full-gallery-main">
                    ${firstMedia.type === 'video' ?
                        `<video class="full-gallery-video" id="fullGalleryVideo" src="${firstMedia.url}" controls></video>` :
                        `<img class="full-gallery-img" id="fullGalleryImg" src="${firstMedia.url}" alt="${escapeHtml(game.title)}">`
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

    // 4 случайные другие игры (исключая текущую)
    const otherGames = gamesDB
        .filter(g => g.id !== game.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 4);

    container.innerHTML = `
        <div class="game-header">
            <div>
                ${game.logo ? `<img class="game-logo" src="${game.logo}" alt="${escapeHtml(game.title)} logo" onerror="this.style.display='none'">` : ''}
                <img class="screenshot" src="${game.cover}" alt="${escapeHtml(game.title)}" onerror="this.style.display='none'">
            </div>
            <div class="title-box">
                <div class="game-title">${escapeHtml(game.title)}</div>
                <div>Разработчик: <span class="game-author" data-author="${escapeHtml(game.author)}" style="cursor:pointer;">${escapeHtml(game.author)}</span></div>
                <div style="color:#94a3b8; margin-top: 0.5rem;">${escapeHtml(game.shortDesc)}</div>
            </div>
        </div>
        ${galleryHtml}
        <div class="description">
            <strong>📝 Полное описание:</strong><br><br>
            ${game.fullDesc}
        </div>
        <button class="btn" id="startGameBtn">🎮 ИГРАТЬ →</button>

        <div class="other-games-section">
            <div class="other-games-title">Другие игры</div>
            <div class="other-games-grid" id="otherGamesGrid">
                ${otherGames.map(other => `
                    <div class="other-game-card" data-id="${other.id}">
                        ${other.logo ? `<img class="other-game-logo" src="${other.logo}" alt="${escapeHtml(other.title)}" onerror="this.style.display='none'">` : ''}
                        <div class="other-game-title">${escapeHtml(other.title)}</div>
                        <div class="other-game-author">${escapeHtml(other.author)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Клик по имени разработчика
    const authorSpan = container.querySelector('.game-author');
    if (authorSpan) {
        authorSpan.addEventListener('click', () => {
            localStorage.setItem('selectedDeveloper', authorSpan.dataset.author);
            window.location.href = `developer.html?author=${encodeURIComponent(authorSpan.dataset.author)}`;
        });
    }

    // Клик по другим играм
    container.querySelectorAll('.other-game-card').forEach(card => {
        card.addEventListener('click', () => {
            window.location.href = `game.html?id=${card.dataset.id}`;
        });
    });

    // Галерея
    if (mediaItems.length > 0) {
        let currentMediaIndex = 0;
        const counter = document.getElementById('galleryCounter');
        const thumbs = container.querySelectorAll('.full-gallery-thumb-wrapper');
        const mainContainer = container.querySelector('.full-gallery-main');

        const renderMain = () => {
            const media = mediaItems[currentMediaIndex];
            const inner = media.type === 'video'
                ? `<video class="full-gallery-video" id="fullGalleryVideo" src="${media.url}" controls></video>`
                : `<img class="full-gallery-img" id="fullGalleryImg" src="${media.url}" alt="${escapeHtml(game.title)}">`;

            mainContainer.innerHTML = `
                ${inner}
                <button class="full-gallery-arrow prev" id="fullGalleryPrev">‹</button>
                <button class="full-gallery-arrow next" id="fullGalleryNext">›</button>
                <div class="gallery-counter">${currentMediaIndex + 1} / ${mediaItems.length}</div>
            `;

            mainContainer.querySelector('#fullGalleryPrev').addEventListener('click', () => {
                currentMediaIndex = (currentMediaIndex - 1 + mediaItems.length) % mediaItems.length;
                renderMain();
            });
            mainContainer.querySelector('#fullGalleryNext').addEventListener('click', () => {
                currentMediaIndex = (currentMediaIndex + 1) % mediaItems.length;
                renderMain();
            });
        };

        renderMain();

        thumbs.forEach(thumb => {
            thumb.addEventListener('click', () => {
                currentMediaIndex = parseInt(thumb.dataset.index);
                renderMain();
                thumbs.forEach(t => t.classList.toggle('active', t === thumb));
            });
        });
    }

    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) startBtn.addEventListener('click', () => startGame(game.id));
}

// ---------- Страница игры ----------

function initPlayPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const currentGameId = urlParams.get('id') || localStorage.getItem('currentGameId');

    const game = gamesDB.find(g => g.id === currentGameId);

    const iframe = document.getElementById('gameIframe');
    const titleSpan = document.getElementById('gameTitleSpan');
    const backLink = document.getElementById('backLink');
    const allGamesLink = document.getElementById('allGamesLink');
    const gameDescLink = document.getElementById('gameDescLink');

    if (titleSpan) titleSpan.textContent = game ? game.title : 'Игра';

    if (allGamesLink) {
        allGamesLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'index.html';
        });
    }

    if (currentGameId) {
        const goDesc = (e) => {
            e.preventDefault();
            window.location.href = `game.html?id=${currentGameId}`;
        };
        if (backLink) {
            backLink.href = `game.html?id=${currentGameId}`;
            backLink.style.visibility = 'visible';
            backLink.addEventListener('click', goDesc);
        }
        if (gameDescLink) gameDescLink.addEventListener('click', goDesc);
    }

    if (iframe) {
        if (game && game.gameUrl) {
            iframe.src = game.gameUrl;
        } else {
            iframe.srcdoc = `
                <html style="background:#0b1120;color:white;display:flex;align-items:center;justify-content:center;font-family:sans-serif;height:100%;">
                    <body style="text-align:center;">
                        <h2>🎮 Игра не найдена</h2>
                        <p>Вернитесь на <a href="index.html" style="color:#60a5fa;">главную страницу</a></p>
                    </body>
                </html>
            `;
        }
    }

    // === Промо-материалы ===
    setupSidebarBanner();
    prepareAdPayload();
    preloadAssets();
}

// Кликабельный баннер справа: случайный проект со случайным баннером
function setupSidebarBanner() {
    const sidebar = document.querySelector('.ad-sidebar');
    if (!sidebar) return;

    const projects = promoDB.filter(g => g.promo.banners.length > 0);
    if (!projects.length) {
        sidebar.style.display = 'none';
        return;
    }
    sidebar.style.display = 'flex'; // на случай, если раньше её скрывали


    const game = pickRandom(projects);
    const banner = pickRandom(game.promo.banners);
    const clickUrl = HUB_BASE + `game.html?id=${encodeURIComponent(game.id)}`;

    sidebar.innerHTML = `
        <a class="promo-banner" href="${clickUrl}" target="_blank" rel="noopener">
            <img src="${banner}" alt="Реклама: ${escapeHtml(game.title)}">
        </a>
        <div class="ad-label">Реклама</div>
    `;
}

// Ролик для rewarded-рекламы: случайный проект со случайным видео
function prepareAdPayload() {
    window.__adVideoUrl = '';
    window.__adClickUrl = '';

    const projects = promoDB.filter(g => g.promo.videos.length > 0);
    if (!projects.length) return;

    const game = pickRandom(projects);
    window.__adVideoUrl = pickRandom(game.promo.videos);
    window.__adClickUrl = HUB_BASE + `game.html?id=${encodeURIComponent(game.id)}`;
}

document.addEventListener('DOMContentLoaded', loadGames);

// ============================================================
// Предзагрузка медиа
// ============================================================

const preloadedUrls = new Set();

function preloadImage(url) {
    if (!url || preloadedUrls.has(url)) return;
    preloadedUrls.add(url);
    const img = new Image();
    img.src = url;
}

// full = true — качаем ролик целиком (нужно для рекламы),
// full = false — только метаданные (постер, длительность)
function preloadVideo(url, full) {
    if (!url || preloadedUrls.has(url)) return;
    preloadedUrls.add(url);
    const video = document.createElement('video');
    video.muted = true;
    video.preload = full ? 'auto' : 'metadata';
    video.src = url;
    video.load();
}

function preloadAssets() {
    const start = () => {
        gamesDB.forEach(game => {
            preloadImage(game.logo);
            preloadImage(game.cover);
            if (game.video) preloadVideo(game.video, false); // трейлер — только метаданные
            (game.gallery || []).forEach(preloadImage);
        });
        promoDB.forEach(game => {
            game.promo.banners.forEach(preloadImage);
        });
    };
    // Качаем, когда браузер свободен, чтобы не мешать первому рендеру
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 2000));
    idle(start, { timeout: 5000 });
}

// ============================================================
// SEO: мета-теги и разметка Schema.org
// ============================================================

function setSeo({ title, description, image, url }) {
    if (title) document.title = title;

    const setMeta = (attr, key, content) => {
        if (!content) return;
        let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
        if (!tag) {
            tag = document.createElement('meta');
            tag.setAttribute(attr, key);
            document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
    };

    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image);
    setMeta('property', 'twitter:title', title);
    setMeta('property', 'twitter:description', description);
    setMeta('property', 'twitter:image', image);
}

// Разметка для поисковиков: список игр как VideoGame
function injectJsonLd() {
    const data = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        'itemListElement': gamesDB.map((game, i) => ({
            '@type': 'ListItem',
            'position': i + 1,
            'item': {
                '@type': 'VideoGame',
                'name': game.title,
                'description': game.shortDesc,
                'url': HUB_BASE + 'game.html?id=' + encodeURIComponent(game.id),
                'image': game.cover,
                'author': { '@type': 'Person', 'name': game.author },
                'playMode': 'SinglePlayer',
                'applicationCategory': 'Game'
            }
        }))
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
}
