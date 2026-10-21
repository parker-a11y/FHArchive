import assert from "node:assert/strict";
import { test } from "node:test";
import { shortLetterTitle, shortTitleWord } from "./short-title";

test("personal letters are titled with the word Letter", () => {
  assert.equal(
    shortLetterTitle({
      author: "Francis A. Harrington",
      recipient: "Jaquelyn Harrington",
      normalized_date: "1944-12-03",
      date_precision: "exact",
      subtype: "Personal letter",
    }),
    "Letter from Fran to Jaq - 1944-12-03",
  );
});

test("postcards are titled with the word Postcard", () => {
  assert.equal(
    shortLetterTitle({
      author: "Francis A. Harrington",
      recipient: "Jaquelyn Harrington",
      normalized_date: "1944-12-03",
      date_precision: "exact",
      subtype: "Postcard",
    }),
    "Postcard from Fran to Jaq - 1944-12-03",
  );
});

test("postcard spelling variants still read as Postcard", () => {
  assert.equal(shortTitleWord("postcard"), "Postcard");
  assert.equal(shortTitleWord(" Postcard "), "Postcard");
  assert.equal(shortTitleWord("Personal letter"), "Letter");
  assert.equal(shortTitleWord(null), "Letter");
});

test("undated postcards keep the dateless shape", () => {
  assert.equal(
    shortLetterTitle({ author: "Fran", recipient: "Jaq", subtype: "Postcard" }),
    "Postcard from Fran to Jaq",
  );
});
