# Web & Mobile Development: Module Notes

Chronological course notes, chapters 1 to 20. Each chapter matches the module map.

Chapters 2, 4, 7, 8, 9 and 12 carry a live playground: the site runs inside the note, and every one has an **Edit code** button that opens its HTML, CSS and JavaScript. Change anything and the page re-renders. Nothing you type is saved, so **Reset** always brings the original back.

## Part 1: the web (chapters 1 to 12)

| # | Chapter | Covers |
| --- | --- | --- |
| 1 | [How the web works](/notes/web/notes/ch01-how-the-web-works) | DNS, packets, TCP, TLS, HTTP, CDN, load balancers, push |
| 2 | [HTML and CSS](/notes/web/notes/ch02-html-and-css) | Tags, tables, inputs, selectors, box model, flexbox |
| 3 | [Models and Migrations](/notes/web/notes/ch03-models-and-migrations) | Tables, PK/FK, ERD, Django models, migrations |
| 4 | [Submitting and processing data](/notes/web/notes/ch04-submitting-and-processing-data) | JavaScript language tour, DOM, events, first jQuery, first AJAX |
| 5 | [Validating and saving data](/notes/web/notes/ch05-validating-and-saving-data) | Django forms, `clean_` methods, why the server revalidates |
| 6 | [The Django admin site](/notes/web/notes/ch06-the-django-admin-site) | `createsuperuser`, registering models, list/search/filter |
| 7 | [jQuery for forms](/notes/web/notes/ch07-jquery-for-forms) | `.val()`, chaining, collect-every-problem validation |
| 8 | [jQuery real-time validation](/notes/web/notes/ch08-jquery-real-time-validation) | `.on("input")`, `toggleClass`, regex with `.test()` |
| 9 | [AJAX](/notes/web/notes/ch09-ajax) | Promises, `fetch`, async/await, `$.ajax` |
| 10 | [Data exchange with JSON](/notes/web/notes/ch10-data-exchange-with-json) | JSON rules, `stringify` / `parse` |
| 11 | [API programming](/notes/web/notes/ch11-api-programming) | REST, methods, status codes, DRF serializers/views/urls |
| 12 | [API integration](/notes/web/notes/ch12-api-integration) | curl first, CORS, calling your own API |

## Part 2: security and mobile (chapters 13 to 20)

| # | Chapter | Covers |
| --- | --- | --- |
| 13 | [Security issues](/notes/web/notes/ch13-security-issues) | SQL injection, XSS, CSRF, mobile-specific risks |
| 14 | [Mitigation strategies](/notes/web/notes/ch14-mitigation-strategies-by-frameworks) | What Django blocks by default, and the mobile equivalents |
| 15 | [Mobile app considerations](/notes/web/notes/ch15-considerations-for-your-mobile-app) | Responsive vs native vs hybrid |
| 16 | [Platforms](/notes/web/notes/ch16-platforms) | iOS vs Android, stores, review |
| 17 | [The mobile apps landscape](/notes/web/notes/ch17-the-mobile-apps-landscape) | Categories, discovery, monetization |
| 18 | [Sensor-aware applications](/notes/web/notes/ch18-sensor-aware-applications) | GPS, accelerometer, camera, push |
| 19 | [Connecting the app to your API](/notes/web/notes/ch19-connecting-the-mobile-app-to-your-api) | Same API, different client, token auth |
| 20 | [Testing and deploying](/notes/web/notes/ch20-testing-and-deploying-mobile-apps) | Real devices, bad networks, beta tracks, deploy targets |

The running example throughout is **Ares Colony**, a Mars recruitment site: Chapters 2 to 4 build its front end, Chapters 3, 5, 6 and 11 build its Django back end, and Chapters 15 to 20 take it to a phone.
