const CONFIG = {
  preloaderDelay: 1200,
  pageSize: 5,
  baseUrl: 'https://v-content.practicum-team.ru',
};

const API_ENDPOINT = `${CONFIG.baseUrl}/api/videos?pagination[pageSize]=${CONFIG.pageSize}&`;

const elements = {
  cardsContainer: document.querySelector('.content__list'),
  videoContainer: document.querySelector('.result__video-container'),
  video: document.querySelector('.result__video'),
  form: document.querySelector('.search-form'),
  cardTemplate: document.querySelector('.cards-list-item-template'),
  preloaderTemplate: document.querySelector('.preloader-template'),
  errorTemplate: document.querySelector('.error-template'),
  moreButtonTemplate: document.querySelector('.more-button-template'),
};

let videos = [];

initialize();

function initialize() {
  elements.form.addEventListener('submit', handleSearch);
  loadVideos(API_ENDPOINT);
}

async function handleSearch(event) {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const city = String(formData.get('city') || '').trim();
  const times = formData.getAll('time');

  await loadVideos(buildRequestUrl({ city, times }));
}

async function loadVideos(url) {
  resetResults();
  showPreloaders();

  try {
    const data = await fetchVideos(url);

    if (!data.results?.length) {
      showError('Нет подходящих видео =(');
      return;
    }

    videos = data.results;
    renderCards(data.results);
    setMainVideo(data.results[0]);

    await waitForVideo(elements.video);
    await delay(CONFIG.preloaderDelay);

    setCurrentCard(data.results[0].id);
    renderMoreButton(data, url);
  } catch (error) {
    console.error('Failed to load videos:', error);
    showError('Ошибка получения данных :(');
  } finally {
    removePreloaders();
  }
}

async function fetchVideos(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

function resetResults() {
  elements.cardsContainer.replaceChildren();
  elements.videoContainer.querySelector('.error')?.remove();
  videos = [];
}

function showPreloaders() {
  showPreloader(elements.videoContainer);
  showPreloader(elements.cardsContainer);
}

function removePreloaders() {
  removePreloader(elements.videoContainer);
  removePreloader(elements.cardsContainer);
}

function showPreloader(parent) {
  const node = elements.preloaderTemplate.content.cloneNode(true);
  parent.append(node);
}

function removePreloader(parent) {
  parent.querySelector('.preloader')?.remove();
}

function renderCards(items) {
  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    fragment.append(createCard(item));
  });

  elements.cardsContainer.append(fragment);
}

function createCard(item) {
  const node = elements.cardTemplate.content.cloneNode(true);
  const link = node.querySelector('.content__card-link');
  const title = node.querySelector('.content__video-card-title');
  const description = node.querySelector('.content__video-card-description');
  const thumbnail = node.querySelector('.content__video-card-thumbnail');

  link.dataset.videoId = String(item.id);
  link.href = '#video';

  title.textContent = item.city;
  description.textContent = item.description;
  thumbnail.src = `${CONFIG.baseUrl}${item.thumbnail.url}`;
  thumbnail.alt = `Видео: ${item.description}`;

  link.addEventListener('click', async (event) => {
    event.preventDefault();

    const selectedVideo = videos.find(
      (video) => String(video.id) === String(item.id)
    );

    if (!selectedVideo) {
      return;
    }

    showPreloader(elements.videoContainer);

    try {
      setMainVideo(selectedVideo);
      await waitForVideo(elements.video);
      await delay(CONFIG.preloaderDelay);
      setCurrentCard(selectedVideo.id);
    } catch (error) {
      console.error('Failed to switch video:', error);
      showError('Не удалось загрузить видео :(');
    } finally {
      removePreloader(elements.videoContainer);
    }
  });

  return node;
}

function setMainVideo(videoData) {
  elements.video.src = `${CONFIG.baseUrl}${videoData.video.url}`;
  elements.video.poster = `${CONFIG.baseUrl}${videoData.poster.url}`;
  elements.video.load();
}

function setCurrentCard(videoId) {
  elements.cardsContainer
    .querySelectorAll('.content__card-link')
    .forEach((link) => {
      const isCurrent = link.dataset.videoId === String(videoId);
      link.classList.toggle('content__card-link_current', isCurrent);

      if (isCurrent) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });
}

function renderMoreButton(data, initialUrl) {
  elements.cardsContainer.querySelector('.more-button')?.closest('li')?.remove();

  if (data.pagination.page >= data.pagination.pageCount) {
    return;
  }

  const node = elements.moreButtonTemplate.content.cloneNode(true);
  const button = node.querySelector('.more-button');

  button.addEventListener('click', async () => {
    button.disabled = true;
    const nextPage = data.pagination.page + 1;
    const nextUrl = `${initialUrl}pagination[page]=${nextPage}&`;

    try {
      const nextData = await fetchVideos(nextUrl);
      button.closest('li')?.remove();

      videos = [...videos, ...nextData.results];
      renderCards(nextData.results);
      renderMoreButton(nextData, initialUrl);
    } catch (error) {
      console.error('Failed to load more videos:', error);
      button.disabled = false;
    }
  });

  elements.cardsContainer.append(node);
}

function buildRequestUrl({ city, times }) {
  const params = new URLSearchParams();
  params.set('pagination[pageSize]', String(CONFIG.pageSize));

  if (city) {
    params.set('filters[city][$containsi]', city);
  }

  times.forEach((time) => {
    params.append('filters[time_of_day][$eqi]', time);
  });

  return `${CONFIG.baseUrl}/api/videos?${params.toString()}&`;
}

function showError(message) {
  elements.videoContainer.querySelector('.error')?.remove();

  const node = elements.errorTemplate.content.cloneNode(true);
  node.querySelector('.error__title').textContent = message;
  elements.videoContainer.append(node);
}

function waitForVideo(video) {
  if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error('Video failed to load'));
    };

    const cleanup = () => {
      video.removeEventListener('canplaythrough', onReady);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('canplaythrough', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
