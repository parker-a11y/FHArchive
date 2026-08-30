# Harrington Letters Archive

Build me a private, personal web application called Harrington Letter Archive for cataloging, digitizing, transcribing, researching, and organizing a large collection of historical family letters.

This is NOT a public-facing website or blog. It is my private administrative workspace. Eventually some information may feed a separate public website, but do not design this application as a public blog.

The Collection

I have approximately 800 letters spanning prewar, World War II, and postwar periods.

The collection contains both:

Letters written by Francis Harrington

Letters written to Francis Harrington

Envelopes and occasional enclosures

Many letters are several small handwritten pages, often written on both sides.

The physical letters are being placed into archival folders and assigned permanent sequential IDs:

FH000001
FH000002
FH000003
etc.

The FH number is the permanent primary identifier. It must NEVER depend on the date, author, recipient, or other metadata because those things may later be corrected.

Core Concept

One database record represents one physical letter and all materials belonging to it.

A record can contain:

multiple scanned page images

envelope front/back images

enclosures

transcription

metadata

research notes

keywords

people

places

historical events

AI-generated information

Build the application around this model.

DASHBOARD

Create a simple archival dashboard showing:

Total letters

Letters cataloged

Letters scanned

Letters transcribed

Letters needing transcription

Letters reviewed

Letters with uncertain dates

Letters with missing scans

Prewar count

Wartime count

Postwar count

Include a prominent:

+ ADD NEXT LETTER

button.

When clicked, it should automatically determine the next available sequential FH number.

Example:

FH000427 → FH000428

Do not reuse deleted FH numbers automatically.

LETTER RECORD

Each letter should have its own page.

At the very top display the archive ID prominently:

FH000427

Immediately below show:

Date
From
To
Origin

Provide obvious navigation:

← Previous Letter | FH000427 | Next Letter →

Previous and Next should normally follow FH-number order.

Also provide:

Previous Chronologically / Next Chronologically

because FH order and corrected chronological order may eventually differ.

BASIC CATALOG FIELDS

Each record should contain:

Archive ID — permanent, system controlled

Date as written

Normalized date

Date precision:

Exact

Month only

Year only

Approximate

Unknown

Date certainty:

Confirmed

Probable

Possible

Unknown

Author

Recipient

Origin/location written from

Destination

Period:

Prewar

Wartime

Postwar

Unknown

Number of physical sheets

Number of scanned sides/images

Envelope:

Yes

No

Enclosures:

Yes

No

Physical condition

General notes

SCANNING

Create a section for uploading multiple scans belonging to a letter.

Allow drag-and-drop upload of multiple images.

Each uploaded image should be associated permanently with the FH record.

Allow image types such as:

Page 1 Front
Page 1 Back
Page 2 Front
Page 2 Back
Envelope Front
Envelope Back
Enclosure
Other

Allow me to reorder scans by dragging them.

Display them as thumbnails in reading order.

Clicking a thumbnail should open a large viewer.

Allow rotation if a scan is sideways.

Never modify or overwrite the original uploaded archival image. Any processed image should be a derivative.

Create filenames automatically based on the FH ID, such as:

FH000427_001
FH000427_002
FH000427_003
FH000427_ENV-F
FH000427_ENV-B

LABEL PRINTING

Create a Print Folder Label button.

Labels are printed on a MUNBYN RW403B thermal printer using 4 × 6 labels.

The label should contain ONLY:

FH000427

JUNE 14, 1943

The FH number should be very large and bold.

The date should be large underneath.

Provide a print preview formatted specifically for a 4 × 6 label.

Use the normalized date when available.

If the date is uncertain, allow formats such as:

JUNE 1943

c. 1943

DATE UNKNOWN

Do not put author, recipient, keywords, etc. on the physical label.

TRANSCRIPTION

Each letter needs a transcription section.

Include:

Raw AI Transcription

and separately:

Verified Transcription

Never allow AI-generated text to silently replace a human-verified transcription.

Include transcription status:

Not Started

AI Transcribed

Needs Review

Human Verified

Allow the transcription editor to be viewed alongside the scanned page.

Eventually I may connect an OCR/handwriting-recognition service such as Transkribus, Google, OpenAI, Claude or Gemini, so structure the application so AI transcription can be added later without redesigning the database.

PEOPLE

Allow people mentioned in letters to become reusable entities.

Examples:

Francis Harrington
Charlotte Harrington
John Smith

A person should have their own record containing:

Name
Alternate names/nicknames
Relationship
Biographical notes
Birth/death dates if known
Research notes

When viewing a person, show:

All letters written by this person

All letters sent to this person

All letters mentioning this person

PLACES

Places should also be reusable entities.

Examples:

Worcester, Massachusetts
Fort Benning, Georgia
London, England

Each place can have:

Canonical name
Name as written
City
State/region
Country
Latitude
Longitude
Historical notes
Research notes

Show all letters associated with that place.

Eventually I want to map Francis's movements chronologically, so design the location data accordingly.

KEYWORDS AND TOPICS

Create reusable tags/keywords.

Examples:

Officer Candidate School
Army
Deployment
Ships
Air raids
Food
Weather
Homesickness
Family
Christmas
Travel
Censorship

Allow multiple keywords per letter.

Clicking a keyword should show every associated letter.

Allow AI-suggested keywords but distinguish them from human-confirmed keywords.

HISTORICAL REFERENCES

Provide a section where I can record things mentioned in a letter that deserve additional research.

Fields:

Reference
Type
Description
Research status
Notes
Source links

Types might include:

Person
Military unit
Ship
Place
Historical event
Organization
Book
Newspaper
Other

AI ANALYSIS

Create placeholders for future AI-generated analysis.

For each letter eventually I want AI to generate:

Short summary

Detailed summary

Suggested keywords

People mentioned

Places mentioned

Military units

Ships

Organizations

Historical events

Important quotations

Uncertain transcription passages

Potential research questions

Related letters

Every AI-generated field must be clearly marked as AI-generated until I approve it.

Provide controls such as:

Accept

Edit & Accept

Reject

AI should never silently modify archival metadata.

RELATED LETTERS

Allow records to be manually related to other records.

Relationship types:

Reply to
Response from
Mentions previous letter
Same event
Same trip
Same location
Same subject
Other

Display related letters as clickable FH numbers.

SEARCH

Create powerful global search.

I should eventually be able to search:

"London"

and find matches in:

metadata
transcriptions
keywords
people
places
summaries
research notes

Provide filters for:

Date range
Author
Recipient
Period
Location
Keyword
Transcription status
Scan status
Review status

TIMELINE

Create a chronological timeline view of the letters.

Each entry should show:

Date
FH number
From → To
Origin
Short summary if available

Allow filtering by person, place, keyword and period.

TABLE / SPREADSHEET VIEW

Create a spreadsheet-style view of the archive.

Columns should include:

FH ID
Date
From
To
Origin
Period
Sheets
Images
Envelope
Scan Status
Transcription Status
Review Status
Keywords
Notes

Allow:

Sorting
Filtering
Column resizing
Column visibility
Inline editing where safe

Include:

Export CSV

and

Export Excel-compatible file

I want to retain possession of my data and be able to export the entire catalog at any time.

WORK QUEUES

Create useful workflow views:

Needs Scanning
Needs Transcription
Needs Review
Uncertain Dates
Missing Metadata
AI Suggestions Awaiting Review
Research Needed
Completed

This application should help me immediately see what work remains.

QUICK ENTRY MODE

Because I have approximately 800 letters, data entry speed is extremely important.

Create a streamlined Catalog Next Letter screen.

It should automatically supply the next FH number.

I enter:

Date
From
To
Period
Sheets
Envelope yes/no
Basic notes

Then:

SAVE & CREATE NEXT

The next FH number should immediately appear and the cursor should return to the Date field.

Keyboard navigation should work well.

Do not make me repeatedly navigate through menus while initially cataloging hundreds of letters.

DATA INTEGRITY

This is an historical archive, so preservation and provenance are important.

Never silently overwrite:

Original scans
Verified transcriptions
Original metadata

Track significant edits.

Store created date and modified date for each record.

Where practical, retain a simple edit history.

Allow uncertain information rather than forcing false precision.

Clearly distinguish:

Original document information
My research/interpretation
AI-generated information

DESIGN

The application is primarily for desktop use.

I want it to feel like a clean professional archival/database application, not a consumer photo gallery and not a blog.

Prioritize:

Speed
Readability
Large scan viewing
Easy navigation
Minimal clicks
Keyboard-friendly data entry

Use a restrained interface with plenty of white space.

The FH archive number should always be visually prominent.

Do not overdesign it.

IMPORTANT ARCHITECTURAL REQUIREMENT

Design the data model so this private archive can eventually serve as the authoritative source database for a completely separate public website.

However, do NOT build the public website now.

The private database should remain the master record.

Eventually I may selectively mark certain letters, scans, transcriptions, summaries, photographs, and metadata as approved for publication.

For now, simply include a field:

Publication Status

with:

Private
Candidate for Publication
Approved for Publication

Default EVERYTHING to Private.

FIRST VERSION

Do not try to implement external AI APIs yet.

For the first functional version, concentrate on:

Letter database

Sequential FH numbering

Fast catalog entry

Scan uploads

4 × 6 folder-label printing

Previous/next navigation

Spreadsheet/table view

CSV/data export

Keywords/tags

People and places

Transcription fields

Search and filtering

Workflow/status tracking

Data integrity and edit history

Build this as a working application, not simply a visual mockup.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://letter-loom-archive.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5c76849c-188e-4ca6-861e-84bedb8d22d4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
