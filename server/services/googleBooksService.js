const https = require('https');

const REQUEST_TIMEOUT_MS = parseInt(process.env.GOOGLE_BOOKS_TIMEOUT_MS || '12000', 10) || 12000;

const makeError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const sanitizeText = (value, maxLength = 5000) =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength) : '';

const upgradeImageUrl = (url) => {
  if (!url) return null;
  return String(url).replace(/^http:\/\//i, 'https://').replace(/&zoom=\d+/, '&zoom=1');
};

const searchGoogleBooks = (query, maxResults = 12, options = {}) =>
  new Promise((resolve, reject) => {
    const trimmedQuery = sanitizeText(query, 200);
    if (!trimmedQuery) return resolve([]);

    const safeMax = Math.min(Math.max(parseInt(maxResults, 10) || 12, 1), 40);
    const apiKey = sanitizeText(options.apiKey || process.env.GOOGLE_BOOKS_API_KEY, 200);
    const params = new URLSearchParams({
      q: trimmedQuery,
      maxResults: String(safeMax),
      printType: 'books',
    });
    if (apiKey) params.set('key', apiKey);

    const url = `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
    let settled = false;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };

    const request = https.get(
      url,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'TestCraftAI/1.0 (+https://testcraft.ai)',
        },
      },
      (response) => {
        let rawData = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          rawData += chunk;
          if (rawData.length > 4 * 1024 * 1024) {
            request.destroy();
            finish(reject, makeError(502, 'GOOGLE_BOOKS_RESPONSE_TOO_LARGE', 'Google Books returned an unexpectedly large response.'));
          }
        });

        response.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(rawData || '{}');
          } catch {
            return finish(
              reject,
              makeError(502, 'GOOGLE_BOOKS_INVALID_RESPONSE', 'Google Books returned an unreadable response. Please try again.')
            );
          }

          if (response.statusCode === 429) {
            return finish(
              reject,
              makeError(
                429,
                'GOOGLE_BOOKS_RATE_LIMIT',
                'Google Books search is temporarily rate limited. Please wait a minute and try again, or ask an administrator to configure a Google Books API key.'
              )
            );
          }

          if (response.statusCode === 400) {
            return finish(
              reject,
              makeError(400, 'GOOGLE_BOOKS_BAD_REQUEST', 'Google Books rejected this search. Check the title, author, or ISBN and try again.')
            );
          }

          if (response.statusCode === 401 || response.statusCode === 403) {
            return finish(
              reject,
              makeError(
                502,
                'GOOGLE_BOOKS_AUTH',
                'Google Books rejected the configured API key. Ask an administrator to verify the Google Books API key.'
              )
            );
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            const providerMessage = parsed?.error?.message || `HTTP ${response.statusCode}`;
            return finish(
              reject,
              makeError(502, 'GOOGLE_BOOKS_UNAVAILABLE', `Google Books is unavailable right now (${providerMessage}).`)
            );
          }

          if (parsed?.error) {
            return finish(
              reject,
              makeError(502, 'GOOGLE_BOOKS_ERROR', `Google Books error: ${sanitizeText(parsed.error.message, 300) || 'unknown error'}`)
            );
          }

          if (!Array.isArray(parsed.items)) return finish(resolve, []);

          const seen = new Set();
          const books = [];
          for (const item of parsed.items) {
            if (!item?.id || seen.has(item.id)) continue;
            seen.add(item.id);
            const info = item.volumeInfo || {};
            const identifiers = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : [];
            const isbnObject =
              identifiers.find((identifier) => String(identifier.type || '').includes('ISBN')) || identifiers[0];

            books.push({
              googleBooksId: item.id,
              title: sanitizeText(info.title, 240) || 'Untitled book',
              subtitle: sanitizeText(info.subtitle, 240),
              authors: Array.isArray(info.authors)
                ? info.authors.map((author) => sanitizeText(author, 120)).filter(Boolean).slice(0, 10)
                : [],
              publisher: sanitizeText(info.publisher, 160),
              publishedDate: sanitizeText(info.publishedDate, 40),
              description: sanitizeText(info.description, 5000),
              pageCount: Number.isFinite(Number(info.pageCount)) ? Math.max(0, Number(info.pageCount)) : 0,
              categories: Array.isArray(info.categories)
                ? info.categories.map((category) => sanitizeText(category, 100)).filter(Boolean).slice(0, 8)
                : [],
              thumbnail: upgradeImageUrl(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail),
              previewLink: info.previewLink || null,
              infoLink: info.infoLink || null,
              isbn: isbnObject ? sanitizeText(isbnObject.identifier, 40) : '',
              language: sanitizeText(info.language, 20) || 'en',
              source: 'google_books',
            });
          }

          return finish(resolve, books);
        });
      }
    );

    const timer = setTimeout(() => {
      request.destroy();
      finish(
        reject,
        makeError(504, 'GOOGLE_BOOKS_TIMEOUT', 'Google Books did not respond in time. Please try again.')
      );
    }, REQUEST_TIMEOUT_MS);

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy();
      finish(reject, makeError(504, 'GOOGLE_BOOKS_TIMEOUT', 'Google Books did not respond in time. Please try again.'));
    });

    request.on('error', (error) => {
      if (settled) return;
      finish(
        reject,
        makeError(502, 'GOOGLE_BOOKS_NETWORK', `Could not reach Google Books: ${sanitizeText(error.message, 200)}`)
      );
    });
  });

module.exports = {
  searchGoogleBooks,
};
