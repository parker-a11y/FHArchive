import { useQuery } from "@tanstack/react-query";
import { fetchContacts } from "@/lib/archive-email";

export const CONTACT_EMAIL_LIST_ID = "archive-contact-emails";

/**
 * Browser suggestion list of previously used email addresses. Attach it to
 * any email box with `list={CONTACT_EMAIL_LIST_ID}`; matches appear as you type.
 */
export function ContactEmailList() {
  const { data: contacts = [] } = useQuery({
    queryKey: ["archive-contacts"],
    queryFn: fetchContacts,
    staleTime: 60_000,
  });
  return (
    <datalist id={CONTACT_EMAIL_LIST_ID}>
      {contacts.map((c) => (
        <option key={c.id} value={c.email}>
          {c.name && c.name !== c.email ? c.name : undefined}
        </option>
      ))}
    </datalist>
  );
}
