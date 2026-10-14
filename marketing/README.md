# Company marketing site

`index.html` is the lightweight standalone company page and `footer.html` is
its shared footer fragment. It is static and does not share auth, checkout,
session state or service-worker caches with the product PWA.

The existing full landing experience remains in `web/` while product
development is prepared. Do not delete or silently replace that content.
Coordinate canonical URL, shared copy/contact/legal links and SEO when deciding
whether the static page becomes the primary company site. Product routes and
shop/tracking capability links belong in `web/`, not this marketing bundle.
