/** Pure parsing and CPI conversion helpers for historical money mentions. */

export type MoneyMention = {
  original: string;
  amountCents: number;
  start: number;
  end: number;
};

// U.S. city average CPI-U annual averages, BLS series CPIAUCNS (1913–2025).
// Bundled so opening a conversion never sends archive text to another service.
export const ANNUAL_CPI: Readonly<Record<number, number>> = {
  1913:9.883,1914:10.017,1915:10.108,1916:10.883,1917:12.825,1918:15.042,1919:17.333,1920:20.042,1921:17.85,1922:16.75,1923:17.05,1924:17.125,1925:17.542,1926:17.7,1927:17.358,1928:17.158,1929:17.158,1930:16.7,1931:15.208,1932:13.642,1933:12.933,1934:13.383,1935:13.725,1936:13.867,1937:14.383,1938:14.092,1939:13.908,1940:14.008,1941:14.725,1942:16.333,1943:17.308,1944:17.592,1945:17.992,1946:19.517,1947:22.325,1948:24.042,1949:23.808,1950:24.067,1951:25.958,1952:26.55,1953:26.767,1954:26.85,1955:26.775,1956:27.183,1957:28.092,1958:28.858,1959:29.15,1960:29.575,1961:29.892,1962:30.25,1963:30.625,1964:31.017,1965:31.508,1966:32.458,1967:33.358,1968:34.783,1969:36.683,1970:38.825,1971:40.492,1972:41.817,1973:44.4,1974:49.308,1975:53.817,1976:56.908,1977:60.608,1978:65.233,1979:72.575,1980:82.408,1981:90.925,1982:96.5,1983:99.6,1984:103.883,1985:107.567,1986:109.608,1987:113.625,1988:118.258,1989:123.967,1990:130.658,1991:136.192,1992:140.317,1993:144.458,1994:148.225,1995:152.383,1996:156.85,1997:160.517,1998:163.008,1999:166.575,2000:172.2,2001:177.067,2002:179.875,2003:183.958,2004:188.883,2005:195.292,2006:201.592,2007:207.342,2008:215.302,2009:214.537,2010:218.056,2011:224.939,2012:229.594,2013:232.957,2014:236.736,2015:237.017,2016:240.007,2017:245.12,2018:251.107,2019:255.657,2020:258.811,2021:270.97,2022:292.655,2023:304.702,2024:313.689,2025:321.943,
};

export const CPI_YEARS = Object.freeze(Object.keys(ANNUAL_CPI).map(Number));
export const LATEST_CPI_YEAR = CPI_YEARS[CPI_YEARS.length - 1]!;

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

const WORD = "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|and)";
const WORD_START = "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)";
const WORD_AMOUNT = `${WORD_START}(?:[ -]+${WORD}){0,8}`;
const NUMBER = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?`;
const MONEY_RE = new RegExp(
  String.raw`\$(?:\s*)${NUMBER}(?:\s*(?:dollars?|bucks?))?|${NUMBER}\s*(?:dollars?|bucks?|cents?|¢)|${WORD_AMOUNT}\s+(?:dollars?|bucks?|cents?)`,
  "giu",
);

function wordsToNumber(value: string): number | null {
  const words = value.toLowerCase().replace(/-/g, " ").split(/\s+/).filter((w) => w !== "and");
  let total = 0;
  let current = 0;
  for (const word of words) {
    if (word in SMALL) current += SMALL[word]!;
    else if (word === "hundred") current = Math.max(current, 1) * 100;
    else if (word === "thousand") {
      total += Math.max(current, 1) * 1000;
      current = 0;
    } else return null;
  }
  return total + current;
}

function amountInCents(phrase: string): number | null {
  const isCents = /(?:cents?|¢)\s*$/i.test(phrase);
  const cleaned = phrase
    .replace(/^\$\s*/, "")
    .replace(/\s*(?:dollars?|bucks?|cents?|¢)\s*$/i, "")
    .trim();
  const numeric = /^\d/.test(cleaned)
    ? Number(cleaned.replace(/,/g, ""))
    : wordsToNumber(cleaned);
  if (numeric == null || !Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric * (isCents ? 1 : 100));
}

/** Finds explicit currency phrases only; bare numbers, dates and record IDs do not match. */
export function parseMoneyMentions(text: string): MoneyMention[] {
  const out: MoneyMention[] = [];
  MONEY_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MONEY_RE.exec(text))) {
    const amountCents = amountInCents(match[0]);
    if (amountCents == null) continue;
    out.push({ original: match[0], amountCents, start: match.index, end: match.index + match[0].length });
  }
  return out;
}

/** Converts cents between annual CPI periods. Returns null outside available BLS years. */
export function convertMoney(amountCents: number, fromYear: number, toYear = LATEST_CPI_YEAR): number | null {
  const from = ANNUAL_CPI[fromYear];
  const to = ANNUAL_CPI[toYear];
  return from && to ? (amountCents / 100) * (to / from) : null;
}

export function yearFromDate(value?: string | null): number | undefined {
  const match = value?.match(/(?:^|\D)((?:18|19|20)\d{2})(?:\D|$)/);
  const year = match ? Number(match[1]) : undefined;
  return year && ANNUAL_CPI[year] ? year : undefined;
}