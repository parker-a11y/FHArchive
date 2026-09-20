# Highlight historical money and convert it to today’s dollars

## What will change
- Recognize U.S. money written in common archival forms, including `$5`, `$5.25`, `5 dollars`, `five dollars`, `fifty cents`, and spelled amounts through thousands.
- Give each detected amount a subtle, distinct highlight without changing the saved transcription or note.
- On hover, keyboard focus, or tap, open a compact card showing the original amount and its approximate value in today’s U.S. dollars.
- Use the record’s normalized or estimated year automatically. Clearly label estimated dates and let the reader adjust the source year in the card when needed.
- Apply this throughout readable archive text: FH and Digital Source transcriptions, notes and summaries, search excerpts, quotations, Ask Francis answers, recaps/blog posts, and private shared pages.

## Conversion rules
- Use U.S. Consumer Price Index data and display the result as an estimate, rounded sensibly rather than implying false precision.
- Define “today” as the latest available CPI period and show that period in the card.
- If a text block has no usable date, still highlight the amount and let the reader choose a year before calculating.
- Keep the original wording visible at all times; conversion is explanatory only.
- Avoid false matches such as record numbers, dates, page numbers, and bare numbers without a currency marker or money word.

## Shared implementation
- Add one tested money parser that returns the original phrase, normalized dollar amount, and text position.
- Add a reusable money-term popover with mouse, keyboard, and touch support.
- Extend the existing shared archive-text renderer so money recognition coexists with Francis File Note terms, search highlighting, rich-text formatting, and record links.
- Pass date context into shared text views where the containing FH or Digital Source already supplies it. For mixed-source narratives such as Ask Francis and recaps, use a nearby cited record’s year only when unambiguous; otherwise show the year selector.
- Keep CPI reference data and conversion logic in a shared utility, with no conversion request required each time a reader opens a card.

## Safeguards and verification
- Preserve stored text and HTML exactly as written.
- Test symbols, numerals, spelled amounts, cents, punctuation, multiple amounts in one paragraph, rich text split across elements, and false positives.
- Confirm FFN yellow highlighting and search-term highlighting still work independently.
- Verify hover, tap, keyboard opening, year adjustment, estimated-date labeling, mobile layout, and shared/public views.
- Confirm the app remains healthy after the changes.
