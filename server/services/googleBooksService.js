const https = require('https');

const searchGoogleBooks = (query, maxResults = 12) => {
  return new Promise((resolve, reject) => {
    if (!query || !query.trim()) {
      return resolve([]);
    }

    const apiKey = process.env.GOOGLE_BOOKS_API_KEY ? `&key=${process.env.GOOGLE_BOOKS_API_KEY}` : '';
    const encodedQuery = encodeURIComponent(query.trim());
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=${maxResults}&printType=books${apiKey}`;

    https
      .get(url, (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            if (!parsed.items || !Array.isArray(parsed.items)) {
              return resolve([]);
            }

            const books = parsed.items.map((item) => {
              const info = item.volumeInfo || {};
              const identifiers = info.industryIdentifiers || [];
              const isbnObj = identifiers.find((id) => id.type.includes('ISBN')) || identifiers[0];

              return {
                googleBooksId: item.id,
                title: info.title || 'Untitled Book',
                subtitle: info.subtitle || '',
                authors: info.authors || ['Unknown Author'],
                publisher: info.publisher || 'Independent Educational Publisher',
                publishedDate: info.publishedDate || '',
                description: info.description || 'No detailed synopsis provided by publisher.',
                pageCount: info.pageCount || 0,
                categories: info.categories || ['General Education'],
                thumbnail: info.imageLinks ? info.imageLinks.thumbnail || info.imageLinks.smallThumbnail : null,
                previewLink: info.previewLink || null,
                infoLink: info.infoLink || null,
                isbn: isbnObj ? isbnObj.identifier : 'N/A',
                language: info.language || 'en',
              };
            });

            resolve(books);
          } catch (err) {
            reject(new Error(`Failed to parse Google Books response: ${err.message}`));
          }
        });
      })
      .on('error', (err) => {
        reject(new Error(`Network error calling Google Books API: ${err.message}`));
      });
  });
};

module.exports = {
  searchGoogleBooks,
};
