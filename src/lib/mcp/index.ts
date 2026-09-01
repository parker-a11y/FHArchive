import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchRecords from "./tools/search-records";
import getRecord from "./tools/get-record";
import listPeople from "./tools/list-people";
import listQuotations from "./tools/list-quotations";

// The OAuth issuer must be the direct Supabase host; the project ref is the one
// value that survives publish unchanged and is inlined at build time.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "harrington-letters-archive",
  title: "Harrington Letters Archive",
  version: "0.1.0",
  instructions:
    "Read-only research tools for The Francis Files / Harrington Letters Archive. Use search_records to find FH records, get_record to read one in full including its transcription, list_people for the people index, and list_quotations for notable quotations.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchRecords, getRecord, listPeople, listQuotations],
});
