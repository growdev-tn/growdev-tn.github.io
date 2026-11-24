# Technology logos

Recognisable names (Odoo, WordPress, PrestaShop, Python…) help a visitor trust that GrowDev works with real, common tools. They appear in three places: the marquee under the hero, the tag lists on the service cards, and the "Technologies, by area" list of the technical profile (`#developpeur`).

## Where things are

| What | Where |
|---|---|
| The twelve logo files | `site/assets/img/tech/<id>.svg` |
| The names and ids used on the page | `data-logo="<id>"` on a `<li>` in `src/index.template.html` |
| The build step that turns it into an image | `tools/build.mjs` (`TECH_DIR`, `techDims`, the `data-logo` replacement) |
| The checks | `tools/check.mjs` (search for `assets/img/tech`) |
| The credit line in the footer | `foot.logos` in `src/i18n/{fr,ar,en}.json` |
| The look | `.tech*` rules in `site/assets/css/styles.css` |

## The twelve logos

`django`, `docker`, `flutter`, `git`, `javascript`, `linux`, `nginx`, `odoo`, `postgresql`, `prestashop`, `python`, `wordpress`.

| Licence | Files | What it needs |
|---|---|---|
| CC0 1.0 (the Simple Icons collection, version 16.38.0). The *drawings* are free to use; the *trademarks* still belong to their owners | all except the two below | Nothing legally, but the footer says where they come from |
| CC BY 3.0, by Jason Long | `git.svg` | **The footer must name the author.** The checker fails the build if "Jason Long" is missing from `foot.logos` |
| MIT, © 2015 Chris Williams | `javascript.svg` | Keep the comment in the file |

Each file begins with a comment that says where it comes from. The checker fails if a file has no such comment.

**Trademarks.** The logos show that GrowDev *works with* these technologies. They do not say that GrowDev is endorsed by, certified by or a partner of their owners. The copy never claims it (see `docs/CREATIVE-BRIEF.md` §3, "claims to avoid"); keep it that way until a real partnership exists.

## Using a logo

In the template, write the name and the id on a list item:

```html
<li data-logo="python">Python</li>
```

At build time this becomes a chip with the picture and the name:

```html
<li class="tech"><span class="tech__plate"><img src="…/assets/img/tech/python.svg?v=1a2b3c4d" width="24" height="24" alt="" decoding="async"></span><span class="tech__name">Python</span></li>
```

- The picture is decoration (`alt=""`); the visible name is the label. For a very wide logo (width at least twice the height, such as Odoo's wordmark) the name is kept for screen readers only (`sr-only`) because the logo already spells it.
- On the Arabic page the name carries `lang="en"`, so a screen reader pronounces it correctly.
- `width` and `height` are read from the file, and `?v=` is a hash of its content. **Do not type them by hand.**
- Every logo sits on a white plate in both themes (`--logo-plate`), because some of the drawings are dark and would vanish on the dark canvas. Never recolour a logo, and never put a filter or opacity on it.
- The marquee holds two copies of the same list; the second is `aria-hidden` and is the copy that makes the loop.
- A name without a logo (for example "API", "SEO") is a plain `<li>`; it is centred in the same row.

## Adding a logo

1. Get an SVG whose licence allows it, from the Simple Icons collection (`https://simpleicons.org/`, CC0 for the drawings) or from the owner's brand page. Check the licence of that specific file.
2. Save it as `site/assets/img/tech/<id>.svg`, lower case, no spaces.
3. The file must be a plain drawing: a `viewBox`, a `width` and a `height`, a fill colour, **no script, no external reference, no embedded image**. Keep it **under 6 KB**.
4. Add one comment right after the opening `<svg>` tag that names the logo, the source, the licence (CC0, MIT, CC BY, Apache or BSD) and, for a trademark, that it belongs to its owner. Copy the form from an existing file.
5. Use it with `data-logo="<id>"` in the template.
6. If the licence requires a credit (CC BY), add the author's name to `foot.logos` in the three dictionaries.
7. Run `node tools/build.mjs && node tools/check.mjs`.

The build stops if `data-logo` names a file that does not exist. The checker fails when: the size or version in a page differs from the file; a logo has an `alt` text; a file has no source comment, contains a script, a link, a style sheet or an image, or is over 6 KB; a CC BY author is missing from the footer; the footer does not name Simple Icons; the marquee's two lists differ; or a `data-logo` attribute is still in a built page. A file that no page uses raises a warning only.

## Removing or replacing one

Delete the `data-logo` item from the template (the marquee, the service cards and the technical profile may each hold one), delete the file, rebuild. The checker expects at least 12 logo files; if you go below that on purpose, lower the number in `tools/check.mjs` (search for `fewer than 12 logos`).

## What is not here

The logos of **clients** are a different thing (`site/assets/img/clients/`, `docs/ARCHITECTURE.md` §5.6). Those need the client's agreement; the technology logos do not, but follow the trademark note above.
